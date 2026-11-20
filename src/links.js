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
  if (note) return { kind: "note", host: url.hostname, id: note[1] };
  const user = url.pathname.match(/^\/@([A-Za-z0-9_]+)(?:@([A-Za-z0-9.-]+))?\/?$/);
  if (user) return { kind: "user", host: url.hostname, username: user[1], userHost: user[2] ?? null };
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

// Windows の Chromium は 2048 文字を超える外部プロトコルの URL を開かないので、余裕を見た上限
export const MAX_LINK_LENGTH = 2000;

/**
 * `text + tail` を載せた compose リンクが上限に収まるよう text の末尾を切り、切ったら … を付ける。
 * 長さはエンコード後で決まる (日本語は 1 文字 9 バイト分) ので、収まる文字数を二分探索する。
 * @param {string} text
 * @param {string} tail
 */
function clip(text, tail) {
  const fits = (t) => deepLink("compose", { text: t + tail }).length <= MAX_LINK_LENGTH;
  if (fits(text)) return text;
  const chars = Array.from(text);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(`${chars.slice(0, mid).join("")}…`)) lo = mid;
    else hi = mid - 1;
  }
  return `${chars.slice(0, lo).join("")}…`;
}

/** @param {string} text */
export function composeLink(text) {
  return deepLink("compose", { text: clip(text, "") });
}

/**
 * 選択範囲を、後ろに続く URL ごとリンクに収まる長さにする (URL を削らないよう選択範囲の側を切る)。
 * @param {string} selection
 * @param {string | undefined} url
 */
export function clipSelection(selection, url) {
  return clip(selection.trim(), url ? `\n${url}` : "");
}

/** @param {{ kind: "note", host: string, id: string }} note */
export function noteLink(note) {
  return `notedeck://${note.host}/note/${encodeURIComponent(note.id)}`;
}

/**
 * user id は引いた口座のサーバーのものなので、その口座を `account` (口座の Misskey ユーザー id) で名指しする。
 * @param {string} host 引いた口座のサーバー
 * @param {string} userId
 * @param {string} accountUserId
 */
export function userLink(host, userId, accountUserId) {
  return `notedeck://${host}/user/${encodeURIComponent(userId)}?account=${encodeURIComponent(accountUserId)}`;
}

/**
 * ユーザーをどの口座で引くか、`user.lookup` に渡す host は何か。
 * ページのサーバー → ユーザーのサーバー → 前回使った口座 → 先頭、の順で口座を選ぶ。
 * 口座のサーバーのユーザーなら host は省略 (ローカル)、それ以外はリモートとして引く。
 * @template {{ id: string, host: string, hasToken?: boolean }} A
 * @param {{ host: string, userHost: string | null }} parsed
 * @param {A[]} accounts
 * @param {string} preferredAccountId
 * @returns {{ account: A, host: string | undefined } | null}
 */
export function userLookupTarget(parsed, accounts, preferredAccountId) {
  const usable = accounts.filter((a) => a.hasToken !== false);
  const preferred = usable.find((a) => a.id === preferredAccountId);
  const onHost = (h) => (preferred?.host === h ? preferred : usable.find((a) => a.host === h));
  const home = parsed.userHost ?? parsed.host;
  const account = onHost(parsed.host) ?? onHost(home) ?? preferred ?? usable[0];
  if (!account) return null;
  return { account, host: account.host === home ? undefined : home };
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

/**
 * 右クリックメニューから投稿フォームに渡す本文。投稿フォーム以外のメニューは null。
 * @param {string | number} menuItemId
 * @param {{ pageUrl?: string, selectionText?: string, linkUrl?: string, srcUrl?: string }} info
 * @param {string | undefined} title
 */
export function menuComposeText(menuItemId, info, title) {
  switch (menuItemId) {
    case "compose-page":
      return composeText({ title, url: info.pageUrl });
    case "compose-selection":
      return composeText({ selection: clipSelection(info.selectionText ?? "", info.pageUrl), url: info.pageUrl });
    case "compose-link":
      return composeText({ url: info.linkUrl });
    case "compose-image":
      return composeText({ url: info.srcUrl });
    default:
      return null;
  }
}
