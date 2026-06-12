import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../auth";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다");
      } else if (err instanceof ApiError && err.status === 429) {
        setError("로그인 시도 횟수를 초과했습니다 — 잠시 후 다시 시도하세요");
      } else {
        setError("로그인에 실패했습니다 — 서버 상태를 확인하세요");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="wordmark">
          errtrack<span className="tld">_</span>
          <span className="cursor" />
        </div>
        <p className="login-tagline">// 오류 추적 시스템</p>
        {error && <p className="form-error">{error}</p>}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="admin@local.dev"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-block" type="submit" disabled={submitting}>
            {submitting ? "확인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
