import { Hono } from "hono";
import {
  checkRouteChange, journeyState, legDistanceM, draftToLegs, parseRouteDraft, type RouteDraft, type TravelMode,
} from "@marchone/engine";
import type { AppEnv } from "./types";

export const DEFAULT_STARTING_FUNDS = 1_000_000;
const MAX_STARTING_FUNDS = 1_000_000_000;

interface JourneyRow {
  id: string;
  user_id: string;
  started_at: number;
  time_scale: number;
  status: "active" | "finished" | "abandoned";
}

async function loadRoute(db: D1Database, journeyId: string): Promise<RouteDraft> {
  const { results } = await db
    .prepare("SELECT from_place, to_place, mode FROM leg WHERE journey_id = ? ORDER BY seq")
    .bind(journeyId)
    .all<{ from_place: string; to_place: string; mode: TravelMode }>();
  if (results.length === 0) return { stops: [], modes: [] };
  return {
    stops: [results[0]!.from_place, ...results.map((r) => r.to_place)],
    modes: results.map((r) => r.mode),
  };
}

function legInserts(db: D1Database, journeyId: string, route: RouteDraft) {
  const legs = draftToLegs(route);
  return legs.map((leg, seq) =>
    db
      .prepare("INSERT INTO leg (journey_id, seq, from_place, to_place, mode, distance_m) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(journeyId, seq, route.stops[seq]!, route.stops[seq + 1]!, leg.mode, legDistanceM(leg)),
  );
}

async function loadCurrent(db: D1Database, userId: string) {
  const row = await db
    .prepare("SELECT id, user_id, started_at, time_scale, status FROM journey WHERE user_id = ? AND status = 'active'")
    .bind(userId)
    .first<JourneyRow>();
  if (!row) return null;
  const now = Date.now();
  const route = await loadRoute(db, row.id);
  const state = journeyState(route, row.started_at, row.time_scale, now);
  if (state.finished) {
    // Arrived: close it lazily so a new journey can start.
    await db.prepare("UPDATE journey SET status = 'finished' WHERE id = ?").bind(row.id).run();
    row.status = "finished";
  }
  await db.prepare("UPDATE journey SET last_seen_at = ? WHERE id = ?").bind(now, row.id).run();
  const [traveler, wallet] = await Promise.all([
    db.prepare("SELECT name, level, xp, stat_stamina, stat_mood, stat_curiosity, stat_culture FROM traveler WHERE journey_id = ?")
      .bind(row.id).first(),
    db.prepare("SELECT currency, balance FROM wallet WHERE journey_id = ? ORDER BY currency").bind(row.id).all(),
  ]);
  return {
    id: row.id,
    status: row.status,
    startedAt: row.started_at,
    timeScale: row.time_scale,
    route,
    traveler,
    wallet: wallet.results,
    state,
    serverTime: now,
  };
}

export const journeys = new Hono<AppEnv>()
  .get("/current", async (c) => {
    const journey = await loadCurrent(c.env.DB, c.var.user.id);
    return c.json({ journey });
  })

  .post("/", async (c) => {
    const body = await c.req.json<{ route?: unknown; travelerName?: unknown; startingFunds?: unknown }>().catch(() => null);
    const parsed = parseRouteDraft(body?.route);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);

    const name = typeof body?.travelerName === "string" && body.travelerName.trim() ? body.travelerName.trim().slice(0, 20) : "마치";
    const funds = body?.startingFunds ?? DEFAULT_STARTING_FUNDS;
    if (typeof funds !== "number" || !Number.isFinite(funds) || funds < 0 || funds > MAX_STARTING_FUNDS)
      return c.json({ error: "시작 자금은 0 이상 10억 이하여야 해요." }, 400);

    const db = c.env.DB;
    const user = c.var.user;
    const active = await db.prepare("SELECT id FROM journey WHERE user_id = ? AND status = 'active'").bind(user.id).first();
    if (active) return c.json({ error: "이미 진행 중인 여정이 있어요." }, 409);

    const id = crypto.randomUUID();
    const now = Date.now();
    const currency = user.homeCurrency ?? "KRW";
    try {
      await db.batch([
        db.prepare("INSERT INTO journey (id, user_id, started_at, time_scale, status, created_at, last_seen_at) VALUES (?, ?, ?, 1, 'active', ?, ?)")
          .bind(id, user.id, now, now, now),
        ...legInserts(db, id, parsed.draft),
        db.prepare("INSERT INTO traveler (journey_id, name, stats_at) VALUES (?, ?, ?)").bind(id, name, now),
        db.prepare("INSERT INTO wallet (journey_id, currency, balance) VALUES (?, ?, ?)").bind(id, currency, funds),
        db.prepare("INSERT INTO txn (id, journey_id, ts, type, currency, amount) VALUES (?, ?, ?, 'starting_funds', ?, ?)")
          .bind(crypto.randomUUID(), id, now, currency, funds),
      ]);
    } catch (e) {
      // Unique index on active journeys: a concurrent request won the race.
      if (String(e).includes("UNIQUE")) return c.json({ error: "이미 진행 중인 여정이 있어요." }, 409);
      throw e;
    }
    return c.json({ journey: await loadCurrent(db, user.id) }, 201);
  })

  .put("/current/route", async (c) => {
    const body = await c.req.json<{ route?: unknown }>().catch(() => null);
    const parsed = parseRouteDraft(body?.route);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);

    const db = c.env.DB;
    const current = await loadCurrent(db, c.var.user.id);
    if (!current || current.status !== "active") return c.json({ error: "진행 중인 여정이 없어요." }, 404);
    const lockError = checkRouteChange(current.route, parsed.draft, current.state.legIndex);
    if (lockError) return c.json({ error: lockError }, 409);

    await db.batch([db.prepare("DELETE FROM leg WHERE journey_id = ?").bind(current.id), ...legInserts(db, current.id, parsed.draft)]);
    return c.json({ journey: await loadCurrent(db, c.var.user.id) });
  })

  .post("/current/abandon", async (c) => {
    const res = await c.env.DB
      .prepare("UPDATE journey SET status = 'abandoned' WHERE user_id = ? AND status = 'active'")
      .bind(c.var.user.id)
      .run();
    if (res.meta.changes === 0) return c.json({ error: "진행 중인 여정이 없어요." }, 404);
    return c.json({ ok: true });
  });
