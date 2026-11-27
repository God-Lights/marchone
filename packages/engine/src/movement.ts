import { haversine, pathLength, pointAlong, interpolate } from "./geo";
import type { Journey, Leg, Position, TravelMode } from "./types";

/** Default speeds in km/h. */
export const SPEED_KMH: Record<TravelMode, number> = {
  walk: 5,
  bike: 15,
  bus: 50,
  train: 90,
  ship: 30,
  plane: 800,
};

/**
 * Hours per day the traveler actually moves. Walking/cycling stops for the night
 * (rest at camp); vehicles run continuously.
 */
export const ACTIVE_HOURS_PER_DAY: Record<TravelMode, number> = {
  walk: 10,
  bike: 10,
  bus: 24,
  train: 24,
  ship: 24,
  plane: 24,
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function legDistanceM(leg: Leg): number {
  return leg.path && leg.path.length > 1 ? pathLength(leg.path) : haversine(leg.from, leg.to);
}

/** Pure moving time (no rest), ms. */
export function legDurationMs(leg: Leg): number {
  return legDistanceM(leg) / ((SPEED_KMH[leg.mode] * 1000) / HOUR);
}

/** Moving time → wall-clock time, inserting nightly rest. */
export function movingToElapsed(movingMs: number, mode: TravelMode): number {
  const active = ACTIVE_HOURS_PER_DAY[mode] * HOUR;
  if (active >= DAY) return movingMs;
  if (movingMs <= 0) return 0;
  // A leg ending exactly at the end of an active window finishes that day, not after the night.
  const days = Math.ceil(movingMs / active) - 1;
  return days * DAY + (movingMs - days * active);
}

/** Wall-clock time since leg start → moving time accomplished. */
export function elapsedToMoving(elapsedMs: number, mode: TravelMode): number {
  const active = ACTIVE_HOURS_PER_DAY[mode] * HOUR;
  if (active >= DAY) return elapsedMs;
  const days = Math.floor(elapsedMs / DAY);
  return days * active + Math.min(elapsedMs - days * DAY, active);
}

/** Wall-clock time to complete the leg, including rest, ms. */
export function legElapsedMs(leg: Leg): number {
  return movingToElapsed(legDurationMs(leg), leg.mode);
}

/**
 * Pure function: where is the traveler at `now`?
 * No state is stored; the position is derived from (journey, now).
 */
export function positionAt(journey: Journey, now: number): Position {
  const { legs } = journey;
  if (legs.length === 0) throw new Error("journey has no legs");
  let remaining = Math.max(0, (now - journey.startedAt) * journey.timeScale);
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i]!;
    const elapsed = legElapsedMs(leg);
    if (remaining < elapsed) {
      const moving = legDurationMs(leg);
      const t = moving === 0 ? 1 : Math.min(1, elapsedToMoving(remaining, leg.mode) / moving);
      const p = leg.path && leg.path.length > 1 ? pointAlong(leg.path, t) : interpolate(leg.from, leg.to, t);
      return { ...p, legIndex: i, legProgress: t, finished: false };
    }
    remaining -= elapsed;
  }
  const last = legs[legs.length - 1]!;
  return { ...last.to, legIndex: legs.length - 1, legProgress: 1, finished: true };
}
