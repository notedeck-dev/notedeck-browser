import { createNote, describeError, listAccounts, lookupUser } from "./api.js";
import {
  composeLink,
  composeText,
  menuComposeText,
  noteLink,
  parseMisskeyUrl,
  userLink,
  userLookupTarget,
} from "./links.js";
import { openDeepLink } from "./open.js";
import { loadSettings, saveSettings } from "./settings.js";

const m = (k, subs) => chrome.i18n.getMessage(k, subs);

// Misskey の URL の形だけで出し分ける (ホストの一覧は要らない)
const MISSKEY_URL_PATTERNS = ["*://*/notes/*", "*://*/@*"];

function createMenus() {
  // onInstalled と onStartup が続けて来ると同じ id を二度作ることがある。そのエラーは読み捨てる
  const ignore = () => void chrome.runtime.lastError;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "compose-page", title: m("menuComposePage"), contexts: ["page"] }, ignore);
    chrome.contextMenus.create(
      { id: "compose-selection", title: m("menuComposeSelection"), contexts: ["selection"] },
      ignore,
    );
    chrome.contextMenus.create({ id: "compose-link", title: m("menuComposeLink"), contexts: ["link"] }, ignore);
    chrome.contextMenus.create({ id: "compose-image", title: m("menuComposeImage"), contexts: ["image"] }, ignore);
    chrome.contextMenus.create(
      {
        id: "open-link",
        title: m("menuOpenLink"),
        contexts: ["link"],
        targetUrlPatterns: MISSKEY_URL_PATTERNS,
      },
      ignore,
    );
    chrome.contextMenus.create(
      {
        id: "open-page",
        title: m("menuOpenPage"),
        contexts: ["page"],
        documentUrlPatterns: MISSKEY_URL_PATTERNS,
      },
      ignore,
    );
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  createMenus();
  // 初回だけ設定を開いて、トークン無しで使える範囲と要る機能を案内する
  if (details.reason === "install") void chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(createMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void handleMenu(info, tab);
});

/**
 * @param {chrome.contextMenus.OnClickData} info
 * @param {chrome.tabs.Tab | undefined} tab
 */
async function handleMenu(info, tab) {
  const tabId = tab?.id;
  const text = menuComposeText(info.menuItemId, info, tab?.title);
  if (text !== null) return openDeepLink(composeLink(text), tabId);
  switch (info.menuItemId) {
    case "open-link":
      return openMisskeyUrl(info.linkUrl ?? "", tabId);
    case "open-page":
      return openMisskeyUrl(info.pageUrl ?? "", tabId);
  }
}

/**
 * Misskey のノート / ユーザーの URL を NoteDeck で開く。ユーザーは内部 id が要るので API で引く。
 * @param {string} url
 * @param {number | undefined} tabId
 */
export async function openMisskeyUrl(url, tabId) {
  const parsed = parseMisskeyUrl(url);
  if (!parsed) return notify(m("notifyNotMisskeyUrl"));
  const { token, accountId } = await loadSettings();
  if (parsed.kind === "note") {
    // 本体はそのサーバーの口座が無いリンクを黙って捨てる。トークンがあれば先に確かめて知らせる
    // (確かめられないとき = NoteDeck が起動していない等は、そのまま開く)
    const accounts = token ? await listAccounts().catch(() => null) : null;
    if (accounts && !accounts.some((a) => a.host === parsed.host)) {
      return notify(m("notifyNoAccountOnHost", parsed.host));
    }
    return openDeepLink(noteLink(parsed), tabId);
  }
  if (!token) return notify(m("notifyTokenRequired"));
  try {
    const target = userLookupTarget(parsed, await listAccounts(), accountId);
    if (!target) return notify(m("optionsNoAccounts"));
    const user = await lookupUser({
      username: parsed.username,
      host: target.host,
      accountId: target.account.id,
    });
    await openDeepLink(userLink(target.account.host, user.id, target.account.userId), tabId);
  } catch (e) {
    notify(describeError(e));
  }
}

// ポップアップからの「このページを NoteDeck で開く」
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "create-note") {
    void postNote(msg.params);
    sendResponse(true);
    return false;
  }
  if (msg?.type !== "open-misskey-url") return false;
  openMisskeyUrl(msg.url, msg.tabId).then(
    () => sendResponse(true),
    () => sendResponse(false),
  );
  return true;
});

/**
 * ポップアップからの直接投稿。NoteDeck 側の確認でフォーカスが移るとポップアップは閉じるので、
 * ここで待って結果を通知で知らせる。
 * @param {{ text: string, cw?: string, visibility?: string, accountId?: string }} params
 */
async function postNote(params) {
  // 確認待ちの間に service worker がアイドルで止められないよう、拡張 API を呼んでタイマーを戻す
  const keepAlive = setInterval(() => void chrome.runtime.getPlatformInfo(), 20_000);
  posting++;
  try {
    await chrome.storage.local.set({ pendingPost: Date.now() });
    await createNote(params);
    await saveSettings({ accountId: params.accountId });
    notify(m("popupPosted"));
  } catch (e) {
    notify(describeError(e));
  } finally {
    clearInterval(keepAlive);
    if (--posting === 0) await chrome.storage.local.remove("pendingPost");
  }
}

// 待っている間に service worker が止められると結果を知らせられない。印が残っていたら次の起動で知らせる
let posting = 0;
void chrome.storage.local.get("pendingPost").then((s) => {
  if (!s.pendingPost || posting > 0) return;
  void chrome.storage.local.remove("pendingPost");
  notify(m("notifyPostUnknown"));
});

function notify(message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/128.png"),
    title: m("notifyTitle"),
    message,
  });
}

// アドレスバーで `nd <本文>` → 投稿フォーム
chrome.omnibox.setDefaultSuggestion({ description: m("omniboxDescription", "%s") });
chrome.omnibox.onInputEntered.addListener((text) => {
  void (async () => {
    // 外部プロトコルへの遷移はページを置き換えないので、どの disposition でも今のタブで開く (空のタブを作らない)
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await openDeepLink(composeLink(text.trim()), tab?.id);
  })();
});

// キーボードショートカット (既定 Alt+Shift+N)
chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "compose-page") return;
  void openDeepLink(composeLink(composeText({ title: tab?.title, url: tab?.url })), tab?.id);
});
