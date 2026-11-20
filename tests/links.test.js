import { describe, expect, it } from "vitest";
import {
  clipSelection,
  composeLink,
  composeText,
  deepLink,
  MAX_LINK_LENGTH,
  menuComposeText,
  noteLink,
  parseMisskeyUrl,
  userLink,
  userLookupTarget,
} from "../src/links.js";

describe("parseMisskeyUrl", () => {
  it("ノートの URL を host と id に分ける", () => {
    expect(parseMisskeyUrl("https://misskey.io/notes/9abcXYZ")).toEqual({
      kind: "note",
      host: "misskey.io",
      id: "9abcXYZ",
    });
    expect(parseMisskeyUrl("https://misskey.io/notes/9abcXYZ/")).toEqual({
      kind: "note",
      host: "misskey.io",
      id: "9abcXYZ",
    });
  });
  it("ユーザーの URL を host / username / リモート host に分ける", () => {
    expect(parseMisskeyUrl("https://misskey.io/@alice")).toEqual({
      kind: "user",
      host: "misskey.io",
      username: "alice",
      userHost: null,
    });
    expect(parseMisskeyUrl("https://misskey.io/@bob@yami.ski")).toEqual({
      kind: "user",
      host: "misskey.io",
      username: "bob",
      userHost: "yami.ski",
    });
  });
  it("host に port を含めない (本体は hostname で口座を探す)", () => {
    expect(parseMisskeyUrl("https://misskey.example:3000/notes/n1")).toEqual({
      kind: "note",
      host: "misskey.example",
      id: "n1",
    });
  });
  it("それ以外は null", () => {
    expect(parseMisskeyUrl("https://misskey.io/@alice/pages/x")).toBeNull();
    expect(parseMisskeyUrl("https://misskey.io/settings")).toBeNull();
    expect(parseMisskeyUrl("notedeck://compose")).toBeNull();
    expect(parseMisskeyUrl("not a url")).toBeNull();
  });
});

describe("deep links", () => {
  it("compose は本文を URL エンコードして渡す", () => {
    expect(composeLink("hello world\nhttps://x")).toBe("notedeck://compose?text=hello+world%0Ahttps%3A%2F%2Fx");
  });
  it("空の値は query に載せない", () => {
    expect(deepLink("compose", { text: "", cw: undefined })).toBe("notedeck://compose");
  });
  it("ノートとユーザーはサーバーつきのパスにする", () => {
    expect(noteLink({ kind: "note", host: "misskey.io", id: "n1" })).toBe("notedeck://misskey.io/note/n1");
    expect(userLink("misskey.io", "u1", "me1")).toBe("notedeck://misskey.io/user/u1?account=me1");
  });
});

describe("userLookupTarget", () => {
  const io = { id: "a-io", host: "misskey.io", userId: "me-io" };
  const yami = { id: "a-yami", host: "yami.ski", userId: "me-yami" };
  const alice = { kind: "user", host: "misskey.io", username: "alice", userHost: null };

  it("ページのサーバーの口座があればそれでローカルユーザーとして引く", () => {
    expect(userLookupTarget(alice, [yami, io], "a-yami")).toEqual({ account: io, host: undefined });
  });
  it("別サーバーの口座で引くときはページのサーバーを host に渡す", () => {
    expect(userLookupTarget(alice, [yami], "")).toEqual({ account: yami, host: "misskey.io" });
  });
  it("リモートユーザーのページは、そのユーザーのサーバーを host に渡す", () => {
    const bob = { ...alice, username: "bob", userHost: "yami.ski" };
    expect(userLookupTarget(bob, [io], "")).toEqual({ account: io, host: "yami.ski" });
    expect(userLookupTarget(bob, [yami], "")).toEqual({ account: yami, host: undefined });
  });
  it("どのサーバーにも口座が無ければ前回の口座、それも無ければ先頭", () => {
    const other = { id: "a-o", host: "other.example", userId: "me-o" };
    expect(userLookupTarget(alice, [other, yami], "a-yami").account).toBe(yami);
    expect(userLookupTarget(alice, [other, yami], "gone").account).toBe(other);
  });
  it("同じサーバーに口座が複数あれば前回の口座", () => {
    const io2 = { id: "a-io2", host: "misskey.io", userId: "me-io2" };
    expect(userLookupTarget(alice, [io, io2], "a-io2").account).toBe(io2);
  });
  it("トークンの無い口座は使わない。使える口座が無ければ null", () => {
    expect(userLookupTarget(alice, [{ ...io, hasToken: false }, yami], "").account).toBe(yami);
    expect(userLookupTarget(alice, [{ ...io, hasToken: false }], "")).toBeNull();
    expect(userLookupTarget(alice, [], "")).toBeNull();
  });
});

describe("composeText", () => {
  it("選択範囲があればそれと URL、無ければタイトルと URL", () => {
    expect(composeText({ title: "T", url: "https://x", selection: " quoted " })).toBe("quoted\nhttps://x");
    expect(composeText({ title: "T", url: "https://x" })).toBe("T\nhttps://x");
    expect(composeText({ url: "https://x" })).toBe("https://x");
    expect(composeText({})).toBe("");
  });
});

describe("リンクの長さの上限", () => {
  it("短い本文はそのまま", () => {
    expect(clipSelection("quoted", "https://x")).toBe("quoted");
    expect(composeLink("hello")).toBe("notedeck://compose?text=hello");
  });
  it("長い選択範囲は URL を残して切り詰め、末尾に … を付ける", () => {
    const url = "https://example.com/page";
    const clipped = clipSelection("あ".repeat(5000), url);
    expect(clipped.endsWith("…")).toBe(true);
    expect(clipped.length).toBeLessThan(5000);
    const link = composeLink(composeText({ selection: clipped, url }));
    expect(link.length).toBeLessThanOrEqual(MAX_LINK_LENGTH);
    expect(new URL(link).searchParams.get("text")).toBe(`${clipped}\n${url}`);
    // 上限いっぱいまで使う (1 文字 = 9 バイト分)
    expect(link.length).toBeGreaterThan(MAX_LINK_LENGTH - 10);
  });
  it("composeLink は長すぎる本文の末尾を切り詰める", () => {
    const link = composeLink("a".repeat(5000));
    expect(link.length).toBeLessThanOrEqual(MAX_LINK_LENGTH);
    expect(new URL(link).searchParams.get("text")?.endsWith("…")).toBe(true);
  });
  it("サロゲートペアの途中で切らない", () => {
    const text = new URL(composeLink("😀".repeat(1000))).searchParams.get("text") ?? "";
    expect(text).toMatch(/^(😀)+…$/u);
  });
});

describe("menuComposeText", () => {
  const info = { pageUrl: "https://p", selectionText: "sel", linkUrl: "https://l", srcUrl: "https://i" };
  it("メニューごとの本文", () => {
    expect(menuComposeText("compose-page", info, "Title")).toBe("Title\nhttps://p");
    expect(menuComposeText("compose-selection", info, "Title")).toBe("sel\nhttps://p");
    expect(menuComposeText("compose-link", info, "Title")).toBe("https://l");
    expect(menuComposeText("compose-image", info, "Title")).toBe("https://i");
  });
  it("投稿フォーム以外のメニューは null", () => {
    expect(menuComposeText("open-link", info, "Title")).toBeNull();
  });
});
