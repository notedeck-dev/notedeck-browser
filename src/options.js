import { accountLabel, describeError, listAccounts } from "./api.js";
import { DEFAULT_BASE_URL, loadSettings, saveSettings } from "./settings.js";

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
  await saveSettings({
    baseUrl: $("baseUrl").value.trim().replace(/\/+$/, "") || DEFAULT_BASE_URL,
    token: $("token").value.trim(),
  });
}

$("save").addEventListener("click", async () => {
  await save();
  setStatus(m("optionsSaved"));
});

$("check").addEventListener("click", async () => {
  await save();
  try {
    const accounts = await listAccounts();
    setStatus(accounts.length ? m("optionsConnected", accounts.map(accountLabel).join(", ")) : m("optionsNoAccounts"));
  } catch (e) {
    setStatus(describeError(e));
  }
});
