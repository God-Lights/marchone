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

export function legDistanceM(leg: Leg): number {
  return leg.path && leg.path.length > 1 ? pathLength(leg.path) : haversine(leg.from, leg.to);
}

export function legDurationMs(leg: Leg): number {
  return (legDistanceM(leg) / ((SPEED_KMH[leg.mode] * 1000) / 3_600_000));
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
    const dur = legDurationMs(leg);
    if (remaining < dur) {
      const t = dur === 0 ? 1 : remaining / dur;
      const p = leg.path && leg.path.length > 1 ? pointAlong(leg.path, t) : interpolate(leg.from, leg.to, t);
      return { ...p, legIndex: i, legProgress: t, finished: false };
    }
    remaining -= dur;
  }
  const last = legs[legs.length - 1]!;
  return { ...last.to, legIndex: legs.length - 1, legProgress: 1, finished: true };
}
