import type { JourneyState, Quest, QuestProgress, RouteDraft } from "@marchone/engine";

export interface Journey {
  id: string;
  status: "active" | "finished" | "abandoned";
  startedAt: number;
  timeScale: number;
  route: RouteDraft;
  traveler: { name: string; level: number; xp: number } | null;
  wallet: { currency: string; balance: number }[];
  refund: { pending: number };
  /** Encoded road path per leg (null = straight). */
  paths: (string | null)[];
  state: JourneyState;
  serverTime: number;
}

export interface Me {
  user: { id: string; name: string; isAnonymous: boolean; homeCurrency: string };
  passkeys: number;
}

export interface QuestBoardResponse {
  available: Quest[];
  active: (Quest & { progress: QuestProgress; acceptedAt: number })[];
  completed: (Quest & { completedAt: number })[];
  pendingRefund: number;
  maxActive: number;
}

export interface NextFunds {
  base: number;
  carry: number;
  overflow: number;
  total: number;
  currency: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, body.error ?? "요청에 실패했어요.");
  return body as T;
}

export const api = {
  me: () => call<Me>("/api/me"),
  currentJourney: () => call<{ journey: Journey | null }>("/api/journeys/current"),
  startJourney: (route: RouteDraft, travelerName?: string) =>
    call<{ journey: Journey }>("/api/journeys", { method: "POST", body: JSON.stringify({ route, travelerName }) }),
  resolveRoute: (route: RouteDraft, signal?: AbortSignal) =>
    call<{ legs: { distanceM: number; path: string | null; source: "road" | "direct" }[] }>("/api/journeys/resolve", {
      method: "POST", body: JSON.stringify({ route }), signal,
    }),
  nextFunds: () => call<NextFunds>("/api/journeys/next-funds"),
  quests: () => call<QuestBoardResponse>("/api/journeys/current/quests"),
  acceptQuest: (id: string) => call<{ ok: true }>(`/api/journeys/current/quests/${encodeURIComponent(id)}/accept`, { method: "POST" }),
  declineQuest: (id: string) => call<{ ok: true }>(`/api/journeys/current/quests/${encodeURIComponent(id)}/decline`, { method: "POST" }),
  abandonJourney: () => call<{ ok: true }>("/api/journeys/current/abandon", { method: "POST" }),
};
