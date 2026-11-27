import { interpolate, placeById, type LatLng, type RouteDraft } from "@marchone/engine";
import { MODE_COLOR } from "./format";

const x = (lng: number) => lng + 180;
const y = (lat: number) => 90 - lat;
const LABEL_LIMIT = 6;

function arcPoints(a: LatLng, b: LatLng): LatLng[] {
  return Array.from({ length: 33 }, (_, i) => interpolate(a, b, i / 32));
}

/** Split a polyline where it crosses the antimeridian. */
function splitSegments(pts: LatLng[]): string[] {
  const segs: string[][] = [[]];
  pts.forEach((p, i) => {
    const prev = pts[i - 1];
    if (prev && Math.abs(p.lng - prev.lng) > 180) segs.push([]);
    segs[segs.length - 1]!.push(`${x(p.lng).toFixed(2)},${y(p.lat).toFixed(2)}`);
  });
  return segs.filter((s) => s.length > 1).map((s) => s.join(" "));
}

/** Fit the view to the route (2:1), falling back to the whole world for wide routes. */
function fitView(points: LatLng[]) {
  if (points.length === 0) return { x0: 0, y0: 0, w: 360, h: 180 };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, x(p.lng)); maxX = Math.max(maxX, x(p.lng));
    minY = Math.min(minY, y(p.lat)); maxY = Math.max(maxY, y(p.lat));
  }
  let w = Math.max(maxX - minX, 8) * 1.35;
  let h = Math.max(maxY - minY, 4) * 1.6;
  if (w / h < 2) w = h * 2; else h = w / 2;
  if (w >= 300) return { x0: 0, y0: 0, w: 360, h: 180 };
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const x0 = Math.min(Math.max(cx - w / 2, 0), 360 - w);
  const y0 = Math.min(Math.max(cy - h / 2, 0), 180 - h);
  return { x0, y0, w, h };
}

/** Lightweight route preview (no map key needed). Google Maps replaces this later. */
export function RouteMap({ draft, selected, position }: { draft: RouteDraft; selected: number | null; position?: LatLng }) {
  const places = draft.stops.map((id) => placeById(id)).filter((p) => p !== undefined);
  const arcs = places.slice(0, -1).map((a, i) => arcPoints(a, places[i + 1]!));
  const v = fitView([...places, ...arcs.flat()]);
  const k = v.w / 360; // scale for marker/text sizes
  const labels = places.length <= LABEL_LIMIT;
  const grid = v.w > 120 ? 30 : v.w > 40 ? 10 : 5;

  return (
    <svg className="route-map" viewBox={`${v.x0} ${v.y0} ${v.w} ${v.h}`} role="img" aria-label="루트 미리보기 지도">
      <rect x={0} y={0} width={360} height={180} className="map-sea" />
      {Array.from({ length: 360 / grid - 1 }, (_, i) => (
        <line key={`v${i}`} x1={(i + 1) * grid} x2={(i + 1) * grid} y1={0} y2={180} className="map-grid" vectorEffect="non-scaling-stroke" />
      ))}
      {Array.from({ length: 180 / grid - 1 }, (_, i) => (
        <line key={`h${i}`} y1={(i + 1) * grid} y2={(i + 1) * grid} x1={0} x2={360}
          className={(i + 1) * grid === 90 ? "map-equator" : "map-grid"} vectorEffect="non-scaling-stroke" />
      ))}
      {arcs.map((pts, i) => {
        const mode = draft.modes[i]!;
        return splitSegments(pts).map((seg, j) => (
          <polyline
            key={`${i}-${j}`}
            points={seg}
            fill="none"
            stroke={MODE_COLOR[mode]}
            strokeWidth={selected === i ? 3.5 : 2}
            strokeDasharray={mode === "plane" ? "6 4" : mode === "ship" ? "2 3" : undefined}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ));
      })}
      {/* Reverse so the start marker draws on top when a loop returns home. */}
      {places.map((p, i) => ({ p, i })).reverse().map(({ p, i }) => {
        const isStart = i === 0;
        const r = (labels ? 4.5 : 7) * k;
        return (
          <g key={`${p.id}-${i}`} transform={`translate(${x(p.lng)} ${y(p.lat)})`}>
            <circle r={isStart ? r * 1.25 : r} className={isStart ? "map-start" : "map-stop"} vectorEffect="non-scaling-stroke" />
            {labels ? (
              <text y={i % 2 === 0 ? -8 * k : 16 * k} textAnchor="middle" fontSize={11 * k} className="map-label">{p.name}</text>
            ) : (
              <text y={3 * k} textAnchor="middle" fontSize={8.5 * k} className={isStart ? "map-num start" : "map-num"}>
                {isStart ? "S" : i}
              </text>
            )}
          </g>
        );
      })}
      {position && (
        <g transform={`translate(${x(position.lng)} ${y(position.lat)})`} aria-label="마치의 현재 위치">
          <circle r={9 * k} className="map-me-halo" />
          <circle r={4.5 * k} className="map-me" vectorEffect="non-scaling-stroke" />
        </g>
      )}
    </svg>
  );
}
