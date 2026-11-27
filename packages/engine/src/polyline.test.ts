import { describe, expect, it } from "vitest";
import {
  decodePolyline, encodePolyline, simplifyByStride, summarizeRoute, journeyState, legTimeline, setMode, normalizeDraft,
} from "./index";

describe("polyline", () => {
  it("decodes Google's reference example", () => {
    // https://developers.google.com/maps/documentation/utilities/polylinealgorithm
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      { lat: 38.5, lng: -120.2 }, { lat: 40.7, lng: -120.95 }, { lat: 43.252, lng: -126.453 },
    ]);
  });
  it("round-trips", () => {
    const pts = [{ lat: 37.5665, lng: 126.978 }, { lat: 35.1796, lng: 129.0756 }, { lat: -33.9249, lng: 18.4241 }];
    expect(decodePolyline(encodePolyline(pts))).toEqual(pts);
  });
  it("rejects truncated input", () => {
    expect(() => decodePolyline("_p~iF~ps|U_")).toThrow();
  });
  it("simplify keeps endpoints and bounds size", () => {
    const pts = Array.from({ length: 1000 }, (_, i) => ({ lat: i / 100, lng: 0 }));
    const s = simplifyByStride(pts, 100);
    expect(s.length).toBeLessThanOrEqual(101);
    expect(s[0]).toBe(pts[0]);
    expect(s[s.length - 1]).toBe(pts[999]);
  });
});

describe("road distances", () => {
  const route = { stops: ["seoul", "busan"], modes: ["walk" as const] };
  it("override changes duration, timeline and state consistently", () => {
    const straight = summarizeRoute(route);
    const road = summarizeRoute({ ...route, distances: [400_000] });
    expect(road.totalDistanceM).toBe(400_000);
    expect(road.totalElapsedMs).toBeGreaterThan(straight.totalElapsedMs);
    const tl = legTimeline({ ...route, distances: [400_000] }, 0, 1);
    expect(tl[0]!.end).toBeCloseTo(road.totalElapsedMs, 0);
    const s = journeyState({ ...route, distances: [400_000] }, 0, 1, road.totalElapsedMs - 1);
    expect(s.finished).toBe(false);
    expect(journeyState({ ...route, distances: [400_000] }, 0, 1, road.totalElapsedMs + 1).finished).toBe(true);
  });
  it("null distance falls back to great-circle; edits drop distances", () => {
    expect(summarizeRoute({ ...route, distances: [null] }).totalDistanceM).toBeCloseTo(summarizeRoute(route).totalDistanceM, 6);
    expect(setMode({ ...route, distances: [400_000] }, 0, "bike").distances).toBeUndefined();
    expect(normalizeDraft({ ...route, distances: [400_000] }).distances).toBeUndefined();
  });
});
