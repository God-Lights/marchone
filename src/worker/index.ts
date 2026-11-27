import { Hono } from "hono";
import { positionAt, type Journey } from "@marchone/engine";
import type { Env } from "./env";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true, service: "marchone", time: Date.now() }));

// Demo: engine runs identically on the server and the client.
app.get("/api/demo/position", (c) => {
  const journey: Journey = {
    startedAt: Date.UTC(2026, 0, 1),
    timeScale: 1,
    legs: [
      { from: { lat: 37.5665, lng: 126.978 }, to: { lat: 35.1796, lng: 129.0756 }, mode: "walk" },
    ],
  };
  return c.json(positionAt(journey, Date.now()));
});

app.notFound((c) => c.json({ error: "not_found" }, 404));

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
