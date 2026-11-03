// 設定は chrome.storage.local (トークンを同期領域に置かない)

export const DEFAULT_BASE_URL = "http://127.0.0.1:19820";

/** @returns {Promise<{ baseUrl: string, token: string, accountId: string }>} */
export async function loadSettings() {
  const s = await chrome.storage.local.get(["baseUrl", "token", "accountId"]);
  return {
    baseUrl: (s.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    token: s.token || "",
    accountId: s.accountId || "",
  };
}

/** @param {Partial<{ baseUrl: string, token: string, accountId: string }>} patch */
export async function saveSettings(patch) {
  await chrome.storage.local.set(patch);
}
