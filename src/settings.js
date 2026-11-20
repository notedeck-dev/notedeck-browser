// 設定は chrome.storage.local (トークンを同期領域に置かない)

export const DEFAULT_BASE_URL = "http://127.0.0.1:19820";

/**
 * host_permissions (http の 127.0.0.1 / localhost) に入る URL か。それ以外は fetch できない。
 * @param {string} input
 */
export function isLoopbackUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    return false;
  }
  return url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
}

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
