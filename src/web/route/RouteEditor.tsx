import { useEffect, useMemo, useState } from "react";
import { api, type NextFunds } from "../api";
import { formatMoney } from "./format";
import type { RouteDraft } from "@marchone/engine";
import {
  ALL_MODES, ROUTE_TEMPLATES, addStop, moveStop, normalizeDraft, placeById, removeStop,
  searchPlaces, setMode, summarizeRoute, validateRoute, MAX_STOPS,
} from "@marchone/engine";
import { useRouteDraft } from "./useRouteDraft";
import { RouteMap } from "./RouteMap";
import { MODE_META, formatDate, formatDuration, formatKm } from "./format";

export function RouteEditor({ onStart }: { onStart: (draft: RouteDraft) => Promise<void> }) {
  const [draft, setDraft] = useRouteDraft();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [funds, setFunds] = useState<NextFunds | null>(null);
  useEffect(() => { api.nextFunds().then(setFunds).catch(() => {}); }, []);

  async function start() {
    setStarting(true);
    setStartError(null);
    try {
      await onStart(draft);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "출발하지 못했어요.");
      setStarting(false);
    }
  }
  const [query, setQuery] = useState("");
  const [selectedLeg, setSelectedLeg] = useState<number | null>(null);

  const summary = useMemo(() => summarizeRoute(draft), [draft]);
  const issues = useMemo(() => validateRoute(draft), [draft]);
  const results = useMemo(() => searchPlaces(query, 8), [query]);
  const hasError = issues.some((i) => i.level === "error");
  const routeIssues = issues.filter((i) => i.legIndex === null);
  const full = draft.stops.length >= MAX_STOPS;

  return (
    <div className="editor">
      <section className="card map-card">
        <RouteMap draft={draft} selected={selectedLeg} />
        <dl className="totals">
          <div><dt>총 거리</dt><dd>{formatKm(summary.totalDistanceM)}</dd></div>
          <div><dt>예상 기간</dt><dd>{formatDuration(summary.totalElapsedMs)}</dd></div>
          <div><dt>오늘 출발하면</dt><dd>{summary.legs.length ? formatDate(Date.now() + summary.totalElapsedMs) : "—"}</dd></div>
        </dl>
        <p className="note">실시간 1배속 기준 · 도보·자전거는 하루 10시간 이동 후 캠프에서 쉬어요 · 거리는 직선(대권) 기준</p>
      </section>

      <section className="card">
        <div className="row-between">
          <h2>템플릿</h2>
          <button className="ghost" onClick={() => setDraft({ stops: [], modes: [] })}>비우기</button>
        </div>
        <div className="chips">
          {ROUTE_TEMPLATES.map((t) => (
            <button key={t.id} className="chip" title={t.description} onClick={() => setDraft(normalizeDraft(t.draft))}>
              {t.name}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>루트 <span className="count">{draft.stops.length}곳</span></h2>
        {routeIssues.map((i, k) => <p key={k} className={`issue ${i.level}`}>{i.message}</p>)}
        {draft.stops.length === 0 && <p className="empty">아래에서 첫 장소를 골라 마치의 출발지를 정하세요.</p>}
        <ol className="stops">
          {draft.stops.map((id, i) => {
            const place = placeById(id)!;
            const leg = summary.legs[i];
            const legIssues = issues.filter((x) => x.legIndex === i);
            const last = i === draft.stops.length - 1;
            return (
              <li key={`${id}-${i}`}>
                <div className="stop">
                  <span className="badge">{i === 0 ? "출발" : last ? "도착" : i}</span>
                  <div className="stop-name">
                    <strong>{place.name}</strong>
                    <span className="muted">{place.country}</span>
                  </div>
                  <div className="stop-actions">
                    <button aria-label={`${place.name} 위로`} disabled={i === 0} onClick={() => setDraft(moveStop(draft, i, -1))}>↑</button>
                    <button aria-label={`${place.name} 아래로`} disabled={last} onClick={() => setDraft(moveStop(draft, i, 1))}>↓</button>
                    <button aria-label={`${place.name} 삭제`} onClick={() => setDraft(removeStop(draft, i))}>✕</button>
                  </div>
                </div>
                {!last && leg && (
                  <div
                    className={`leg ${selectedLeg === i ? "selected" : ""}`}
                    onMouseEnter={() => setSelectedLeg(i)}
                    onMouseLeave={() => setSelectedLeg(null)}
                  >
                    <div className="modes" role="radiogroup" aria-label={`${place.name} 다음 구간 이동수단`}>
                      {ALL_MODES.map((m) => (
                        <button
                          key={m}
                          role="radio"
                          aria-checked={draft.modes[i] === m}
                          aria-label={MODE_META[m].label}
                          title={MODE_META[m].label}
                          className={draft.modes[i] === m ? "mode on" : "mode"}
                          onClick={() => setDraft(setMode(draft, i, m))}
                        >
                          {MODE_META[m].icon}
                        </button>
                      ))}
                    </div>
                    <div className="leg-info muted">
                      {MODE_META[leg.mode].label} · {formatKm(leg.distanceM)} · {formatDuration(leg.elapsedMs)}
                    </div>
                    {legIssues.map((x, k) => <p key={k} className={`issue ${x.level}`}>{x.message}</p>)}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="card">
        <h2>장소 추가</h2>
        <input
          className="search"
          type="search"
          placeholder="도시·나라 검색 (예: 파리, 일본)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={full}
        />
        {full && <p className="muted">최대 {MAX_STOPS}곳까지 넣을 수 있어요.</p>}
        <div className="results">
          {results.map((p) => (
            <button key={p.id} className="result" disabled={full} onClick={() => { setDraft(addStop(draft, p.id)); setQuery(""); }}>
              <strong>{p.name}</strong>
              <span className="muted">{p.country}</span>
            </button>
          ))}
          {results.length === 0 && <p className="muted">찾는 장소가 아직 목록에 없어요.</p>}
        </div>
      </section>

      {funds && (
        <p className="funds">
          출발 자금 <strong>{formatMoney(funds.total, funds.currency)}</strong>
          {funds.carry > 0 && <span className="muted"> · 지난 여정 환급 +{formatMoney(funds.carry, funds.currency)}</span>}
        </p>
      )}
      {startError && <p className="issue error" role="alert">{startError}</p>}
      <button className="primary" disabled={hasError || draft.stops.length < 2 || starting} onClick={() => void start()}>
        {starting ? "출발 준비 중…" : "이 루트로 출발"}
      </button>
    </div>
  );
}
