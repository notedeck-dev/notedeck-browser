// notedeck:// リンクを開く。ページ側で location を書き換えるのが一番確実で、
// 外部プロトコルへの遷移はページを置き換えないのでタブはそのまま残る。
// それができないタブ (chrome:// など) では新しいタブで開く。

/**
 * @param {string} url notedeck:// リンク
 * @param {number | undefined} tabId 起点のタブ。無ければ新規タブ
 */
export async function openDeepLink(url, tabId) {
  if (tabId !== undefined) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (href) => {
          window.location.href = href;
        },
        args: [url],
      });
      return;
    } catch {
      // 注入できないページ (chrome:// / ストア / PDF ビューア) は下へ
    }
  }
  await chrome.tabs.create({ url });
}
