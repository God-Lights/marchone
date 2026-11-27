import { LAND_MODES, decodePolyline, encodePolyline, haversine, placeById, simplifyByStride, type TravelMode } from "@marchone/engine";
import type { Env } from "./env";

/** Google Routes API travel mode per MarchOne mode. Trains have no reliable long-distance transit data → road. */
const ROUTES_MODE: Partial<Record<TravelMode, string>> = { walk: "WALK", bike: "BICYCLE", bus: "DRIVE", train: "DRIVE" };
const ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";
const CACHE_TTL = 30 * 24 * 3600; // Maps content may only be cached temporarily
const MISS_TTL = 7 * 24 * 3600;
const MAX_POINTS = 400;

export interface ResolvedLeg {
  distanceM: number;
  /** Encoded polyline of the road path, or null for a great-circle leg. */
  path: string | null;
  source: "road" | "direct";
}

const cacheKey = (mode: TravelMode, from: string, to: string) => `route:v1:${mode}:${from}:${to}`;

function direct(from: string, to: string): ResolvedLeg {
  return { distanceM: haversine(placeById(from)!, placeById(to)!), path: null, source: "direct" };
}

/**
 * Road distance + path for one leg. Land modes only; ship/plane and any failure fall back to
 * great-circle. Results (including misses) are cached in KV so repeated edits cost nothing.
 */
export async function resolveLeg(env: Env, mode: TravelMode, from: string, to: string): Promise<ResolvedLeg> {
  const gMode = ROUTES_MODE[mode];
  if (!gMode || !LAND_MODES.includes(mode) || !env.GOOGLE_MAPS_SERVER_KEY) return direct(from, to);

  const key = cacheKey(mode, from, to);
  const cached = await env.CACHE.get<{ distanceM: number | null; path: string | null }>(key, "json");
  if (cached) return cached.distanceM ? { distanceM: cached.distanceM, path: cached.path, source: "road" } : direct(from, to);

  const a = placeById(from)!, b = placeById(to)!;
  try {
    const res = await fetch(env.GOOGLE_ROUTES_ENDPOINT ?? ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": env.GOOGLE_MAPS_SERVER_KEY,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: a.lat, longitude: a.lng } } },
        destination: { location: { latLng: { latitude: b.lat, longitude: b.lng } } },
        travelMode: gMode,
      }),
    });
    if (!res.ok) {
      console.warn("routes api", res.status, (await res.text()).slice(0, 300));
      // Don't cache auth/quota errors: they are fixable and should be retried.
      if (res.status === 400 || res.status === 404) await env.CACHE.put(key, JSON.stringify({ distanceM: null, path: null }), { expirationTtl: MISS_TTL });
      return direct(from, to);
    }
    const body = (await res.json()) as { routes?: { distanceMeters?: number; polyline?: { encodedPolyline?: string } }[] };
    const route = body.routes?.[0];
    if (!route?.distanceMeters || !route.polyline?.encodedPolyline) {
      await env.CACHE.put(key, JSON.stringify({ distanceM: null, path: null }), { expirationTtl: MISS_TTL });
      return direct(from, to);
    }
    const path = encodePolyline(simplifyByStride(decodePolyline(route.polyline.encodedPolyline), MAX_POINTS));
    await env.CACHE.put(key, JSON.stringify({ distanceM: route.distanceMeters, path }), { expirationTtl: CACHE_TTL });
    return { distanceM: route.distanceMeters, path, source: "road" };
  } catch (e) {
    console.warn("routes api failed", String(e));
    return direct(from, to);
  }
}

/** Path only (for drawing). Distance of a running journey stays what was fixed at departure. */
export async function legPath(env: Env, mode: TravelMode, from: string, to: string): Promise<string | null> {
  return (await resolveLeg(env, mode, from, to)).path;
}

export async function resolveRoute(env: Env, stops: string[], modes: TravelMode[]): Promise<ResolvedLeg[]> {
  return Promise.all(modes.map((m, i) => resolveLeg(env, m, stops[i]!, stops[i + 1]!)));
}
