/**
 * GL Account (account.officialgl.com) — cookie mode (method A) for *.officialgl.com services.
 * GL issues `gl_session` (Domain=.officialgl.com); we verify it server-side with our service key.
 * Never log or return the session token or the service key.
 */

export interface GlUser {
  id: string;
  email: string;
  username: string;
  nickname: string;
  emailVerified: boolean;
}

export interface GlConfig {
  accountOrigin: string;
  /** This service's fixed origin (never derived from the Host header). */
  serviceOrigin: string;
  key: string | undefined;
}

export const GL_SESSION_COOKIE = "gl_session";
/** Set by our logout: ignore gl_session until the user presses the login button again. */
export const GL_OFF_COOKIE = "mo_gl_off";
const CACHE_MS = 30_000;
const CACHE_MAX = 2_000;

export function glConfig(env: { GL_ACCOUNT_ORIGIN?: string; SERVICE_ORIGIN?: string; GL_ACCOUNT_KEY?: string }): GlConfig {
  return {
    accountOrigin: (env.GL_ACCOUNT_ORIGIN ?? "https://account.officialgl.com").replace(/\/$/, ""),
    serviceOrigin: (env.SERVICE_ORIGIN ?? "https://marchone.officialgl.com").replace(/\/$/, ""),
    key: env.GL_ACCOUNT_KEY || undefined,
  };
}

/** GL login screen; GL sends the user back to `returnTo` (https + allowed domain only). */
export function glLoginUrl(cfg: GlConfig, returnTo = `${cfg.serviceOrigin}/`): string {
  return `${cfg.accountOrigin}/?return=${encodeURIComponent(returnTo)}`;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isGlUser(u: unknown): u is GlUser {
  if (!u || typeof u !== "object") return false;
  const o = u as Record<string, unknown>;
  return typeof o.id === "string" && o.id.length > 0 && typeof o.emailVerified === "boolean";
}

/** Per-isolate cache keyed by the token's hash (≤ 30s, as GL requires ≤ 60s). */
const cache = new Map<string, { user: GlUser | null; exp: number }>();
export function clearGlCache() {
  cache.clear();
}

/**
 * Verify a gl_session token. Returns the user, or null when signed out / unverifiable.
 * Network errors and non-401 failures are not cached, so they are retried on the next request.
 */
export async function verifyGlSession(
  cfg: GlConfig, token: string | undefined, fetchImpl: typeof fetch = fetch, now = Date.now(),
): Promise<GlUser | null> {
  if (!cfg.key || !token) return null;
  const k = await sha256Hex(token);
  const hit = cache.get(k);
  if (hit && hit.exp > now) return hit.user;

  let res: Response;
  try {
    res = await fetchImpl(`${cfg.accountOrigin}/api/internal/verify-session`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {
    console.warn("gl verify-session: network error");
    return null;
  }

  let user: GlUser | null = null;
  if (res.status === 200) {
    const body = (await res.json().catch(() => null)) as { user?: unknown } | null;
    if (!isGlUser(body?.user)) {
      console.warn("gl verify-session: unexpected response shape");
      return null;
    }
    const u = body.user as GlUser;
    user = { id: u.id, email: u.email ?? "", username: u.username ?? "", nickname: u.nickname ?? "", emailVerified: u.emailVerified };
  } else if (res.status !== 401) {
    console.warn("gl verify-session: status", res.status);
    return null;
  }
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(k, { user, exp: now + CACHE_MS });
  return user;
}

/**
 * The GL cookie is shared by every *.officialgl.com site, so state-changing API calls must come
 * from our own pages. Requests without an Origin header (non-browser) are rejected too.
 */
export function isSameOriginWrite(method: string, origin: string | undefined, serviceOrigin: string, requestOrigin: string): boolean {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;
  return origin === serviceOrigin || origin === requestOrigin;
}
