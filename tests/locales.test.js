import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const locales = Object.fromEntries(
  readdirSync(new URL("../_locales", import.meta.url)).map((l) => [l, read(`_locales/${l}/messages.json`)]),
);
const en = locales.en;

describe("_locales", () => {
  it("全 locale で key が一致する", () => {
    for (const messages of Object.values(locales)) {
      expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
    }
  });
  it("全 locale で placeholder が一致する", () => {
    for (const messages of Object.values(locales)) {
      for (const key of Object.keys(en)) {
        expect(messages[key].placeholders ?? {}, key).toEqual(en[key].placeholders ?? {});
      }
    }
  });
  it("本文の $NAME$ は placeholders に定義がある", () => {
    for (const messages of Object.values(locales)) {
      for (const [key, { message, placeholders }] of Object.entries(messages)) {
        const used = [...message.matchAll(/\$([A-Za-z0-9_@]+)\$/g)].map((x) => x[1].toLowerCase());
        expect(used.sort(), key).toEqual(Object.keys(placeholders ?? {}).sort());
      }
    }
  });
  it("manifest と HTML / JS が参照する key が全部ある", () => {
    const sources = ["manifest.json", ...readdirSync(new URL("../src", import.meta.url)).map((f) => `src/${f}`)]
      .map((path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8"))
      .join("\n");
    const used = [...sources.matchAll(/__MSG_(\w+)__|data-i18n="(\w+)"|\bm\("(\w+)"/g)].map(
      (x) => x[1] ?? x[2] ?? x[3],
    );
    expect(used.length).toBeGreaterThan(0);
    for (const key of used) expect(Object.keys(en), key).toContain(key);
  });
});
