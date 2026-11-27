import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { createAuth } from "./auth";
import { journeys } from "./journeys";
import type { AppEnv, SessionUser } from "./types";
import type { Env } from "./env";

const app = new Hono<AppEnv>();

app.get("/api/health", (c) => c.json({ ok: true, service: "marchone", time: Date.now() }));

// Better Auth handles /api/auth/* (anonymous sign-in, passkeys, sessions).
app.use("/api/*", async (c, next) => {
  c.set("auth", createAuth(c.env, c.req.raw));
  await next();
});
app.on(["GET", "POST"], "/api/auth/*", (c) => c.var.auth.handler(c.req.raw));

const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "로그인이 필요해요." }, 401);
  c.set("user", session.user as SessionUser);
  await next();
});

app.get("/api/me", requireUser, async (c) => {
  const user = c.var.user;
  const passkeys = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM passkey WHERE "userId" = ?').bind(user.id).first<{ n: number }>();
  return c.json({
    user: { id: user.id, name: user.name, isAnonymous: Boolean(user.isAnonymous), homeCurrency: user.homeCurrency ?? "KRW" },
    passkeys: passkeys?.n ?? 0,
  });
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
