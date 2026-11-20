import { accountLabel, describeError, listAccounts } from "./api.js";
import { DEFAULT_BASE_URL, isLoopbackUrl, loadSettings, saveSettings } from "./settings.js";

const m = (k, subs) => chrome.i18n.getMessage(k, subs);
const $ = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));

for (const el of document.querySelectorAll("[data-i18n]")) {
  el.textContent = m(el.getAttribute("data-i18n"));
}

const settings = await loadSettings();
$("baseUrl").value = settings.baseUrl;
$("token").value = settings.token;
const setStatus = (s) => {
  $("status").textContent = s;
};

async function save() {
  const baseUrl = $("baseUrl").value.trim().replace(/\/+$/, "") || DEFAULT_BASE_URL;
  if (!isLoopbackUrl(baseUrl)) {
    setStatus(m("optionsBaseUrlInvalid"));
    return false;
  }
  await saveSettings({ baseUrl, token: $("token").value.trim() });
  return true;
}

$("save").addEventListener("click", async () => {
  if (await save()) setStatus(m("optionsSaved"));
});

$("check").addEventListener("click", async () => {
  if (!(await save())) return;
  try {
    const accounts = await listAccounts();
    setStatus(accounts.length ? m("optionsConnected", accounts.map(accountLabel).join(", ")) : m("optionsNoAccounts"));
  } catch (e) {
    setStatus(describeError(e));
  }
});
