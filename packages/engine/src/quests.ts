import { localParts } from "./time";
import { arrivalsBetween, distanceBetween, legTimeline, type LegTimeline, type TravelEvent } from "./timeline";
import type { RouteDraft } from "./route";
import type { TravelMode } from "./types";

/** [month, day] inclusive bounds in the place's local calendar. Windows may wrap the year. */
export type DayWindow = { from: [number, number]; to: [number, number] };

export type QuestCondition =
  | { kind: "visit"; places: string[]; count: number }
  | { kind: "visit-country"; country: string; count: number }
  | { kind: "border"; count: number }
  | { kind: "sea"; count: number }
  | { kind: "distance"; mode: TravelMode | "any"; km: number }
  | { kind: "festival"; country: string; window: DayWindow };

export interface Quest {
  id: string;
  title: string;
  /** Who asks (flavour). */
  giver: string;
  story: string;
  condition: QuestCondition;
  /** Refund credit in KRW, settled when the journey ends. */
  refund: number;
}

export const MAX_ACTIVE_QUESTS = 3;
export const COMPLETION_BONUS_RATE = 0.2;

export const QUESTS: readonly Quest[] = [
  {
    id: "first-border", title: "첫 국경", giver: "국경 검문소의 직원",
    story: "여권에 첫 도장이 찍히는 순간은 언제나 설레요. 다른 나라에 도착해 보세요.",
    condition: { kind: "border", count: 1 }, refund: 5_000,
  },
  {
    id: "five-borders", title: "다섯 나라의 도장", giver: "여권 수집가 레아",
    story: "여권이 도장으로 가득 찰수록 이야기도 늘어나요. 국경을 다섯 번 넘어 보세요.",
    condition: { kind: "border", count: 5 }, refund: 20_000,
  },
  {
    id: "first-sea", title: "수평선 너머", giver: "항구의 늙은 선원",
    story: "바다를 건너 본 사람만 아는 냄새가 있지. 다른 땅으로 건너가 보게.",
    condition: { kind: "sea", count: 1 }, refund: 8_000,
  },
  {
    id: "walk-100", title: "100km 행진", giver: "마치의 낡은 신발",
    story: "한 걸음씩 모이면 길이 돼요. 걸어서 100km를 가 보세요.",
    condition: { kind: "distance", mode: "walk", km: 100 }, refund: 10_000,
  },
  {
    id: "walk-500", title: "500km 행진", giver: "마치의 낡은 신발",
    story: "이제 발이 길을 기억해요. 걸어서 500km를 가 보세요.",
    condition: { kind: "distance", mode: "walk", km: 500 }, refund: 30_000,
  },
  {
    id: "rails-1000", title: "기차 창밖 1000km", giver: "식당칸의 승무원",
    story: "창밖 풍경이 바뀌는 걸 바라보는 것도 여행이에요. 기차로 1000km를 달려 보세요.",
    condition: { kind: "distance", mode: "train", km: 1000 }, refund: 10_000,
  },
  {
    id: "silk-road", title: "대상의 길", giver: "대상 상인 아이벡",
    story: "옛 상인들이 비단을 싣고 지나던 도시들이 있어요. 그중 세 곳에 들러 주세요.",
    condition: { kind: "visit", places: ["beijing", "almaty", "samarkand", "tehran", "istanbul"], count: 3 }, refund: 20_000,
  },
  {
    id: "camino", title: "순례자의 증서", giver: "순례자 숙소의 봉사자",
    story: "길 끝 대성당에 닿은 순례자에게는 증서를 드려요. 산티아고 데 콤포스텔라에 도착해 보세요.",
    condition: { kind: "visit", places: ["santiago-de-compostela"], count: 1 }, refund: 15_000,
  },
  {
    id: "channel", title: "해협 양쪽의 수도", giver: "카페 주인 클레르",
    story: "파리와 런던은 서로를 닮았으면서도 달라요. 두 도시 모두 들러 보세요.",
    condition: { kind: "visit", places: ["paris", "london"], count: 2 }, refund: 10_000,
  },
  {
    id: "cape", title: "희망의 곶", giver: "등대지기 타보",
    story: "아프리카 끝자락의 바람을 느껴 보세요. 케이프타운에 도착해 보세요.",
    condition: { kind: "visit", places: ["cape-town"], count: 1 }, refund: 12_000,
  },
  {
    id: "sakura", title: "벚꽃 아래에서", giver: "교토에서 온 편지",
    story: "봄이 오면 일본은 분홍빛이 돼요. 3월 25일부터 4월 15일 사이에 일본에 도착해 보세요.",
    condition: { kind: "festival", country: "일본", window: { from: [3, 25], to: [4, 15] } }, refund: 15_000,
  },
  {
    id: "dia-de-muertos", title: "망자의 날", giver: "마리골드를 파는 소녀",
    story: "주황빛 꽃길을 따라 그리운 이들을 맞이하는 날이에요. 10월 28일부터 11월 3일 사이에 멕시코에 도착해 보세요.",
    condition: { kind: "festival", country: "멕시코", window: { from: [10, 28], to: [11, 3] } }, refund: 15_000,
  },
  {
    id: "aurora", title: "오로라를 찾아서", giver: "북쪽 하늘을 그리는 화가",
    story: "긴 겨울밤에만 하늘이 춤을 춰요. 10월부터 3월 사이에 아이슬란드에 도착해 보세요.",
    condition: { kind: "festival", country: "아이슬란드", window: { from: [10, 1], to: [3, 31] } }, refund: 20_000,
  },
  {
    id: "roman-christmas", title: "로마의 크리스마스", giver: "광장의 악사",
    story: "성탄 무렵 로마의 골목은 노래로 가득해요. 12월 20일부터 26일 사이에 이탈리아에 도착해 보세요.",
    condition: { kind: "festival", country: "이탈리아", window: { from: [12, 20], to: [12, 26] } }, refund: 15_000,
  },
];

const byId = new Map(QUESTS.map((q) => [q.id, q]));
export function questById(id: string): Quest | undefined {
  return byId.get(id);
}

export function inWindow(month: number, day: number, w: DayWindow): boolean {
  const v = month * 100 + day;
  const a = w.from[0] * 100 + w.from[1];
  const b = w.to[0] * 100 + w.to[1];
  return a <= b ? v >= a && v <= b : v >= a || v <= b;
}

export interface QuestProgress {
  current: number;
  target: number;
  /** Time the target was reached, if within (t0, t1]. */
  completedAt: number | null;
}

/** Which arrivals count toward a quest, in order. Each returns the matching events. */
function matchingArrivals(c: QuestCondition, arrivals: TravelEvent[]): TravelEvent[] {
  switch (c.kind) {
    case "visit": {
      const seen = new Set<string>();
      return arrivals.filter((e) => c.places.includes(e.place.id) && !seen.has(e.place.id) && seen.add(e.place.id));
    }
    case "visit-country":
      return arrivals.filter((e) => e.place.country === c.country);
    case "border":
      return arrivals.filter((e) => e.place.country !== e.prev.country);
    case "sea":
      return arrivals.filter((e) => e.place.landmass !== e.prev.landmass);
    case "festival":
      return arrivals.filter((e) => {
        if (e.place.country !== c.country) return false;
        const { month, day } = localParts(e.at, e.place.tz);
        return inWindow(month, day, c.window);
      });
    case "distance":
      return [];
  }
}

function targetOf(c: QuestCondition): number {
  switch (c.kind) {
    case "visit": case "visit-country": case "border": case "sea": return c.count;
    case "festival": return 1;
    case "distance": return c.km;
  }
}

/** Progress made on a quest during (t0, t1] — t0 is when it was accepted. */
export function questProgress(
  quest: Quest, timeline: LegTimeline[], timeScale: number, t0: number, t1: number,
): QuestProgress {
  const c = quest.condition;
  const target = targetOf(c);
  if (c.kind === "distance") {
    const km = (t: number) => {
      const d = distanceBetween(timeline, timeScale, t0, t);
      return (c.mode === "any" ? Object.values(d).reduce((a, b) => a + b, 0) : d[c.mode]) / 1000;
    };
    const current = km(t1);
    if (current < target) return { current, target, completedAt: null };
    // Binary search the moment the distance was reached (deterministic, ms precision).
    let lo = t0, hi = t1;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (km(mid) >= target) hi = mid; else lo = mid;
    }
    return { current: target, target, completedAt: hi };
  }
  const hits = matchingArrivals(c, arrivalsBetween(timeline, t0, t1));
  const current = Math.min(hits.length, target);
  return { current, target, completedAt: hits.length >= target ? hits[target - 1]!.at : null };
}

/** Can the rest of the route (from `now`) still fulfil this quest if accepted now? */
export function questAvailable(quest: Quest, timeline: LegTimeline[], timeScale: number, now: number): boolean {
  const end = timeline.length ? timeline[timeline.length - 1]!.end : now;
  return end > now && questProgress(quest, timeline, timeScale, now, end).completedAt !== null;
}

export interface QuestRecord {
  questId: string;
  status: "accepted" | "completed" | "declined";
  acceptedAt: number | null;
  completedAt: number | null;
}

export interface QuestBoard {
  available: Quest[];
  active: (Quest & { progress: QuestProgress; acceptedAt: number })[];
  completed: (Quest & { completedAt: number })[];
  /** Quests that became complete during this evaluation (caller persists them). */
  newlyCompleted: { questId: string; completedAt: number; refund: number }[];
  pendingRefund: number;
}

/** Evaluate every quest lazily for one journey at `now`. */
export function questBoard(
  route: RouteDraft, startedAt: number, timeScale: number, records: QuestRecord[], now: number,
): QuestBoard {
  const timeline = legTimeline(route, startedAt, timeScale);
  const rec = new Map(records.map((r) => [r.questId, r]));
  const board: QuestBoard = { available: [], active: [], completed: [], newlyCompleted: [], pendingRefund: 0 };

  for (const q of QUESTS) {
    const r = rec.get(q.id);
    if (r?.status === "declined") continue;
    if (r?.status === "completed" && r.completedAt != null) {
      board.completed.push({ ...q, completedAt: r.completedAt });
      board.pendingRefund += q.refund;
      continue;
    }
    if (r?.status === "accepted" && r.acceptedAt != null) {
      const progress = questProgress(q, timeline, timeScale, r.acceptedAt, now);
      if (progress.completedAt !== null) {
        board.newlyCompleted.push({ questId: q.id, completedAt: progress.completedAt, refund: q.refund });
        board.completed.push({ ...q, completedAt: progress.completedAt });
        board.pendingRefund += q.refund;
      } else {
        board.active.push({ ...q, progress, acceptedAt: r.acceptedAt });
      }
      continue;
    }
    if (questAvailable(q, timeline, timeScale, now)) board.available.push(q);
  }
  board.completed.sort((a, b) => a.completedAt - b.completedAt);
  return board;
}

/** Refund settled at the end of a journey. */
export function settleRefund(pendingRefund: number, leftoverHomeCurrency: number, finished: boolean): number {
  const bonus = finished ? Math.round(pendingRefund * COMPLETION_BONUS_RATE) : 0;
  return Math.max(0, Math.round(pendingRefund + bonus + leftoverHomeCurrency));
}

/** How much of the unspent refunds carry into the next journey (cap: 50% of base funds). */
export function carryOver(unspentRefunds: number, baseFunds: number): { carry: number; overflow: number } {
  const cap = Math.floor(baseFunds * 0.5);
  const carry = Math.min(Math.max(0, unspentRefunds), cap);
  return { carry, overflow: Math.max(0, unspentRefunds - carry) };
}
