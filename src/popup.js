import { accountLabel, createNote, describeError, listAccounts } from "./api.js";
import { composeLink, composeText, parseMisskeyUrl } from "./links.js";
import { openDeepLink } from "./open.js";
import { loadSettings, saveSettings } from "./settings.js";

const m = (k) => chrome.i18n.getMessage(k);
const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

for (const el of document.querySelectorAll("[data-i18n]")) {
  el.textContent = m(el.getAttribute("data-i18n"));
}

const textEl = /** @type {HTMLTextAreaElement} */ ($("text"));
const statusEl = $("status");
const setStatus = (s) => {
  statusEl.textContent = s;
};

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const page = { title: tab?.title ?? "", url: tab?.url ?? "" };

async function selectionOfTab() {
  if (tab?.id === undefined) return "";
  try {
    const [r] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() ?? "",
    });
    return r?.result ?? "";
  } catch {
    return "";
  }
}

// 初期本文: 選択範囲があればそれ + URL、無ければタイトル + URL
const selection = await selectionOfTab();
textEl.value = composeText({ ...page, selection });
$("use-page").addEventListener("click", () => {
  textEl.value = composeText(page);
});
$("use-selection").addEventListener("click", async () => {
  textEl.value = composeText({ ...page, selection: await selectionOfTab() });
});

// 今のページが Misskey のノート / ユーザーなら「NoteDeck で開く」を出す
if (parseMisskeyUrl(page.url)) {
  $("open-section").hidden = false;
  $("open-in-notedeck").addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "open-misskey-url", url: page.url, tabId: tab?.id });
    window.close();
  });
}

$("open-form").addEventListener("click", async () => {
  const text = textEl.value.trim();
  await openDeepLink(composeLink(text), tab?.id);
  window.close();
});

$("options").addEventListener("click", () => chrome.runtime.openOptionsPage());

// 直接投稿 (トークンが要る)
const settings = await loadSettings();
if (!settings.token) {
  $("no-token").hidden = false;
} else {
  $("direct").addEventListener("toggle", () => void loadAccounts(), { once: true });
}

async function loadAccounts() {
  const select = /** @type {HTMLSelectElement} */ ($("account"));
  try {
    const accounts = await listAccounts();
    select.replaceChildren(
      ...accounts.map((a) => {
        const o = document.createElement("option");
        o.value = a.id;
        o.textContent = accountLabel(a);
        return o;
      }),
    );
    if (accounts.some((a) => a.id === settings.accountId)) select.value = settings.accountId;
    $("direct-form").hidden = false;
  } catch (e) {
    setStatus(describeError(e));
  }
}

$("post").addEventListener("click", async () => {
  const text = textEl.value.trim();
  if (!text) return setStatus(m("errEmpty"));
  const button = /** @type {HTMLButtonElement} */ ($("post"));
  button.disabled = true;
  setStatus(m("popupPosting"));
  const accountId = /** @type {HTMLSelectElement} */ ($("account")).value;
  const cw = /** @type {HTMLInputElement} */ ($("cw")).value.trim();
  try {
    await createNote({
      text,
      cw: cw || undefined,
      visibility: /** @type {HTMLSelectElement} */ ($("visibility")).value,
      accountId,
    });
    await saveSettings({ accountId });
    setStatus(m("popupPosted"));
    textEl.value = "";
  } catch (e) {
    setStatus(describeError(e));
  } finally {
    button.disabled = false;
  }
});
