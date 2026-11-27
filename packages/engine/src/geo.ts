import type { LatLng } from "./types";

const R = 6371008.8; // mean Earth radius, meters
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in meters. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point at fraction t (0..1) along the great circle from a to b. */
export function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  const d = haversine(a, b) / R;
  if (d === 0) return { ...a };
  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);
  const x = A * Math.cos(rad(a.lat)) * Math.cos(rad(a.lng)) + B * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng));
  const y = A * Math.cos(rad(a.lat)) * Math.sin(rad(a.lng)) + B * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng));
  const z = A * Math.sin(rad(a.lat)) + B * Math.sin(rad(b.lat));
  return { lat: deg(Math.atan2(z, Math.hypot(x, y))), lng: deg(Math.atan2(y, x)) };
}

/** Total length of a polyline in meters. */
export function pathLength(path: LatLng[]): number {
  let sum = 0;
  for (let i = 1; i < path.length; i++) sum += haversine(path[i - 1]!, path[i]!);
  return sum;
}

/** Point at fraction t (0..1) of total length along a polyline. */
export function pointAlong(path: LatLng[], t: number): LatLng {
  const first = path[0];
  if (!first) throw new Error("empty path");
  if (path.length === 1 || t <= 0) return { ...first };
  const target = pathLength(path) * Math.min(1, t);
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const seg = haversine(path[i - 1]!, path[i]!);
    if (acc + seg >= target) return interpolate(path[i - 1]!, path[i]!, seg === 0 ? 0 : (target - acc) / seg);
    acc += seg;
  }
  return { ...path[path.length - 1]! };
}
