import { Hono } from "hono";
import {
  MAX_ACTIVE_QUESTS, carryOver, checkRouteChange, draftToLegs, journeyState, legDistanceM, legTimeline,
  parseRouteDraft, questAvailable, questBoard, questById, settleRefund,
  type QuestRecord, type RouteDraft, type TravelMode,
} from "@marchone/engine";
import { legPath, resolveRoute, type ResolvedLeg } from "./routes";
import type { Env } from "./env";
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

/** Route with the distances fixed at departure (road distance when resolved, else great-circle). */
type StoredRoute = RouteDraft & { distances: number[]; road: boolean[] };

async function loadRoute(db: D1Database, journeyId: string): Promise<StoredRoute> {
  const { results } = await db
    .prepare("SELECT from_place, to_place, mode, distance_m, polyline_key FROM leg WHERE journey_id = ? ORDER BY seq")
    .bind(journeyId)
    .all<{ from_place: string; to_place: string; mode: TravelMode; distance_m: number; polyline_key: string | null }>();
  if (results.length === 0) return { stops: [], modes: [], distances: [], road: [] };
  return {
    stops: [results[0]!.from_place, ...results.map((r) => r.to_place)],
    modes: results.map((r) => r.mode),
    distances: results.map((r) => r.distance_m),
    /** Whether the leg's distance was fixed from a road route (then we may draw the road path). */
    road: results.map((r) => r.polyline_key === "road"),
  };
}

/** Insert legs; `resolved[i]` (if given) fixes that leg's distance, otherwise great-circle. */
function legInserts(db: D1Database, journeyId: string, route: RouteDraft, resolved: (ResolvedLeg | null)[] = []) {
  return draftToLegs(route).map((leg, seq) =>
    db
      .prepare("INSERT INTO leg (journey_id, seq, from_place, to_place, mode, polyline_key, distance_m) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(
        journeyId, seq, route.stops[seq]!, route.stops[seq + 1]!, leg.mode,
        resolved[seq]?.source === "road" ? "road" : null,
        resolved[seq]?.distanceM ?? legDistanceM(leg),
      ),
  );
}

/** Encoded road paths for drawing (null = straight). Only legs whose distance came from a road route. */
async function routePaths(env: Env, route: StoredRoute): Promise<(string | null)[]> {
  return Promise.all(route.modes.map((m, i) => (route.road[i] ? legPath(env, m, route.stops[i]!, route.stops[i + 1]!) : null)));
}

async function activeRow(db: D1Database, userId: string) {
  return db
    .prepare("SELECT id, user_id, started_at, time_scale, status FROM journey WHERE user_id = ? AND status = 'active'")
    .bind(userId)
    .first<JourneyRow>();
}

async function questRecords(db: D1Database, journeyId: string): Promise<QuestRecord[]> {
  const { results } = await db
    .prepare("SELECT quest_id, status, accepted_at, completed_at FROM quest_progress WHERE journey_id = ?")
    .bind(journeyId)
    .all<{ quest_id: string; status: QuestRecord["status"]; accepted_at: number | null; completed_at: number | null }>();
  return results.map((r) => ({ questId: r.quest_id, status: r.status, acceptedAt: r.accepted_at, completedAt: r.completed_at }));
}

/** Evaluate quests lazily and persist newly completed ones (credit goes to the refund ledger, not the wallet). */
async function evaluateQuests(db: D1Database, row: JourneyRow, route: RouteDraft, currency: string, now: number) {
  const board = questBoard(route, row.started_at, row.time_scale, await questRecords(db, row.id), now);
  for (const q of board.newlyCompleted) {
    const res = await db
      .prepare("UPDATE quest_progress SET status = 'completed', completed_at = ? WHERE journey_id = ? AND quest_id = ? AND status = 'accepted'")
      .bind(q.completedAt, row.id, q.questId)
      .run();
    // Only the request that flipped the status credits the refund (no double credit under concurrency).
    if (res.meta.changes === 1) {
      await db
        .prepare("INSERT INTO txn (id, journey_id, ts, type, currency, amount, ref_id) VALUES (?, ?, ?, 'refund_pending', ?, ?, ?)")
        .bind(crypto.randomUUID(), row.id, q.completedAt, currency, q.refund, q.questId)
        .run();
    }
  }
  return board;
}

/** Close a journey: settle pending refunds + leftover home-currency balance into the refund ledger. */
async function settle(db: D1Database, journeyId: string, currency: string, finished: boolean, now: number) {
  const already = await db.prepare("SELECT 1 FROM txn WHERE journey_id = ? AND type = 'refund_settled'").bind(journeyId).first();
  if (already) return;
  const pending = await db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS n FROM txn WHERE journey_id = ? AND type = 'refund_pending'")
    .bind(journeyId).first<{ n: number }>();
  // TODO: re-exchange foreign currencies at the live rate once exchange exists.
  const leftover = await db
    .prepare("SELECT COALESCE(SUM(balance), 0) AS n FROM wallet WHERE journey_id = ? AND currency = ?")
    .bind(journeyId, currency).first<{ n: number }>();
  const amount = settleRefund(pending?.n ?? 0, leftover?.n ?? 0, finished);
  await db
    .prepare("INSERT INTO txn (id, journey_id, ts, type, currency, amount) VALUES (?, ?, ?, 'refund_settled', ?, ?)")
    .bind(crypto.randomUUID(), journeyId, now, currency, amount)
    .run();
}

async function pendingRefund(db: D1Database, journeyId: string) {
  const r = await db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS n FROM txn WHERE journey_id = ? AND type = 'refund_pending'")
    .bind(journeyId).first<{ n: number }>();
  return r?.n ?? 0;
}

/** Settled refunds from past journeys not yet carried into a new one. */
async function unspentRefunds(db: D1Database, userId: string) {
  const { results } = await db
    .prepare(
      `SELECT t.journey_id, t.amount FROM txn t JOIN journey j ON j.id = t.journey_id
       WHERE j.user_id = ? AND t.type = 'refund_settled'
         AND NOT EXISTS (SELECT 1 FROM txn c WHERE c.type = 'refund_carry' AND c.ref_id = t.journey_id)`,
    )
    .bind(userId)
    .all<{ journey_id: string; amount: number }>();
  return { rows: results, total: results.reduce((s, r) => s + r.amount, 0) };
}

async function loadCurrent(env: Env, userId: string, currency: string) {
  const db = env.DB;
  const row = await activeRow(db, userId);
  if (!row) return null;
  const now = Date.now();
  const route = await loadRoute(db, row.id);
  const state = journeyState(route, row.started_at, row.time_scale, now);
  await evaluateQuests(db, row, route, currency, now);
  if (state.finished) {
    // Arrived: settle and close lazily so a new journey can start.
    await settle(db, row.id, currency, true, now);
    await db.prepare("UPDATE journey SET status = 'finished' WHERE id = ?").bind(row.id).run();
    row.status = "finished";
  }
  await db.prepare("UPDATE journey SET last_seen_at = ? WHERE id = ?").bind(now, row.id).run();
  const [traveler, wallet, refund] = await Promise.all([
    db.prepare("SELECT name, level, xp, stat_stamina, stat_mood, stat_curiosity, stat_culture FROM traveler WHERE journey_id = ?")
      .bind(row.id).first(),
    db.prepare("SELECT currency, balance FROM wallet WHERE journey_id = ? ORDER BY currency").bind(row.id).all(),
    pendingRefund(db, row.id),
  ]);
  return {
    id: row.id,
    status: row.status,
    startedAt: row.started_at,
    timeScale: row.time_scale,
    route,
    traveler,
    wallet: wallet.results,
    refund: { pending: refund },
    paths: await routePaths(env, route),
    state,
    serverTime: now,
  };
}

export const journeys = new Hono<AppEnv>()
  .get("/current", async (c) => {
    const journey = await loadCurrent(c.env, c.var.user.id, c.var.user.homeCurrency ?? "KRW");
    return c.json({ journey });
  })

  /** Preview of the next journey's starting funds (base + carried refund). */
  .get("/next-funds", async (c) => {
    const { total } = await unspentRefunds(c.env.DB, c.var.user.id);
    const { carry, overflow } = carryOver(total, DEFAULT_STARTING_FUNDS);
    return c.json({ base: DEFAULT_STARTING_FUNDS, carry, overflow, total: DEFAULT_STARTING_FUNDS + carry, currency: c.var.user.homeCurrency ?? "KRW" });
  })

  .post("/", async (c) => {
    const body = await c.req.json<{ route?: unknown; travelerName?: unknown; startingFunds?: unknown }>().catch(() => null);
    const parsed = parseRouteDraft(body?.route);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);

    const name = typeof body?.travelerName === "string" && body.travelerName.trim() ? body.travelerName.trim().slice(0, 20) : "마치";
    const base = body?.startingFunds ?? DEFAULT_STARTING_FUNDS;
    if (typeof base !== "number" || !Number.isFinite(base) || base < 0 || base > MAX_STARTING_FUNDS)
      return c.json({ error: "시작 자금은 0 이상 10억 이하여야 해요." }, 400);

    const db = c.env.DB;
    const user = c.var.user;
    if (await activeRow(db, user.id)) return c.json({ error: "이미 진행 중인 여정이 있어요." }, 409);

    const id = crypto.randomUUID();
    const now = Date.now();
    const currency = user.homeCurrency ?? "KRW";
    const unspent = await unspentRefunds(db, user.id);
    const resolved = await resolveRoute(c.env, parsed.draft.stops, parsed.draft.modes);
    const { carry, overflow } = carryOver(unspent.total, DEFAULT_STARTING_FUNDS);
    const txn = (type: string, amount: number, ref: string | null = null) =>
      db.prepare("INSERT INTO txn (id, journey_id, ts, type, currency, amount, ref_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), id, now, type, currency, amount, ref);
    try {
      await db.batch([
        db.prepare("INSERT INTO journey (id, user_id, started_at, time_scale, status, created_at, last_seen_at) VALUES (?, ?, ?, 1, 'active', ?, ?)")
          .bind(id, user.id, now, now, now),
        ...legInserts(db, id, parsed.draft, resolved),
        db.prepare("INSERT INTO traveler (journey_id, name, stats_at) VALUES (?, ?, ?)").bind(id, name, now),
        db.prepare("INSERT INTO wallet (journey_id, currency, balance) VALUES (?, ?, ?)").bind(id, currency, base + carry),
        txn("starting_funds", base),
        // Mark every past settlement as consumed; only `carry` of it reaches the wallet.
        ...unspent.rows.map((r) => txn("refund_carry", r.amount, r.journey_id)),
        ...(overflow > 0 ? [txn("refund_overflow", overflow)] : []),
      ]);
    } catch (e) {
      // Unique index on active journeys: a concurrent request won the race.
      if (String(e).includes("UNIQUE")) return c.json({ error: "이미 진행 중인 여정이 있어요." }, 409);
      throw e;
    }
    return c.json({ journey: await loadCurrent(c.env, user.id, currency), carry, overflow }, 201);
  })

  .put("/current/route", async (c) => {
    const body = await c.req.json<{ route?: unknown }>().catch(() => null);
    const parsed = parseRouteDraft(body?.route);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);

    const db = c.env.DB;
    const currency = c.var.user.homeCurrency ?? "KRW";
    const current = await loadCurrent(c.env, c.var.user.id, currency);
    if (!current || current.status !== "active") return c.json({ error: "진행 중인 여정이 없어요." }, 404);
    const lockError = checkRouteChange(current.route, parsed.draft, current.state.legIndex);
    if (lockError) return c.json({ error: lockError }, 409);

    // Locked legs (past + current) keep the distance fixed at departure so the position never jumps;
    // only the new future legs are resolved.
    const locked = current.state.legIndex + 1;
    const future = await resolveRoute(c.env, parsed.draft.stops.slice(locked), parsed.draft.modes.slice(locked));
    const resolved: (ResolvedLeg | null)[] = parsed.draft.modes.map((_, i) =>
      i < locked
      ? { distanceM: current.route.distances[i]!, path: null, source: current.route.road[i] ? "road" : "direct" }
      : future[i - locked]!,
    );
    await db.batch([db.prepare("DELETE FROM leg WHERE journey_id = ?").bind(current.id), ...legInserts(db, current.id, parsed.draft, resolved)]);
    return c.json({ journey: await loadCurrent(c.env, c.var.user.id, currency) });
  })

  .post("/current/abandon", async (c) => {
    const db = c.env.DB;
    const row = await activeRow(db, c.var.user.id);
    if (!row) return c.json({ error: "진행 중인 여정이 없어요." }, 404);
    const now = Date.now();
    const currency = c.var.user.homeCurrency ?? "KRW";
    // No penalty: quests done so far and the leftover balance are still settled (no completion bonus).
    await evaluateQuests(db, row, await loadRoute(db, row.id), currency, now);
    await settle(db, row.id, currency, false, now);
    await db.prepare("UPDATE journey SET status = 'abandoned' WHERE id = ?").bind(row.id).run();
    return c.json({ ok: true });
  })

  /** Road distances/paths for a draft (editor preview). Cached per leg in KV. */
  .post("/resolve", async (c) => {
    const body = await c.req.json<{ route?: unknown }>().catch(() => null);
    const parsed = parseRouteDraft(body?.route);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const legs = await resolveRoute(c.env, parsed.draft.stops, parsed.draft.modes);
    return c.json({ legs });
  })

  .get("/current/quests", async (c) => {
    const db = c.env.DB;
    const row = await activeRow(db, c.var.user.id);
    if (!row) return c.json({ error: "진행 중인 여정이 없어요." }, 404);
    const route = await loadRoute(db, row.id);
    const board = await evaluateQuests(db, row, route, c.var.user.homeCurrency ?? "KRW", Date.now());
    const { newlyCompleted: _n, ...rest } = board;
    return c.json({ ...rest, maxActive: MAX_ACTIVE_QUESTS });
  })

  .post("/current/quests/:questId/accept", async (c) => {
    const db = c.env.DB;
    const quest = questById(c.req.param("questId"));
    if (!quest) return c.json({ error: "없는 부탁이에요." }, 404);
    const row = await activeRow(db, c.var.user.id);
    if (!row) return c.json({ error: "진행 중인 여정이 없어요." }, 404);

    const records = await questRecords(db, row.id);
    const existing = records.find((r) => r.questId === quest.id);
    if (existing?.status === "accepted" || existing?.status === "completed") return c.json({ error: "이미 받은 부탁이에요." }, 409);
    if (records.filter((r) => r.status === "accepted").length >= MAX_ACTIVE_QUESTS)
      return c.json({ error: `부탁은 동시에 ${MAX_ACTIVE_QUESTS}개까지 들 수 있어요.` }, 409);

    const now = Date.now();
    const route = await loadRoute(db, row.id);
    if (!questAvailable(quest, legTimeline(route, row.started_at, row.time_scale), row.time_scale, now))
      return c.json({ error: "남은 루트로는 이룰 수 없는 부탁이에요." }, 409);

    await db
      .prepare(
        `INSERT INTO quest_progress (journey_id, quest_id, status, accepted_at) VALUES (?, ?, 'accepted', ?)
         ON CONFLICT (journey_id, quest_id) DO UPDATE SET status = 'accepted', accepted_at = excluded.accepted_at, completed_at = NULL`,
      )
      .bind(row.id, quest.id, now)
      .run();
    return c.json({ ok: true }, 201);
  })

  .post("/current/quests/:questId/decline", async (c) => {
    const db = c.env.DB;
    const quest = questById(c.req.param("questId"));
    if (!quest) return c.json({ error: "없는 부탁이에요." }, 404);
    const row = await activeRow(db, c.var.user.id);
    if (!row) return c.json({ error: "진행 중인 여정이 없어요." }, 404);
    const res = await db
      .prepare(
        `INSERT INTO quest_progress (journey_id, quest_id, status) VALUES (?, ?, 'declined')
         ON CONFLICT (journey_id, quest_id) DO UPDATE SET status = 'declined', accepted_at = NULL
         WHERE quest_progress.status != 'completed'`,
      )
      .bind(row.id, quest.id)
      .run();
    if (res.meta.changes === 0) return c.json({ error: "이미 이룬 부탁이에요." }, 409);
    return c.json({ ok: true });
  });
