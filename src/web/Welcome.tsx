import { useState } from "react";
import { authClient } from "./auth";
import { GL_LOGIN_PATH } from "./api";

export function Welcome({ onSignedIn, notice }: { onSignedIn: () => void; notice?: string | null }) {
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
      {notice && <p className="muted" role="status">{notice}</p>}
      {/* A plain link: GL login starts only when the user presses this. */}
      <a className="button primary" href={GL_LOGIN_PATH}>GL 계정으로 로그인</a>
      <button disabled={busy} onClick={() => run(() => authClient.signIn.anonymous())}>
        로그인 없이 시작하기
      </button>
      <p className="muted">로그인 없이 시작해도 나중에 GL 계정으로 로그인하면 여정이 그대로 이어져요.</p>
      <button className="ghost" disabled={busy} onClick={() => run(() => authClient.signIn.passkey())}>
        패스키로 이어하기
      </button>
      {error && <p className="issue error" role="alert">{error}</p>}
    </section>
  );
}
