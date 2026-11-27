import { describe, expect, it } from "vitest";
import {
  PLACES, ROUTE_TEMPLATES, addStop, defaultModeBetween, elapsedToMoving, movingToElapsed,
  moveStop, normalizeDraft, placeById, removeStop, searchPlaces, setMode, summarizeRoute, validateRoute,
  positionAt, draftToLegs,
} from "./index";

const H = 3_600_000;

describe("places", () => {
  it("ids are unique and timezones valid", () => {
    expect(new Set(PLACES.map((p) => p.id)).size).toBe(PLACES.length);
    for (const p of PLACES) expect(() => new Intl.DateTimeFormat("en", { timeZone: p.tz })).not.toThrow();
  });
  it("search matches Korean and English", () => {
    expect(searchPlaces("부산")[0]?.id).toBe("busan");
    expect(searchPlaces("paris")[0]?.id).toBe("paris");
    expect(searchPlaces("일본").map((p) => p.id)).toEqual(["tokyo", "osaka"]);
  });
});

describe("rest cycle", () => {
  it("walking rests at night", () => {
    expect(movingToElapsed(10 * H, "walk")).toBe(10 * H);
    expect(movingToElapsed(15 * H, "walk")).toBe(29 * H);
    expect(movingToElapsed(15 * H, "train")).toBe(15 * H);
  });
  it("elapsedToMoving inverts and pauses at night", () => {
    expect(elapsedToMoving(29 * H, "walk")).toBe(15 * H);
    expect(elapsedToMoving(12 * H, "walk")).toBe(10 * H); // resting
    expect(elapsedToMoving(20 * H, "walk")).toBe(10 * H);
  });
  it("position does not move during rest", () => {
    const j = { startedAt: 0, timeScale: 1, legs: draftToLegs(normalizeDraft({ stops: ["seoul", "busan"], modes: ["walk"] })) };
    expect(positionAt(j, 11 * H).legProgress).toBeCloseTo(positionAt(j, 23 * H).legProgress, 10);
    expect(positionAt(j, 25 * H).legProgress).toBeGreaterThan(positionAt(j, 23 * H).legProgress);
  });
});

describe("draft editing", () => {
  it("default modes prefer walking on land, plane across oceans", () => {
    expect(defaultModeBetween(placeById("seoul")!, placeById("busan")!)).toBe("walk");
    expect(defaultModeBetween(placeById("seoul")!, placeById("london")!)).toBe("train");
    expect(defaultModeBetween(placeById("london")!, placeById("new-york")!)).toBe("plane");
    expect(defaultModeBetween(placeById("busan")!, placeById("osaka")!)).toBe("ship");
  });
  it("add / move / remove keep modes length consistent", () => {
    let d = normalizeDraft({ stops: [], modes: [] });
    d = addStop(addStop(addStop(d, "seoul"), "busan"), "osaka");
    expect(d.modes).toEqual(["walk", "ship"]);
    d = setMode(d, 0, "train");
    d = removeStop(d, 2);
    expect(d).toEqual({ stops: ["seoul", "busan"], modes: ["train"] });
    d = addStop(d, "tokyo");
    d = removeStop(d, 1); // merge seoul→busan→tokyo into seoul→tokyo
    expect(d).toEqual({ stops: ["seoul", "tokyo"], modes: ["ship"] });
    d = moveStop(d, 0, 1);
    expect(d.stops).toEqual(["tokyo", "seoul"]);
    expect(d.modes).toHaveLength(1);
  });
  it("normalize drops unknown places", () => {
    expect(normalizeDraft({ stops: ["seoul", "atlantis", "busan"], modes: [] }).stops).toEqual(["seoul", "busan"]);
  });
});

describe("validation & summary", () => {
  it("warns on land mode across sea and errors on duplicates", () => {
    const issues = validateRoute({ stops: ["seoul", "tokyo", "tokyo"], modes: ["walk", "train"] });
    expect(issues.map((i) => i.level)).toEqual(["warn", "error"]);
    expect(validateRoute({ stops: ["seoul"], modes: [] })[0]?.level).toBe("error");
  });
  it("summary sums legs; walking Seoul→Busan takes ~6 days", () => {
    const s = summarizeRoute(normalizeDraft({ stops: ["seoul", "busan"], modes: ["walk"] }));
    expect(s.totalDistanceM / 1000).toBeGreaterThan(315);
    expect(s.totalElapsedMs / (24 * H)).toBeGreaterThan(5);
    expect(s.totalElapsedMs / (24 * H)).toBeLessThan(7);
  });
  it("templates are valid", () => {
    for (const t of ROUTE_TEMPLATES) {
      expect(t.draft.stops.length).toBeGreaterThanOrEqual(2);
      expect(validateRoute(t.draft)).toEqual([]);
    }
  });
});
