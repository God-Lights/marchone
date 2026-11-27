import type { JourneyState, RouteDraft } from "@marchone/engine";

export interface Journey {
  id: string;
  status: "active" | "finished" | "abandoned";
  startedAt: number;
  timeScale: number;
  route: RouteDraft;
  traveler: { name: string; level: number; xp: number } | null;
  wallet: { currency: string; balance: number }[];
  state: JourneyState;
  serverTime: number;
}

export interface Me {
  user: { id: string; name: string; isAnonymous: boolean; homeCurrency: string };
  passkeys: number;
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
  abandonJourney: () => call<{ ok: true }>("/api/journeys/current/abandon", { method: "POST" }),
};
