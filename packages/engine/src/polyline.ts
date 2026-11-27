import type { LatLng } from "./types";

/** Decode a Google encoded polyline (precision 5). */
export function decodePolyline(encoded: string): LatLng[] {
  const out: LatLng[] = [];
  let i = 0, lat = 0, lng = 0;
  const next = () => {
    let result = 0, shift = 0, b: number;
    do {
      if (i >= encoded.length) throw new Error("invalid polyline");
      b = encoded.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < encoded.length) {
    lat += next();
    lng += next();
    out.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return out;
}

/** Encode points as a Google encoded polyline (precision 5). */
export function encodePolyline(points: LatLng[]): string {
  let out = "", plat = 0, plng = 0;
  const put = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    while (n >= 0x20) {
      out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    out += String.fromCharCode(n + 63);
  };
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5), lng = Math.round(p.lng * 1e5);
    put(lat - plat);
    put(lng - plng);
    plat = lat;
    plng = lng;
  }
  return out;
}

/** Keep every k-th point so long routes stay light for the client (endpoints kept). */
export function simplifyByStride(points: LatLng[], maxPoints: number): LatLng[] {
  if (points.length <= maxPoints) return points;
  const stride = Math.ceil(points.length / maxPoints);
  const out = points.filter((_, i) => i % stride === 0);
  const last = points[points.length - 1]!;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}
