import { describe, expect, it } from "vitest";
import { composeLink, composeText, deepLink, noteLink, parseMisskeyUrl, userLink } from "../src/links.js";

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
    expect(userLink("misskey.io", "u1")).toBe("notedeck://misskey.io/user/u1");
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
