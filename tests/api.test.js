import { afterEach, describe, expect, it, vi } from "vitest";
import { listAccounts } from "../src/api.js";

function stub(response) {
  vi.stubGlobal("chrome", { storage: { local: { get: async () => ({ token: "t" }) } } });
  vi.stubGlobal("fetch", async () => response);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("execute", () => {
  it("result を返す", async () => {
    stub(Response.json({ ok: true, result: [] }));
    await expect(listAccounts()).resolves.toEqual([]);
  });
  it("200 でも JSON でなければ bad_response", async () => {
    stub(new Response("<html></html>", { status: 200 }));
    await expect(listAccounts()).rejects.toMatchObject({ code: "bad_response" });
  });
  it("200 でも result が無ければ bad_response", async () => {
    stub(Response.json({ hello: "world" }));
    await expect(listAccounts()).rejects.toMatchObject({ code: "bad_response" });
    stub(Response.json(null));
    await expect(listAccounts()).rejects.toMatchObject({ code: "bad_response" });
  });
  it("エラー応答は code を引き継ぐ", async () => {
    stub(Response.json({ ok: false, code: "permission_denied", error: "notes.write" }, { status: 403 }));
    await expect(listAccounts()).rejects.toMatchObject({ code: "permission_denied", status: 403 });
    stub(Response.json({ error: "UNAUTHORIZED", message: "x" }, { status: 401 }));
    await expect(listAccounts()).rejects.toMatchObject({ code: "unauthorized" });
  });
});
