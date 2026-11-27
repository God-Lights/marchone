/// <reference types="google.maps" />

let promise: Promise<typeof google.maps> | null = null;

declare global {
  interface Window {
    __marchoneMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}

/** Load the Maps JavaScript API once. Rejects on network error, bad key/referrer, or timeout. */
export function loadGoogleMaps(key: string): Promise<typeof google.maps> {
  if (promise) return promise;
  promise = new Promise<typeof google.maps>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("maps load timeout")), 15_000);
    window.__marchoneMapsReady = () => {
      clearTimeout(timer);
      resolve(google.maps);
    };
    // Called by Google when the key is invalid or the referrer is not allowed.
    window.gm_authFailure = () => {
      clearTimeout(timer);
      reject(new Error("maps auth failure"));
      authFailed = true;
      listeners.forEach((l) => l());
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&language=ko&callback=__marchoneMapsReady`;
    s.async = true;
    s.onerror = () => {
      clearTimeout(timer);
      reject(new Error("maps script failed"));
    };
    document.head.appendChild(s);
  });
  promise.catch(() => { promise = null; });
  return promise;
}

let authFailed = false;
const listeners = new Set<() => void>();
/** Auth failures can arrive after load succeeded (first map render). */
export function onMapsAuthFailure(fn: () => void): () => void {
  if (authFailed) fn();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let configPromise: Promise<string | null> | null = null;
export function mapsBrowserKey(): Promise<string | null> {
  configPromise ??= fetch("/api/config")
    .then((r) => (r.ok ? (r.json() as Promise<{ mapsBrowserKey: string | null }>) : { mapsBrowserKey: null }))
    .then((c) => c.mapsBrowserKey)
    .catch(() => null);
  return configPromise;
}
