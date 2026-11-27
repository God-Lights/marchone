import { positionAt } from "./movement";
import { placeById, type Place } from "./places";
import { ALL_MODES, draftToLegs, MAX_STOPS, normalizeDraft, summarizeRoute, validateRoute, type RouteDraft } from "./route";
import type { Position, TravelMode } from "./types";

export interface JourneyState {
  position: Position;
  /** Leg currently being travelled (last leg when finished). */
  legIndex: number;
  from: Place;
  to: Place;
  mode: TravelMode;
  /** Timezone used for "local time" (nearer endpoint of the current leg). */
  timeZone: string;
  /** 0..1 over the whole route, by elapsed time. */
  overallProgress: number;
  arrivesAt: number;
  finished: boolean;
}

export function journeyState(route: RouteDraft, startedAt: number, timeScale: number, now: number): JourneyState {
  const legs = draftToLegs(route);
  const position = positionAt({ startedAt, timeScale, legs }, now);
  const i = position.legIndex;
  const from = placeById(route.stops[i]!)!;
  const to = placeById(route.stops[i + 1]!)!;
  const total = summarizeRoute(route).totalElapsedMs;
  const elapsed = Math.max(0, (now - startedAt) * timeScale);
  return {
    position,
    legIndex: i,
    from,
    to,
    mode: route.modes[i]!,
    timeZone: position.legProgress < 0.5 ? from.tz : to.tz,
    overallProgress: total === 0 ? 1 : Math.min(1, elapsed / total),
    arrivesAt: startedAt + total / timeScale,
    finished: position.finished,
  };
}

export type DraftParseResult = { ok: true; draft: RouteDraft } | { ok: false; error: string };

/** Validate untrusted input (API body) into a RouteDraft that the engine accepts. */
export function parseRouteDraft(input: unknown): DraftParseResult {
  if (!input || typeof input !== "object") return { ok: false, error: "route가 필요해요." };
  const { stops, modes } = input as { stops?: unknown; modes?: unknown };
  if (!Array.isArray(stops) || !stops.every((s) => typeof s === "string")) return { ok: false, error: "stops 형식이 올바르지 않아요." };
  if (!Array.isArray(modes) || !modes.every((m) => typeof m === "string" && (ALL_MODES as readonly string[]).includes(m)))
    return { ok: false, error: "modes 형식이 올바르지 않아요." };
  if (stops.length > MAX_STOPS) return { ok: false, error: `장소는 최대 ${MAX_STOPS}곳이에요.` };
  if (modes.length !== Math.max(0, stops.length - 1)) return { ok: false, error: "modes 개수는 stops보다 1 적어야 해요." };
  const unknown = stops.find((s) => !placeById(s));
  if (unknown) return { ok: false, error: `알 수 없는 장소: ${unknown}` };
  const draft = normalizeDraft({ stops, modes: modes as TravelMode[] });
  const err = validateRoute(draft).find((i) => i.level === "error");
  if (err) return { ok: false, error: err.message };
  return { ok: true, draft };
}

/**
 * While travelling, the past and the current leg are fixed; only what comes after
 * the current destination may change. Returns an error message or null.
 */
export function checkRouteChange(current: RouteDraft, next: RouteDraft, currentLeg: number): string | null {
  const lockedStops = current.stops.slice(0, currentLeg + 2);
  const lockedModes = current.modes.slice(0, currentLeg + 1);
  const same =
    lockedStops.every((s, i) => next.stops[i] === s) && lockedModes.every((m, i) => next.modes[i] === m);
  return same ? null : "지나온 구간과 지금 걷는 구간은 바꿀 수 없어요.";
}
