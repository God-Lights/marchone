import { useEffect, useState } from "react";
import { normalizeDraft, ROUTE_TEMPLATES, type RouteDraft } from "@marchone/engine";

const KEY = "marchone.routeDraft.v1";

function load(): RouteDraft {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalizeDraft(JSON.parse(raw) as RouteDraft);
  } catch {
    /* storage unavailable or corrupt → fall back */
  }
  return ROUTE_TEMPLATES[0]!.draft;
}

/** Route draft state, remembered in this browser until the journey is saved server-side. */
export function useRouteDraft() {
  const [draft, setDraft] = useState<RouteDraft>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft]);
  return [draft, setDraft] as const;
}
