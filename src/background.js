import { createNote, describeError, listAccounts, lookupUser } from "./api.js";
import { composeLink, composeText, noteLink, parseMisskeyUrl, userLink, userLookupTarget } from "./links.js";
import { openDeepLink } from "./open.js";
import { loadSettings, saveSettings } from "./settings.js";

const m = (k, subs) => chrome.i18n.getMessage(k, subs);

// Misskey の URL の形だけで出し分ける (ホストの一覧は要らない)
const MISSKEY_URL_PATTERNS = ["*://*/notes/*", "*://*/@*"];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "compose-page", title: m("menuComposePage"), contexts: ["page"] });
    chrome.contextMenus.create({ id: "compose-selection", title: m("menuComposeSelection"), contexts: ["selection"] });
    chrome.contextMenus.create({ id: "compose-link", title: m("menuComposeLink"), contexts: ["link"] });
    chrome.contextMenus.create({ id: "compose-image", title: m("menuComposeImage"), contexts: ["image"] });
    chrome.contextMenus.create({
      id: "open-link",
      title: m("menuOpenLink"),
      contexts: ["link"],
      targetUrlPatterns: MISSKEY_URL_PATTERNS,
    });
    chrome.contextMenus.create({
      id: "open-page",
      title: m("menuOpenPage"),
      contexts: ["page"],
      documentUrlPatterns: MISSKEY_URL_PATTERNS,
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void handleMenu(info, tab);
});

/**
 * @param {chrome.contextMenus.OnClickData} info
 * @param {chrome.tabs.Tab | undefined} tab
 */
async function handleMenu(info, tab) {
  const tabId = tab?.id;
  switch (info.menuItemId) {
    case "compose-page":
      return openDeepLink(composeLink(composeText({ title: tab?.title, url: info.pageUrl })), tabId);
    case "compose-selection":
      return openDeepLink(composeLink(composeText({ selection: info.selectionText, url: info.pageUrl })), tabId);
    case "compose-link":
      return openDeepLink(composeLink(composeText({ url: info.linkUrl })), tabId);
    case "compose-image":
      return openDeepLink(composeLink(composeText({ url: info.srcUrl })), tabId);
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
  if (parsed.kind === "note") return openDeepLink(noteLink(parsed), tabId);
  const { token, accountId } = await loadSettings();
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
  try {
    await createNote(params);
    await saveSettings({ accountId: params.accountId });
    notify(m("popupPosted"));
  } catch (e) {
    notify(describeError(e));
  } finally {
    clearInterval(keepAlive);
  }
}

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
chrome.omnibox.onInputEntered.addListener((text, disposition) => {
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await openDeepLink(composeLink(text.trim()), disposition === "currentTab" ? tab?.id : undefined);
  })();
});

// キーボードショートカット (既定 Alt+Shift+N)
chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "compose-page") return;
  void openDeepLink(composeLink(composeText({ title: tab?.title, url: tab?.url })), tab?.id);
});
