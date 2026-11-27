import { useEffect, useState } from "react";
import { loadGoogleMaps, mapsBrowserKey, onMapsAuthFailure } from "./loader";

export type MapsStatus = { state: "loading" } | { state: "ready"; maps: typeof google.maps } | { state: "unavailable" };

/** Google Maps if a key is configured and loading works; otherwise "unavailable" (use the SVG fallback). */
export function useGoogleMaps(): MapsStatus {
  const [status, setStatus] = useState<MapsStatus>({ state: "loading" });
  useEffect(() => {
    let alive = true;
    const off = onMapsAuthFailure(() => alive && setStatus({ state: "unavailable" }));
    mapsBrowserKey()
      .then((key) => (key ? loadGoogleMaps(key) : Promise.reject(new Error("no key"))))
      .then((maps) => alive && setStatus({ state: "ready", maps }))
      .catch(() => alive && setStatus({ state: "unavailable" }));
    return () => { alive = false; off(); };
  }, []);
  return status;
}
