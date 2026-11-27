import { useEffect, useState } from "react";
import { journeyState, localParts } from "@marchone/engine";
import type { Journey, Me } from "./api";
import { authClient } from "./auth";
import { QuestPanel } from "./QuestPanel";
import { RouteMap } from "./route/RouteMap";
import { MODE_META, formatDate, formatDuration, formatMoney } from "./route/format";

const pad = (n: number) => String(n).padStart(2, "0");

export function JourneyView({
  journey, me, onAbandon, onNewJourney, onAccountChange,
}: {
  journey: Journey;
  me: Me;
  onAbandon: () => Promise<void>;
  onNewJourney: () => void;
  onAccountChange: () => void;
}) {
  // Keep the client clock aligned to the server's so both engines agree.
  const [offset] = useState(() => journey.serverTime - Date.now());
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(id);
  }, [offset]);

  const s = journeyState(journey.route, journey.startedAt, journey.timeScale, now);
  const local = localParts(now, s.timeZone);
  const name = journey.traveler?.name ?? "마치";
  const wallet = journey.wallet[0];
  const [msg, setMsg] = useState<string | null>(null);

  async function addPasskey() {
    setMsg(null);
    const res = await authClient.passkey.addPasskey({ name: "MarchOne" });
    if (res?.error) setMsg(res.error.message ?? "패스키를 등록하지 못했어요.");
    else { setMsg("패스키를 등록했어요. 다른 기기에서도 이어서 볼 수 있어요."); onAccountChange(); }
  }

  return (
    <div className="editor">
      <section className="card map-card">
        <RouteMap draft={journey.route} selected={s.legIndex} position={s.position} />
        {s.finished ? (
          <>
            <p className="lead">{name}가 {s.to.name}에 도착했어요! 🎉</p>
            <p className="muted">이룬 부탁의 환급금과 남은 돈이 정산돼 다음 여정 출발 자금에 더해져요.</p>
          </>
        ) : (
          <p className="lead">
            {name}는 지금 <strong>{s.from.name}</strong> → <strong>{s.to.name}</strong> 구간을{" "}
            {MODE_META[s.mode].phrase} 가고 있어요 {MODE_META[s.mode].icon}
          </p>
        )}
        <div className="progress" aria-label="구간 진행률">
          <div style={{ width: `${(s.position.legProgress * 100).toFixed(2)}%` }} />
        </div>
        <dl className="totals">
          <div><dt>현지 시각</dt><dd>{pad(local.hour)}:{pad(local.minute)}</dd></div>
          <div><dt>전체 진행</dt><dd>{(s.overallProgress * 100).toFixed(1)}%</dd></div>
          <div><dt>최종 도착</dt><dd>{formatDate(s.arrivesAt)}</dd></div>
        </dl>
        <p className="note">
          구간 {s.legIndex + 1}/{journey.route.modes.length} · 남은 시간 {formatDuration(Math.max(0, s.arrivesAt - now))}
          {wallet && ` · 지갑 ${formatMoney(wallet.balance, wallet.currency)}`}
        </p>
      </section>

      {!s.finished && journey.status === "active" && (
        <QuestPanel currency={me.user.homeCurrency} refreshKey={s.legIndex} />
      )}

      {me.user.isAnonymous && me.passkeys === 0 && (
        <section className="card">
          <h2>여정 지키기</h2>
          <p className="muted">지금은 이 브라우저에만 로그인돼 있어요. 패스키를 등록하면 다른 기기에서도 {name}를 만날 수 있어요.</p>
          <button onClick={addPasskey}>패스키 등록</button>
          {msg && <p className="muted" role="status">{msg}</p>}
        </section>
      )}

      {s.finished ? (
        <button className="primary" onClick={onNewJourney}>새 여정 시작하기</button>
      ) : (
        <button
          className="ghost danger"
          onClick={() => { if (confirm(`${name}의 여정을 그만둘까요? 되돌릴 수 없어요.`)) void onAbandon(); }}
        >
          여정 그만두기
        </button>
      )}
    </div>
  );
}
