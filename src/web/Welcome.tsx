import { useState } from "react";
import { authClient } from "./auth";

export function Welcome({ onSignedIn }: { onSignedIn: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<{ error: { message?: string } | null } | undefined>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (res?.error) setError(res.error.message ?? "로그인하지 못했어요.");
      else onSignedIn();
    } catch {
      setError("로그인하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card welcome">
      <p className="lead">작은 여행자 <strong>마치</strong>가 당신 대신 세계를 걸어요.</p>
      <p className="muted">가입 없이 바로 시작할 수 있어요. 나중에 패스키를 등록하면 다른 기기에서도 이어서 볼 수 있어요.</p>
      <button className="primary" disabled={busy} onClick={() => run(() => authClient.signIn.anonymous())}>
        바로 시작하기
      </button>
      <button disabled={busy} onClick={() => run(() => authClient.signIn.passkey())}>
        패스키로 이어하기
      </button>
      {error && <p className="issue error" role="alert">{error}</p>}
    </section>
  );
}
