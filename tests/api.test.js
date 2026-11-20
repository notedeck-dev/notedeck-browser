import { afterEach, describe, expect, it, vi } from "vitest";
import { createNote, describeError, listAccounts, NoteDeckApiError } from "../src/api.js";

const chromeStub = {
  storage: { local: { get: async () => ({ token: "t" }) } },
  i18n: { getMessage: (k, subs) => (subs === undefined ? k : `${k}(${subs})`) },
};

function stub(response) {
  vi.stubGlobal("chrome", chromeStub);
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

describe("timeout", () => {
  it("確認を待たない呼び出しは signal を付け、時間切れは timeout にする", async () => {
    vi.stubGlobal("chrome", chromeStub);
    const fetchMock = vi.fn(async () => {
      throw new DOMException("timed out", "TimeoutError");
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(listAccounts()).rejects.toMatchObject({ code: "timeout" });
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it("notes.create は確認ダイアログを待つので signal を付けない", async () => {
    vi.stubGlobal("chrome", chromeStub);
    const fetchMock = vi.fn(async () => Response.json({ ok: true, result: { id: "n" } }));
    vi.stubGlobal("fetch", fetchMock);
    await createNote({ text: "x" });
    expect(fetchMock.mock.calls[0][1].signal).toBeUndefined();
  });
  it("接続できないときは unreachable のまま", async () => {
    vi.stubGlobal("chrome", chromeStub);
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(listAccounts()).rejects.toMatchObject({ code: "unreachable" });
  });
});

describe("describeError", () => {
  const err = (code, message = "detail") => new NoteDeckApiError(500, code, message);
  it("code ごとの文言", () => {
    vi.stubGlobal("chrome", chromeStub);
    expect(describeError(err("unreachable"))).toBe("errUnreachable");
    expect(describeError(err("timeout"))).toBe("errTimeout");
    expect(describeError(err("unauthorized"))).toBe("errUnauthorized");
    expect(describeError(err("permission_denied"))).toBe("errPermissionDenied detail");
    expect(describeError(err("user_cancelled"))).toBe("errCancelled");
    expect(describeError(err("bad_response"))).toBe("errBadResponse");
    expect(describeError(err("unknown_capability"))).toBe("errUnknownCapability");
    expect(describeError(err("preflight_failed"))).toBe("errPreflightFailed(detail)");
    expect(describeError(err("execute_failed"))).toBe("errExecuteFailed(detail)");
    expect(describeError(err("query_failed"))).toBe("errExecuteFailed(detail)");
  });
  it("知らない code と API 以外の例外はそのまま出す", () => {
    vi.stubGlobal("chrome", chromeStub);
    expect(describeError(err("http_error", "HTTP 500"))).toBe("NoteDeck: http_error: HTTP 500");
    expect(describeError(new Error("boom"))).toBe("NoteDeck: boom");
  });
});
