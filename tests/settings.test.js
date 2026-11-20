import { describe, expect, it } from "vitest";
import { isLoopbackUrl } from "../src/settings.js";

describe("isLoopbackUrl", () => {
  it("http の 127.0.0.1 / localhost だけ通す (host_permissions と同じ範囲)", () => {
    expect(isLoopbackUrl("http://127.0.0.1:19820")).toBe(true);
    expect(isLoopbackUrl("http://localhost:19821")).toBe(true);
    expect(isLoopbackUrl("http://127.0.0.1")).toBe(true);
  });
  it("それ以外は通さない", () => {
    expect(isLoopbackUrl("https://127.0.0.1:19820")).toBe(false);
    expect(isLoopbackUrl("http://192.168.1.10:19820")).toBe(false);
    expect(isLoopbackUrl("http://localhost.example.com:19820")).toBe(false);
    expect(isLoopbackUrl("http://example.com")).toBe(false);
    expect(isLoopbackUrl("127.0.0.1:19820")).toBe(false);
    expect(isLoopbackUrl("")).toBe(false);
  });
});
