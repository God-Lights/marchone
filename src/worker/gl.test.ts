import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearGlCache, glConfig, glLoginUrl, isSameOriginWrite, verifyGlSession } from "./gl";

const cfg = glConfig({ GL_ACCOUNT_KEY: "svc-key", SERVICE_ORIGIN: "https://marchone.officialgl.com" });
const user = { id: "6f1c2c1e-0000-4000-8000-000000000001", email: "a@b.c", username: "machi", nickname: "마치", emailVerified: true };
const ok = () => new Response(JSON.stringify({ user }), { status: 200 });

beforeEach(() => clearGlCache());

describe("glLoginUrl", () => {
  it("returns to the fixed service origin, URL-encoded", () => {
    expect(glLoginUrl(cfg)).toBe("https://account.officialgl.com/?return=https%3A%2F%2Fmarchone.officialgl.com%2F");
  });
  it("ignores trailing slashes in config", () => {
    expect(glConfig({ SERVICE_ORIGIN: "https://x.officialgl.com/" }).serviceOrigin).toBe("https://x.officialgl.com");
  });
});

describe("verifyGlSession", () => {
  it("posts the token with the service key and returns the user", async () => {
    const f = vi.fn(async () => ok());
    expect(await verifyGlSession(cfg, "tok", f as unknown as typeof fetch)).toEqual(user);
    const [url, init] = f.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe("https://account.officialgl.com/api/internal/verify-session");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer svc-key");
    expect(JSON.parse(init.body as string)).toEqual({ token: "tok" });
  });
  it("401 → signed out", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 401 }));
    expect(await verifyGlSession(cfg, "tok", f as unknown as typeof fetch)).toBeNull();
  });
  it("no key or no cookie → no call, signed out", async () => {
    const f = vi.fn(async () => ok());
    expect(await verifyGlSession(glConfig({}), "tok", f as unknown as typeof fetch)).toBeNull();
    expect(await verifyGlSession(cfg, undefined, f as unknown as typeof fetch)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it("caches results for 30s only", async () => {
    const f = vi.fn(async () => ok());
    const t = 1_000_000;
    await verifyGlSession(cfg, "tok", f as unknown as typeof fetch, t);
    await verifyGlSession(cfg, "tok", f as unknown as typeof fetch, t + 29_000);
    expect(f).toHaveBeenCalledTimes(1);
    await verifyGlSession(cfg, "tok", f as unknown as typeof fetch, t + 31_000);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("caches 'signed out' too, but never caches errors", async () => {
    const t = 1_000_000;
    const e = vi.fn(async () => new Response("", { status: 500 }));
    expect(await verifyGlSession(cfg, "tok", e as unknown as typeof fetch, t)).toBeNull();
    const n = vi.fn(async () => { throw new TypeError("network"); });
    expect(await verifyGlSession(cfg, "tok", n as unknown as typeof fetch, t)).toBeNull();
    const f = vi.fn(async () => ok());
    expect(await verifyGlSession(cfg, "tok", f as unknown as typeof fetch, t)).toEqual(user); // not stuck on the error
  });
  it("rejects malformed responses", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ user: { email: "x" } }), { status: 200 }));
    expect(await verifyGlSession(cfg, "tok", f as unknown as typeof fetch)).toBeNull();
  });
  it("never logs the token or the key", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await verifyGlSession(cfg, "secret-token", (async () => { throw new Error("boom secret-token"); }) as unknown as typeof fetch);
    await verifyGlSession(cfg, "secret-token-2", (async () => new Response("", { status: 503 })) as unknown as typeof fetch);
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).not.toContain("secret-token");
    expect(logged).not.toContain("svc-key");
    spy.mockRestore();
  });
});

describe("isSameOriginWrite", () => {
  const svc = "https://marchone.officialgl.com";
  it("allows reads from anywhere and writes from our origin", () => {
    expect(isSameOriginWrite("GET", "https://evil.officialgl.com", svc, svc)).toBe(true);
    expect(isSameOriginWrite("POST", svc, svc, svc)).toBe(true);
  });
  it("blocks writes from sibling subdomains and missing Origin", () => {
    expect(isSameOriginWrite("POST", "https://other.officialgl.com", svc, svc)).toBe(false);
    expect(isSameOriginWrite("PUT", undefined, svc, svc)).toBe(false);
  });
});
