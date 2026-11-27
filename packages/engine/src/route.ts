import { haversine } from "./geo";
import { legDistanceM, legDurationMs, legElapsedMs } from "./movement";
import { placeById, type Place } from "./places";
import type { Leg, TravelMode } from "./types";

/** What the route editor edits: ordered stops + one mode per gap. */
export interface RouteDraft {
  stops: string[];
  /** modes[i] = mode from stops[i] to stops[i+1]; length = stops.length - 1 */
  modes: TravelMode[];
}

export const MAX_STOPS = 50;
export const LAND_MODES: readonly TravelMode[] = ["walk", "bike", "bus", "train"];
export const ALL_MODES: readonly TravelMode[] = ["walk", "bike", "bus", "train", "ship", "plane"];

/** Sensible default mode between two places (MarchOne prefers walking). */
export function defaultModeBetween(a: Place, b: Place): TravelMode {
  const km = haversine(a, b) / 1000;
  if (a.landmass === b.landmass) return km <= 1500 ? "walk" : "train";
  return km <= 1500 ? "ship" : "plane";
}

/** Drop unknown places and fix modes length (pads with defaults). */
export function normalizeDraft(d: RouteDraft): RouteDraft {
  const stops = d.stops.filter((id) => placeById(id)).slice(0, MAX_STOPS);
  const modes: TravelMode[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const m = d.modes[i];
    modes.push(m && ALL_MODES.includes(m) ? m : defaultModeBetween(placeById(stops[i]!)!, placeById(stops[i + 1]!)!));
  }
  return { stops, modes };
}

export function addStop(d: RouteDraft, id: string): RouteDraft {
  return normalizeDraft({ stops: [...d.stops, id], modes: d.modes });
}

export function removeStop(d: RouteDraft, index: number): RouteDraft {
  const stops = d.stops.filter((_, i) => i !== index);
  // Removing a stop merges its two adjacent gaps; recompute that gap's mode.
  const modes = d.modes.filter((_, i) => i !== index && i !== index - 1);
  const merged = index - 1;
  const next: (TravelMode | undefined)[] = [...modes];
  if (merged >= 0 && index < d.stops.length - 1) next.splice(merged, 0, undefined);
  return normalizeDraft({ stops, modes: next as TravelMode[] });
}

export function moveStop(d: RouteDraft, index: number, delta: -1 | 1): RouteDraft {
  const j = index + delta;
  if (j < 0 || j >= d.stops.length) return d;
  const stops = [...d.stops];
  [stops[index], stops[j]] = [stops[j]!, stops[index]!];
  // Order changed, so neighbouring gaps are new pairs → reset to defaults.
  return normalizeDraft({ stops, modes: [] });
}

export function setMode(d: RouteDraft, legIndex: number, mode: TravelMode): RouteDraft {
  const modes = [...d.modes];
  modes[legIndex] = mode;
  return { ...d, modes };
}

export function draftToLegs(d: RouteDraft): Leg[] {
  const legs: Leg[] = [];
  for (let i = 0; i < d.stops.length - 1; i++) {
    const a = placeById(d.stops[i]!);
    const b = placeById(d.stops[i + 1]!);
    if (!a || !b) continue;
    legs.push({ from: { lat: a.lat, lng: a.lng }, to: { lat: b.lat, lng: b.lng }, mode: d.modes[i] ?? defaultModeBetween(a, b) });
  }
  return legs;
}

export type IssueLevel = "error" | "warn";
export interface RouteIssue {
  level: IssueLevel;
  legIndex: number | null;
  message: string;
}

export function validateRoute(d: RouteDraft): RouteIssue[] {
  const issues: RouteIssue[] = [];
  if (d.stops.length < 2) issues.push({ level: "error", legIndex: null, message: "출발지와 도착지를 포함해 2곳 이상 필요해요." });
  for (let i = 0; i < d.stops.length - 1; i++) {
    const a = placeById(d.stops[i]!);
    const b = placeById(d.stops[i + 1]!);
    if (!a || !b) continue;
    const mode = d.modes[i];
    if (a.id === b.id) {
      issues.push({ level: "error", legIndex: i, message: "같은 장소가 연달아 있어요." });
    } else if (mode && LAND_MODES.includes(mode) && a.landmass !== b.landmass) {
      issues.push({ level: "warn", legIndex: i, message: "바다를 건너는 구간이에요. 배나 비행기를 고르세요." });
    }
  }
  return issues;
}

export interface LegSummary {
  from: Place;
  to: Place;
  mode: TravelMode;
  distanceM: number;
  movingMs: number;
  elapsedMs: number;
}

export interface RouteSummary {
  legs: LegSummary[];
  totalDistanceM: number;
  totalElapsedMs: number;
}

export function summarizeRoute(d: RouteDraft): RouteSummary {
  const legs: LegSummary[] = [];
  for (let i = 0; i < d.stops.length - 1; i++) {
    const from = placeById(d.stops[i]!);
    const to = placeById(d.stops[i + 1]!);
    if (!from || !to) continue;
    const mode = d.modes[i] ?? defaultModeBetween(from, to);
    const leg: Leg = { from, to, mode };
    legs.push({ from, to, mode, distanceM: legDistanceM(leg), movingMs: legDurationMs(leg), elapsedMs: legElapsedMs(leg) });
  }
  return {
    legs,
    totalDistanceM: legs.reduce((s, l) => s + l.distanceM, 0),
    totalElapsedMs: legs.reduce((s, l) => s + l.elapsedMs, 0),
  };
}

export interface RouteTemplate {
  id: string;
  name: string;
  description: string;
  draft: RouteDraft;
}

const tpl = (id: string, name: string, description: string, stops: string[]): RouteTemplate => ({
  id, name, description, draft: normalizeDraft({ stops, modes: [] }),
});

export const ROUTE_TEMPLATES: readonly RouteTemplate[] = [
  tpl("korea", "국토 행진", "서울에서 부산까지 걸어서", ["seoul", "busan"]),
  tpl("camino", "산티아고 순례길", "마드리드에서 산티아고 데 콤포스텔라까지", ["madrid", "santiago-de-compostela"]),
  tpl("silk-road", "실크로드", "베이징에서 이스탄불까지 대상의 길", ["beijing", "almaty", "samarkand", "tehran", "istanbul"]),
  tpl("eurasia", "유라시아 횡단", "서울에서 런던까지 육로로", ["seoul", "beijing", "ulaanbaatar", "moscow", "berlin", "paris", "london"]),
  tpl("world", "세계 일주", "6개 대륙을 한 바퀴", ["seoul", "tokyo", "honolulu", "los-angeles", "new-york", "london", "paris", "cairo", "dubai", "mumbai", "bangkok", "seoul"]),
];
