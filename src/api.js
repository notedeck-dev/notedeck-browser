// NoteDeck の内蔵 HTTP API (既定 127.0.0.1:19820) の薄いクライアント。
// 認証は Bearer トークン (NoteDeck の 権限設定 → API トークン で発行)。
// 拡張機能は host_permissions があれば CORS の制約を受けない。
import { loadSettings } from "./settings.js";

export class NoteDeckApiError extends Error {
  /** @param {number} status @param {string} code @param {string} message */
  constructor(status, code, message) {
    super(message);
    this.name = "NoteDeckApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * @template T
 * @param {"GET" | "POST"} method
 * @param {string} path
 * @param {unknown} [body]
 * @returns {Promise<T>}
 */
async function request(method, path, body) {
  const { baseUrl, token } = await loadSettings();
  let res;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    // 接続できない = NoteDeck が起動していない (または URL / ポート違い)
    throw new NoteDeckApiError(0, "unreachable", e instanceof Error ? e.message : String(e));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = typeof data.code === "string" ? data.code : res.status === 401 ? "unauthorized" : "http_error";
    const message = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    throw new NoteDeckApiError(res.status, code, message);
  }
  return data;
}

/**
 * `POST /api/capabilities/{id}/execute` → `result`
 * @template T
 * @param {string} capabilityId
 * @param {Record<string, unknown>} [params]
 * @returns {Promise<T>}
 */
export async function execute(capabilityId, params) {
  const data = await request("POST", `/api/capabilities/${encodeURIComponent(capabilityId)}/execute`, params ?? {});
  return data.result;
}

/** @returns {Promise<Array<{ id: string, host: string, username: string, displayName: string | null }>>} */
export function listAccounts() {
  return execute("account.list");
}

/** @param {{ text: string, cw?: string, visibility?: string, accountId?: string }} params */
export function createNote(params) {
  return execute("notes.create", params);
}

/**
 * `@user` / `@user@remote` を Misskey 内部の user ID に引く。
 * @param {{ username: string, host?: string, accountId?: string }} params
 * @returns {Promise<{ id: string }>}
 */
export function lookupUser(params) {
  return execute("user.lookup", params);
}

/** @param {{ id: string, host: string, username: string, displayName: string | null }} a */
export function accountLabel(a) {
  const handle = `@${a.username}@${a.host}`;
  return a.displayName ? `${a.displayName} (${handle})` : handle;
}

/** 人向けのエラー文 (i18n 済み) */
export function describeError(e) {
  const m = (k) => chrome.i18n.getMessage(k);
  if (!(e instanceof NoteDeckApiError)) return `NoteDeck: ${e instanceof Error ? e.message : String(e)}`;
  switch (e.code) {
    case "unreachable":
      return m("errUnreachable");
    case "unauthorized":
      return m("errUnauthorized");
    case "permission_denied":
      return `${m("errPermissionDenied")} ${e.message}`;
    case "user_cancelled":
      return m("errCancelled");
    default:
      return `NoteDeck: ${e.code}: ${e.message}`;
  }
}
