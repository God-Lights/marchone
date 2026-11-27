import { useCallback, useEffect, useState } from "react";
import type { RouteDraft } from "@marchone/engine";
import { ApiError, api, type Journey, type Me } from "./api";
import { RouteEditor } from "./route/RouteEditor";
import { Welcome } from "./Welcome";
import { JourneyView } from "./JourneyView";

type View =
  | { kind: "loading" }
  | { kind: "welcome" }
  | { kind: "error"; message: string }
  | { kind: "editor"; me: Me }
  | { kind: "journey"; me: Me; journey: Journey };

export function App() {
  const [view, setView] = useState<View>({ kind: "loading" });

  const load = useCallback(async () => {
    try {
      const me = await api.me();
      const { journey } = await api.currentJourney();
      setView(journey && journey.status !== "abandoned" ? { kind: "journey", me, journey } : { kind: "editor", me });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setView({ kind: "welcome" });
      else setView({ kind: "error", message: e instanceof Error ? e.message : "불러오지 못했어요." });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function start(route: RouteDraft) {
    const { journey } = await api.startJourney(route);
    if (view.kind === "editor") setView({ kind: "journey", me: view.me, journey });
  }

  return (
    <main>
      <header>
        <h1>MarchOne</h1>
        <p className="sub">
          {view.kind === "journey" ? "마치의 행진" : view.kind === "editor" ? "마치가 걸어갈 길을 정해 주세요" : "행진으로 세계일주"}
        </p>
      </header>
      {view.kind === "loading" && <p className="muted">불러오는 중…</p>}
      {view.kind === "error" && (
        <section className="card">
          <p className="issue error" role="alert">{view.message}</p>
          <button onClick={() => void load()}>다시 시도</button>
        </section>
      )}
      {view.kind === "welcome" && <Welcome onSignedIn={() => void load()} />}
      {view.kind === "editor" && <RouteEditor onStart={start} />}
      {view.kind === "journey" && (
        <JourneyView
          journey={view.journey}
          me={view.me}
          onAbandon={async () => { await api.abandonJourney(); await load(); }}
          onNewJourney={() => setView({ kind: "editor", me: view.me })}
          onAccountChange={() => void load()}
        />
      )}
    </main>
  );
}
