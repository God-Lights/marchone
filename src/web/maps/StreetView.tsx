import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@marchone/engine";
import { useGoogleMaps } from "./useGoogleMaps";

const toRad = (d: number) => (d * Math.PI) / 180;
function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Rounded so the panorama is only re-queried after Machi moves ~1km (saves Street View loads). */
const bucket = (p: LatLng) => `${p.lat.toFixed(2)},${p.lng.toFixed(2)}`;

/**
 * What Machi sees now: the nearest outdoor Street View looking toward the destination.
 * Where there is none (sea, desert, many countries), a satellite view instead.
 */
export function StreetView({ position, toward, placeName }: { position: LatLng; toward: LatLng; placeName: string }) {
  const g = useGoogleMaps();
  const el = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"street" | "satellite" | null>(null);
  const key = bucket(position);

  useEffect(() => {
    if (g.state !== "ready" || !el.current) return;
    const maps = g.maps;
    const node = el.current;
    let alive = true;
    let pano: google.maps.StreetViewPanorama | null = null;
    new maps.StreetViewService()
      .getPanorama({ location: position, radius: 2000, preference: maps.StreetViewPreference.NEAREST, sources: [maps.StreetViewSource.OUTDOOR] })
      .then(({ data }) => {
        if (!alive || !data.location?.latLng) return;
        pano = new maps.StreetViewPanorama(node, {
          pano: data.location.pano,
          pov: { heading: bearing(data.location.latLng.toJSON(), toward), pitch: 0 },
          disableDefaultUI: true,
          motionTracking: false,
          showRoadLabels: false,
          clickToGo: true,
          scrollwheel: false,
        });
        setMode("street");
      })
      .catch(() => {
        if (!alive) return;
        new maps.Map(node, { center: position, zoom: 12, mapTypeId: "satellite", disableDefaultUI: true, gestureHandling: "none", keyboardShortcuts: false });
        setMode("satellite");
      });
    return () => {
      alive = false;
      pano?.setVisible(false);
    };
    // Re-query only when the rounded position changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g, key]);

  if (g.state === "unavailable") return null;
  return (
    <section className="card view-card">
      <div ref={el} className="street" role="img" aria-label={`${placeName} 근처 풍경`} />
      <p className="note">
        {mode === "satellite" ? "여기는 거리 사진이 없어서 하늘에서 내려다본 모습이에요." : mode === "street" ? `마치가 지금 보고 있는 ${placeName} 방향 풍경` : "풍경을 불러오는 중…"}
      </p>
    </section>
  );
}
