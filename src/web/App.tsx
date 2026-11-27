import { useEffect, useState } from "react";
import { positionAt, localParts, type Journey } from "@marchone/engine";

const demo: Journey = {
  startedAt: Date.UTC(2026, 0, 1),
  timeScale: 1,
  legs: [{ from: { lat: 37.5665, lng: 126.978 }, to: { lat: 35.1796, lng: 129.0756 }, mode: "walk" }],
};

export function App() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const pos = positionAt(demo, now);
  const t = localParts(now, "Asia/Seoul");

  return (
    <main>
      <h1>MarchOne</h1>
      <p className="sub">행진으로 세계일주</p>
      <section className="card">
        <div>마치의 위치</div>
        <strong>
          {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}
        </strong>
        <div className="muted">
          현지 {String(t.hour).padStart(2, "0")}:{String(t.minute).padStart(2, "0")} · 진행 {(pos.legProgress * 100).toFixed(2)}%
        </div>
      </section>
    </main>
  );
}
