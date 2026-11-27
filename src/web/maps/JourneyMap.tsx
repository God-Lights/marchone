import { useEffect, useMemo, useRef } from "react";
import { decodePolyline, placeById, type LatLng, type RouteDraft } from "@marchone/engine";
import { RouteMap } from "../route/RouteMap";
import { MODE_COLOR } from "../route/format";
import { useGoogleMaps } from "./useGoogleMaps";

const cssVar = (v: string) => {
  const m = /var\((--[^)]+)\)/.exec(v);
  return m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]!).trim() || "#2f6f5e" : v;
};

/** Google map of the route with the traveler's position; SVG preview when Maps is unavailable. */
export function JourneyMap({
  route, paths, selected, position,
}: { route: RouteDraft; paths: (string | null)[]; selected: number; position: LatLng }) {
  const g = useGoogleMaps();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.OverlayView | null>(null);
  const markerPos = useRef<LatLng>(position);
  markerPos.current = position;

  const legs = useMemo(
    () => route.modes.map((mode, i) => {
      const enc = paths[i];
      const a = placeById(route.stops[i]!)!, b = placeById(route.stops[i + 1]!)!;
      return { mode, points: enc ? decodePolyline(enc) : [a, b], geodesic: !enc };
    }),
    [route, paths],
  );

  // Build the map once per route.
  useEffect(() => {
    if (g.state !== "ready" || !el.current) return;
    const maps = g.maps;
    const m = new maps.Map(el.current, {
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "cooperative",
      clickableIcons: false,
      backgroundColor: "#e3ece8",
    });
    map.current = m;
    const bounds = new maps.LatLngBounds();
    const lines = legs.map((l, i) => {
      l.points.forEach((p) => bounds.extend(p));
      return new maps.Polyline({
        map: m,
        path: l.points,
        geodesic: l.geodesic,
        strokeColor: cssVar(MODE_COLOR[l.mode]),
        strokeOpacity: l.mode === "plane" || l.mode === "ship" ? 0 : 0.9,
        strokeWeight: i === selected ? 5 : 3,
        icons: l.mode === "plane" || l.mode === "ship"
          ? [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.9, strokeWeight: 3, scale: 2 }, offset: "0", repeat: "12px" }]
          : undefined,
      });
    });
    m.fitBounds(bounds, 32);

    // Pulsing HTML marker for Machi (no Map ID needed).
    class Me extends maps.OverlayView {
      div = Object.assign(document.createElement("div"), { className: "gm-me", title: "마치" });
      onAdd() { this.getPanes()!.overlayMouseTarget.appendChild(this.div); }
      draw() {
        const p = this.getProjection()?.fromLatLngToDivPixel(markerPos.current);
        if (p) this.div.style.transform = `translate(${p.x}px, ${p.y}px)`;
      }
      onRemove() { this.div.remove(); }
    }
    const me = new Me();
    me.setMap(m);
    marker.current = me;
    return () => {
      lines.forEach((l) => l.setMap(null));
      me.setMap(null);
      map.current = null;
    };
  }, [g, legs, selected]);

  // Move the marker as time passes.
  useEffect(() => { marker.current?.draw(); }, [position]);

  if (g.state === "unavailable") return <RouteMap draft={route} selected={selected} position={position} />;
  return <div ref={el} className="gmap" role="region" aria-label="여정 지도" />;
}
