import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createAuth } from "./auth";
import { GL_OFF_COOKIE, GL_SESSION_COOKIE, glConfig, glLoginUrl, isSameOriginWrite, verifyGlSession } from "./gl";
import { localUserForGl } from "./gl-link";
import { journeys } from "./journeys";
import type { AppEnv, SessionUser } from "./types";
import type { Env } from "./env";

const app = new Hono<AppEnv>();

app.get("/api/health", (c) => c.json({ ok: true, service: "marchone", time: Date.now() }));

// Public client config. The browser key is referrer-restricted in Google Cloud, so exposing it is expected.
app.get("/api/config", (c) => c.json({ mapsBrowserKey: c.env.GOOGLE_MAPS_BROWSER_KEY || null }));

app.use("/api/*", async (c, next) => {
  c.set("auth", createAuth(c.env, c.req.raw));
  await next();
});
// Better Auth handles /api/auth/* (guest sign-in, passkeys, sessions) with its own origin checks.
app.on(["GET", "POST"], "/api/auth/*", (c) => c.var.auth.handler(c.req.raw));

// gl_session is sent by every *.officialgl.com site: only our own pages may change state.
const sameOriginWrites = createMiddleware<AppEnv>(async (c, next) => {
  const cfg = glConfig(c.env);
  if (!isSameOriginWrite(c.req.method, c.req.header("Origin"), cfg.serviceOrigin, new URL(c.req.url).origin))
    return c.json({ error: "허용되지 않은 요청이에요." }, 403);
  await next();
});
app.use("/api/journeys/*", sameOriginWrites);
app.use("/api/journeys", sameOriginWrites);
app.use("/auth/*", sameOriginWrites);

/**
 * Who is calling: GL Account first (unless the user signed out here), then a MarchOne
 * session (guest/passkey). Never redirects — the UI shows a login button on 401.
 */
async function resolveUser(c: import("hono").Context<AppEnv>): Promise<SessionUser | null> {
  const db = c.env.DB;
  const signedOutHere = getCookie(c, GL_OFF_COOKIE) === "1";
  const gl = signedOutHere ? null : await verifyGlSession(glConfig(c.env), getCookie(c, GL_SESSION_COOKIE));
  if (gl) {
    const userId = await localUserForGl(db, gl, async () => {
      const s = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
      return s?.user.id ?? null;
    });
    const row = await db.prepare('SELECT name, "homeCurrency" AS homeCurrency FROM "user" WHERE id = ?').bind(userId)
      .first<{ name: string; homeCurrency: string | null }>();
    if (!row) return null;
    return {
      id: userId, name: gl.nickname || row.name, isAnonymous: false, homeCurrency: row.homeCurrency ?? "KRW",
      gl: { id: gl.id, nickname: gl.nickname, username: gl.username },
    };
  }
  if (signedOutHere) return null;
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
  return session ? { ...(session.user as SessionUser), gl: null } : null;
}

const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const user = await resolveUser(c);
  if (!user) return c.json({ error: "로그인이 필요해요." }, 401);
  c.set("user", user);
  await next();
});

app.get("/api/me", requireUser, async (c) => {
  const user = c.var.user;
  const passkeys = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM passkey WHERE "userId" = ?').bind(user.id).first<{ n: number }>();
  return c.json({
    user: { id: user.id, name: user.name, isAnonymous: Boolean(user.isAnonymous), homeCurrency: user.homeCurrency ?? "KRW" },
    gl: user.gl ? { nickname: user.gl.nickname, username: user.gl.username } : null,
    passkeys: passkeys?.n ?? 0,
  });
});

const cookieOpts = { httpOnly: true, secure: true, sameSite: "Lax", path: "/" } as const;

/** Login button target: forget a previous local sign-out, then go to GL's login screen. */
app.get("/auth/login", (c) => {
  deleteCookie(c, GL_OFF_COOKIE, cookieOpts);
  return c.redirect(glLoginUrl(glConfig(c.env)), 302);
});

/**
 * Sign out of MarchOne only. GL Account's own login is untouched, so we remember to ignore
 * gl_session on this browser until the login button is pressed again.
 */
app.post("/auth/logout", async (c) => {
  const auth = createAuth(c.env, c.req.raw);
  const res = await auth.api.signOut({ headers: c.req.raw.headers, asResponse: true }).catch(() => null);
  setCookie(c, GL_OFF_COOKIE, "1", { ...cookieOpts, maxAge: 60 * 60 * 24 * 400 });
  const out = c.json({ ok: true });
  res?.headers.getSetCookie().forEach((v) => out.headers.append("Set-Cookie", v));
  return out;
});

app.use("/api/journeys/*", requireUser);
app.use("/api/journeys", requireUser);
app.route("/api/journeys", journeys);

app.notFound((c) => c.json({ error: "not_found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "서버 오류가 났어요." }, 500);
});

export default {
  fetch: app.fetch,

  // Cron: "0 3 * * *" → refresh exchange rates; "*/5 * * * *" → dispatch meal notifications.
  async scheduled(controller: ScheduledController, _env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        if (controller.cron === "0 3 * * *") {
          // TODO: fetch Frankfurter rates → CACHE
        } else {
          // TODO: scan journey.next_notify_at <= now → Web Push
        }
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
