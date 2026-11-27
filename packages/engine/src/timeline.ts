import { SPEED_KMH, elapsedToMoving, legDistanceM, legElapsedMs } from "./movement";
import { placeById, type Place } from "./places";
import { draftToLegs, type RouteDraft } from "./route";
import type { TravelMode } from "./types";

export interface LegTimeline {
  legIndex: number;
  from: Place;
  to: Place;
  mode: TravelMode;
  /** Wall-clock start/end (epoch ms). */
  start: number;
  end: number;
  distanceM: number;
}

/** Start/end time of every leg. Pure: derived from (route, startedAt, timeScale). */
export function legTimeline(route: RouteDraft, startedAt: number, timeScale: number): LegTimeline[] {
  const legs = draftToLegs(route);
  let t = startedAt;
  return legs.map((leg, i) => {
    const start = t;
    const end = start + legElapsedMs(leg) / timeScale;
    t = end;
    return {
      legIndex: i,
      from: placeById(route.stops[i]!)!,
      to: placeById(route.stops[i + 1]!)!,
      mode: leg.mode,
      start,
      end,
      distanceM: legDistanceM(leg),
    };
  });
}

/** Fraction (0..1) of a leg completed at time t. */
function legFractionAt(leg: LegTimeline, t: number, timeScale: number): number {
  if (t <= leg.start) return 0;
  if (t >= leg.end) return 1;
  const moving = leg.distanceM / ((SPEED_KMH[leg.mode] * 1000) / 3_600_000);
  if (moving === 0) return 1;
  return Math.min(1, elapsedToMoving((t - leg.start) * timeScale, leg.mode) / moving);
}

/** Meters travelled per mode during [t0, t1]. */
export function distanceBetween(
  timeline: LegTimeline[], timeScale: number, t0: number, t1: number,
): Record<TravelMode, number> {
  const out: Record<TravelMode, number> = { walk: 0, bike: 0, bus: 0, train: 0, ship: 0, plane: 0 };
  if (t1 <= t0) return out;
  for (const leg of timeline) {
    if (leg.end <= t0 || leg.start >= t1) continue;
    out[leg.mode] += (legFractionAt(leg, t1, timeScale) - legFractionAt(leg, t0, timeScale)) * leg.distanceM;
  }
  return out;
}

export type TravelEvent =
  | { type: "arrive"; at: number; legIndex: number; place: Place; prev: Place; mode: TravelMode };

/** Arrivals at stops with arrival time in (t0, t1]. */
export function arrivalsBetween(timeline: LegTimeline[], t0: number, t1: number): TravelEvent[] {
  return timeline
    .filter((l) => l.end > t0 && l.end <= t1)
    .map((l) => ({ type: "arrive", at: l.end, legIndex: l.legIndex, place: l.to, prev: l.from, mode: l.mode }));
}
