// 純ロジック: Misskey の URL の解釈と notedeck:// リンクの組み立て。ブラウザ API に触れない (vitest で検査)。

/**
 * Misskey の Web UI の URL を分解する。
 * - `https://host/notes/<id>` → { kind: "note", host, id }
 * - `https://host/@user` / `https://host/@user@remote` → { kind: "user", host, username, userHost }
 * それ以外は null。
 * @param {string} input
 * @returns {{ kind: "note", host: string, id: string } | { kind: "user", host: string, username: string, userHost: string | null } | null}
 */
export function parseMisskeyUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const note = url.pathname.match(/^\/notes\/([A-Za-z0-9]+)\/?$/);
  if (note) return { kind: "note", host: url.host, id: note[1] };
  const user = url.pathname.match(/^\/@([A-Za-z0-9_]+)(?:@([A-Za-z0-9.-]+))?\/?$/);
  if (user) return { kind: "user", host: url.host, username: user[1], userHost: user[2] ?? null };
  return null;
}

/**
 * `notedeck://` リンク。トークンも権限も要らない (本人がリンクを踏んだ扱い)。
 * @param {string} path
 * @param {Record<string, string | undefined>} [params]
 */
export function deepLink(path, params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== "") qs.set(k, v);
  }
  const q = qs.toString();
  return `notedeck://${path}${q ? `?${q}` : ""}`;
}

/** @param {string} text */
export function composeLink(text) {
  return deepLink("compose", { text });
}

/** @param {{ kind: "note", host: string, id: string }} note */
export function noteLink(note) {
  return `notedeck://${note.host}/note/${encodeURIComponent(note.id)}`;
}

/** @param {string} host @param {string} userId */
export function userLink(host, userId) {
  return `notedeck://${host}/user/${encodeURIComponent(userId)}`;
}

/**
 * 投稿フォームに渡す本文。選択範囲があればそれを先頭に、ページのタイトルと URL を続ける。
 * @param {{ title?: string, url?: string, selection?: string }} src
 */
export function composeText({ title, url, selection }) {
  const parts = [];
  const sel = selection?.trim();
  if (sel) parts.push(sel);
  const t = title?.trim();
  if (t && !sel) parts.push(t);
  if (url) parts.push(url);
  return parts.join("\n");
}
