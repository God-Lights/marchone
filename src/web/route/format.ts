import type { TravelMode } from "@marchone/engine";

export const MODE_META: Record<TravelMode, { icon: string; label: string }> = {
  walk: { icon: "🚶", label: "도보" },
  bike: { icon: "🚲", label: "자전거" },
  bus: { icon: "🚌", label: "버스" },
  train: { icon: "🚆", label: "기차" },
  ship: { icon: "⛴️", label: "배" },
  plane: { icon: "✈️", label: "비행기" },
};

export const MODE_COLOR: Record<TravelMode, string> = {
  walk: "var(--mode-walk)",
  bike: "var(--mode-bike)",
  bus: "var(--mode-bus)",
  train: "var(--mode-train)",
  ship: "var(--mode-ship)",
  plane: "var(--mode-plane)",
};

export function formatKm(m: number): string {
  const km = m / 1000;
  return km >= 100 ? `${Math.round(km).toLocaleString("ko-KR")}km` : `${km.toFixed(1)}km`;
}

export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return h > 0 ? `${d}일 ${h}시간` : `${d}일`;
  if (h > 0) return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  return `${m}분`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("ko-KR", { year: "numeric", month: "numeric", day: "numeric" });
}
