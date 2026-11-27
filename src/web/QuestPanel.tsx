import { useCallback, useEffect, useState } from "react";
import { COMPLETION_BONUS_RATE } from "@marchone/engine";
import { api, type QuestBoardResponse } from "./api";
import { formatMoney } from "./route/format";

/** "길 위의 부탁": optional quests along the route. No deadlines, no failure. */
export function QuestPanel({ currency, refreshKey }: { currency: string; refreshKey: number }) {
  const [board, setBoard] = useState<QuestBoardResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBoard(await api.quests());
    } catch (e) {
      setError(e instanceof Error ? e.message : "부탁을 불러오지 못했어요.");
    }
  }, []);
  useEffect(() => { void load(); }, [load, refreshKey]);

  async function act(id: string, fn: (id: string) => Promise<unknown>) {
    setBusy(id);
    setError(null);
    try {
      await fn(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리하지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  if (!board) return error ? <section className="card"><p className="issue error">{error}</p></section> : null;
  const full = board.active.length >= board.maxActive;

  return (
    <section className="card quests">
      <div className="row-between">
        <h2>길 위의 부탁</h2>
        <span className="muted">{board.active.length}/{board.maxActive}</span>
      </div>
      <p className="refund">
        환급 예정 <strong>{formatMoney(board.pendingRefund, currency)}</strong>
        <span className="muted"> · 완주하면 +{Math.round(COMPLETION_BONUS_RATE * 100)}%, 여정이 끝나면 다음 출발 자금에 더해져요</span>
      </p>
      {error && <p className="issue error" role="alert">{error}</p>}

      {board.active.length > 0 && (
        <ul className="quest-list">
          {board.active.map((q) => {
            const pct = Math.min(100, (q.progress.current / q.progress.target) * 100);
            const unit = q.condition.kind === "distance" ? "km" : "";
            return (
              <li key={q.id} className="quest active">
                <div className="row-between">
                  <strong>{q.title}</strong>
                  <span className="muted">{formatMoney(q.refund, currency)}</span>
                </div>
                <p className="muted giver">{q.giver} — {q.story}</p>
                <div className="progress" aria-label={`${q.title} 진행률`}><div style={{ width: `${pct}%` }} /></div>
                <div className="row-between">
                  <span className="muted">
                    {unit ? q.progress.current.toFixed(1) : q.progress.current} / {q.progress.target}{unit}
                  </span>
                  <button className="ghost small" disabled={busy === q.id} onClick={() => void act(q.id, api.declineQuest)}>내려놓기</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {board.available.length > 0 && (
        <>
          <h3>받을 수 있는 부탁</h3>
          <ul className="quest-list">
            {board.available.map((q) => (
              <li key={q.id} className="quest">
                <div className="row-between">
                  <strong>{q.title}</strong>
                  <span className="muted">{formatMoney(q.refund, currency)}</span>
                </div>
                <p className="muted giver">{q.giver} — {q.story}</p>
                <div className="quest-actions">
                  <button disabled={full || busy === q.id} title={full ? `동시에 ${board.maxActive}개까지 들 수 있어요` : undefined}
                    onClick={() => void act(q.id, api.acceptQuest)}>받기</button>
                  <button className="ghost" disabled={busy === q.id} onClick={() => void act(q.id, api.declineQuest)}>괜찮아요</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {board.active.length === 0 && board.available.length === 0 && (
        <p className="muted">지금 루트에서 받을 수 있는 부탁이 없어요. 루트를 이어 붙이면 새 부탁이 생길 수 있어요.</p>
      )}

      {board.completed.length > 0 && (
        <>
          <h3>이룬 부탁</h3>
          <ul className="quest-list done">
            {board.completed.map((q) => (
              <li key={q.id}>✓ {q.title} <span className="muted">· {formatMoney(q.refund, currency)}</span></li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
