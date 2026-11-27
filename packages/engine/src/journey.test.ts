import { describe, expect, it } from "vitest";
import { checkRouteChange, journeyState, legElapsedMs, draftToLegs, parseRouteDraft } from "./index";

const route = { stops: ["seoul", "busan", "osaka"], modes: ["walk", "ship"] as const };
const draft = { stops: [...route.stops], modes: [...route.modes] };

describe("parseRouteDraft", () => {
  it("accepts a valid draft", () => {
    expect(parseRouteDraft(draft)).toEqual({ ok: true, draft });
  });
  it("rejects bad input", () => {
    expect(parseRouteDraft(null).ok).toBe(false);
    expect(parseRouteDraft({ stops: ["seoul"], modes: [] }).ok).toBe(false);
    expect(parseRouteDraft({ stops: ["seoul", "atlantis"], modes: ["walk"] }).ok).toBe(false);
    expect(parseRouteDraft({ stops: ["seoul", "busan"], modes: ["teleport"] }).ok).toBe(false);
    expect(parseRouteDraft({ stops: ["seoul", "busan"], modes: [] }).ok).toBe(false);
    expect(parseRouteDraft({ stops: ["seoul", "seoul"], modes: ["walk"] }).ok).toBe(false);
  });
});

describe("journeyState", () => {
  it("starts on the first leg and finishes at the end", () => {
    const s0 = journeyState(draft, 0, 1, 0);
    expect(s0.legIndex).toBe(0);
    expect(s0.from.id).toBe("seoul");
    expect(s0.timeZone).toBe("Asia/Seoul");
    const total = draftToLegs(draft).reduce((s, l) => s + legElapsedMs(l), 0);
    expect(s0.arrivesAt).toBeCloseTo(total, 0);
    const end = journeyState(draft, 0, 1, total + 1);
    expect(end.finished).toBe(true);
    expect(end.overallProgress).toBe(1);
    expect(end.to.id).toBe("osaka");
  });
});

describe("checkRouteChange", () => {
  it("allows changing what comes after the current destination", () => {
    expect(checkRouteChange(draft, { stops: ["seoul", "busan", "tokyo"], modes: ["walk", "ship"] }, 0)).toBeNull();
  });
  it("locks the current leg and the past", () => {
    expect(checkRouteChange(draft, { stops: ["seoul", "busan", "osaka"], modes: ["bike", "ship"] }, 0)).not.toBeNull();
    expect(checkRouteChange(draft, { stops: ["seoul", "osaka"], modes: ["ship"] }, 0)).not.toBeNull();
    expect(checkRouteChange(draft, { stops: ["seoul", "busan", "tokyo"], modes: ["walk", "ship"] }, 1)).not.toBeNull();
  });
});
