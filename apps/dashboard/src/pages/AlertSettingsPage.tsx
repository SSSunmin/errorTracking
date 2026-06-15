import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { AlertRule } from "../api/types";

type Draft = Omit<AlertRule, "projectId" | "updatedAt">;

const TRIGGERS: { key: keyof Draft; label: string; desc: string }[] = [
  { key: "onNewIssue", label: "새 이슈", desc: "처음 보는 에러가 발생했을 때" },
  { key: "onRegression", label: "재발", desc: "해결된 이슈가 다시 발생했을 때" },
  { key: "onSpike", label: "급증", desc: "5분 내 발생이 급증했을 때" },
];

export function AlertSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    api
      .getAlertRule(projectId)
      .then((r) =>
        setDraft({
          enabled: r.enabled,
          onNewIssue: r.onNewIssue,
          onRegression: r.onRegression,
          onSpike: r.onSpike,
          email: r.email,
          slackWebhookUrl: r.slackWebhookUrl,
        }),
      )
      .catch(() => setError("알림 규칙을 불러오지 못했습니다"));
  }, [projectId]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setSavedAt(null);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!projectId || !draft) return;
    setError(null);
    setSaving(true);
    try {
      const saved = await api.saveAlertRule(projectId, {
        ...draft,
        email: draft.email?.trim() || null,
        slackWebhookUrl: draft.slackWebhookUrl?.trim() || null,
      });
      setSavedAt(saved.updatedAt);
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("slack")
          ? "Slack URL은 https://hooks.slack.com/ 형식이어야 합니다"
          : err instanceof Error && err.message.includes("email")
            ? "이메일 형식이 올바르지 않습니다"
            : "저장에 실패했습니다",
      );
    } finally {
      setSaving(false);
    }
  }

  if (error && !draft) return <div className="error-box">{error}</div>;
  if (!draft) return <div className="loading">불러오는 중...</div>;

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <Link className="back-link" to={`/projects/${projectId}`}>
          ← 이슈 목록
        </Link>
        <h1 className="page-title">알림 설정</h1>
      </div>

      <form onSubmit={onSave}>
        <section className="card">
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => set("enabled", e.target.checked)}
            />
            <span>
              <b>알림 활성화</b>
              <small>끄면 이 프로젝트의 모든 알림이 발송되지 않습니다</small>
            </span>
          </label>
        </section>

        <section className="card">
          <h2 className="card-title">트리거</h2>
          {TRIGGERS.map((t) => (
            <label className="toggle-row" key={t.key}>
              <input
                type="checkbox"
                checked={draft[t.key] as boolean}
                disabled={!draft.enabled}
                onChange={(e) => set(t.key, e.target.checked)}
              />
              <span>
                <b>{t.label}</b>
                <small>{t.desc}</small>
              </span>
            </label>
          ))}
        </section>

        <section className="card">
          <h2 className="card-title">채널</h2>
          <div className="field">
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              type="email"
              placeholder="team@example.com"
              value={draft.email ?? ""}
              disabled={!draft.enabled}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="slack">Slack Webhook URL</label>
            <input
              id="slack"
              type="text"
              placeholder="https://hooks.slack.com/services/..."
              value={draft.slackWebhookUrl ?? ""}
              disabled={!draft.enabled}
              onChange={(e) => set("slackWebhookUrl", e.target.value)}
            />
          </div>
          <p className="field-hint">
            SMTP 미설정 시 이메일은 발송되지 않습니다. 두 채널 모두 비우면 알림이
            기록만 됩니다.
          </p>
        </section>

        {error && <p className="form-error">{error}</p>}
        <div className="save-row">
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "저장 중..." : "저장"}
          </button>
          {savedAt && <span className="saved-note">저장됨</span>}
        </div>
      </form>
    </div>
  );
}
