import { describe, expect, it } from "vitest";
import { haversine, interpolate, legDurationMs, openMealSlot, positionAt, type Journey } from "./index";

const seoul = { lat: 37.5665, lng: 126.978 };
const busan = { lat: 35.1796, lng: 129.0756 };

describe("geo", () => {
  it("haversine Seoul-Busan ≈ 325km", () => {
    expect(haversine(seoul, busan) / 1000).toBeGreaterThan(315);
    expect(haversine(seoul, busan) / 1000).toBeLessThan(335);
  });
  it("interpolate endpoints", () => {
    const a = interpolate(seoul, busan, 0);
    const b = interpolate(seoul, busan, 1);
    expect(a.lat).toBeCloseTo(seoul.lat, 4);
    expect(b.lng).toBeCloseTo(busan.lng, 4);
  });
});

describe("movement", () => {
  const journey: Journey = {
    startedAt: 1_000_000,
    timeScale: 1,
    legs: [{ from: seoul, to: busan, mode: "train" }],
  };
  it("starts at origin", () => {
    const p = positionAt(journey, 1_000_000);
    expect(p.lat).toBeCloseTo(seoul.lat, 3);
    expect(p.finished).toBe(false);
  });
  it("is halfway at half duration", () => {
    const p = positionAt(journey, 1_000_000 + legDurationMs(journey.legs[0]!) / 2);
    expect(p.legProgress).toBeCloseTo(0.5, 5);
  });
  it("finishes at destination", () => {
    const p = positionAt(journey, 1_000_000 + legDurationMs(journey.legs[0]!) + 1);
    expect(p.finished).toBe(true);
    expect(p.lat).toBeCloseTo(busan.lat, 4);
  });
  it("time scale accelerates", () => {
    const fast = { ...journey, timeScale: 10 };
    const t = 1_000_000 + legDurationMs(journey.legs[0]!) / 10;
    expect(positionAt(fast, t).finished).toBe(false);
    expect(positionAt(fast, t + 10).finished).toBe(true);
  });
});

describe("time", () => {
  it("detects lunch window in local time", () => {
    // 2026-03-01T03:30Z = 12:30 in Asia/Seoul
    expect(openMealSlot(Date.UTC(2026, 2, 1, 3, 30), "Asia/Seoul")).toBe("lunch");
    expect(openMealSlot(Date.UTC(2026, 2, 1, 3, 30), "Europe/Paris")).toBeNull();
  });
});
