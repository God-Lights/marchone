import { describe, expect, it } from "vitest";
import {
  QUESTS, carryOver, distanceBetween, inWindow, legTimeline, questAvailable, questBoard, questById,
  questProgress, settleRefund, placeById, type RouteDraft,
} from "./index";

const H = 3_600_000;
const D = 24 * H;
const T0 = Date.UTC(2027, 2, 20); // 2027-03-20 → Japan arrival in late March

// Seoul → Busan (walk) → Osaka (ship) → Tokyo (train)
const route: RouteDraft = { stops: ["seoul", "busan", "osaka", "tokyo"], modes: ["walk", "ship", "train"] };
const tl = legTimeline(route, T0, 1);
const end = tl[tl.length - 1]!.end;

describe("catalog", () => {
  it("ids unique, places exist, refunds positive", () => {
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length);
    for (const q of QUESTS) {
      expect(q.refund).toBeGreaterThan(0);
      if (q.condition.kind === "visit") for (const p of q.condition.places) expect(placeById(p)).toBeDefined();
    }
  });
});

describe("timeline", () => {
  it("legs are contiguous and walking distance accrues only while walking", () => {
    expect(tl[1]!.start).toBe(tl[0]!.end);
    const d = distanceBetween(tl, 1, T0, end);
    expect(d.walk / 1000).toBeCloseTo(tl[0]!.distanceM / 1000, 3);
    expect(d.ship).toBeCloseTo(tl[1]!.distanceM, 0);
    // night rest: hours 10..24 of day one add nothing
    const night = distanceBetween(tl, 1, T0 + 11 * H, T0 + 23 * H);
    expect(night.walk).toBe(0);
  });
});

describe("questProgress", () => {
  it("border: first arrival in another country (Osaka)", () => {
    const p = questProgress(questById("first-border")!, tl, 1, T0, end);
    expect(p.completedAt).toBe(tl[1]!.end);
  });
  it("sea: Busan → Osaka changes landmass", () => {
    expect(questProgress(questById("first-sea")!, tl, 1, T0, end).completedAt).toBe(tl[1]!.end);
  });
  it("walk-100 completes mid-leg at the exact moment", () => {
    const p = questProgress(questById("walk-100")!, tl, 1, T0, end);
    expect(p.completedAt).not.toBeNull();
    const at = p.completedAt!;
    expect(distanceBetween(tl, 1, T0, at).walk / 1000).toBeGreaterThanOrEqual(100);
    expect(distanceBetween(tl, 1, T0, at - 1).walk / 1000).toBeLessThan(100);
  });
  it("only counts progress after acceptance", () => {
    const p = questProgress(questById("first-border")!, tl, 1, tl[1]!.end + 1, end);
    expect(p.completedAt).toBeNull(); // Tokyo is the same country as Osaka
  });
  it("festival: sakura when arriving in Japan in late March", () => {
    expect(questProgress(questById("sakura")!, tl, 1, T0, end).completedAt).not.toBeNull();
    const summer = legTimeline(route, Date.UTC(2027, 6, 1), 1);
    expect(questProgress(questById("sakura")!, summer, 1, Date.UTC(2027, 6, 1), Infinity).completedAt).toBeNull();
  });
  it("year-wrapping windows", () => {
    expect(inWindow(12, 31, { from: [10, 1], to: [3, 31] })).toBe(true);
    expect(inWindow(2, 1, { from: [10, 1], to: [3, 31] })).toBe(true);
    expect(inWindow(6, 1, { from: [10, 1], to: [3, 31] })).toBe(false);
  });
});

describe("questBoard", () => {
  it("offers only quests the remaining route can fulfil", () => {
    const b = questBoard(route, T0, 1, [], T0);
    const ids = b.available.map((q) => q.id);
    expect(ids).toEqual(expect.arrayContaining(["first-border", "first-sea", "walk-100", "sakura"]));
    expect(ids).not.toContain("camino");
    expect(ids).not.toContain("walk-500");
    // after the walking leg is over, walk-100 is no longer offered
    expect(questBoard(route, T0, 1, [], tl[0]!.end).available.map((q) => q.id)).not.toContain("walk-100");
  });
  it("accepted → completed lazily, declined hidden, refund summed", () => {
    const recs = [
      { questId: "first-border", status: "accepted" as const, acceptedAt: T0, completedAt: null },
      { questId: "walk-100", status: "accepted" as const, acceptedAt: T0, completedAt: null },
      { questId: "first-sea", status: "declined" as const, acceptedAt: null, completedAt: null },
    ];
    const mid = questBoard(route, T0, 1, recs, T0 + D);
    expect(mid.active.map((q) => q.id).sort()).toEqual(["first-border", "walk-100"]);
    expect(mid.available.map((q) => q.id)).not.toContain("first-sea");
    const done = questBoard(route, T0, 1, recs, end);
    expect(done.newlyCompleted.map((q) => q.questId).sort()).toEqual(["first-border", "walk-100"]);
    expect(done.pendingRefund).toBe(15_000);
  });
});

describe("refund", () => {
  it("bonus only when finished; carry capped at 50%", () => {
    expect(settleRefund(10_000, 5_000, true)).toBe(17_000);
    expect(settleRefund(10_000, 5_000, false)).toBe(15_000);
    expect(carryOver(300_000, 1_000_000)).toEqual({ carry: 300_000, overflow: 0 });
    expect(carryOver(800_000, 1_000_000)).toEqual({ carry: 500_000, overflow: 300_000 });
  });
});

describe("questAvailable", () => {
  it("is false once the journey is over", () => {
    expect(questAvailable(questById("first-border")!, tl, 1, end + 1)).toBe(false);
  });
});
