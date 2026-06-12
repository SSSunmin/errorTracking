import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  ExceptionValue,
  IssueStatus,
  Severity,
} from "@errortracking/shared";
import { api } from "../api/client";
import type { IssueDetail, StoredEvent } from "../api/types";
import { frameLocation, segmentFrames } from "../lib/frames";
import { formatCount, timeAgo } from "../lib/format";

const LEVEL_COLORS: Record<Severity, string> = {
  fatal: "var(--level-fatal)",
  error: "var(--level-error)",
  warning: "var(--level-warning)",
  info: "var(--level-info)",
  debug: "var(--level-debug)",
};

const STATUS_LABEL: Record<IssueStatus, string> = {
  unresolved: "미해결",
  resolved: "해결됨",
  ignored: "무시됨",
};

export function IssueDetailPage() {
  const { issueId } = useParams<{ issueId: string }>();
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [event, setEvent] = useState<StoredEvent | null>(null);
  const [eventTotal, setEventTotal] = useState(0);
  const [eventPage, setEventPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!issueId) return;
    api
      .getIssue(issueId)
      .then(setIssue)
      .catch(() => setError("이슈를 불러오지 못했습니다"));
  }, [issueId]);

  useEffect(() => {
    if (!issueId) return;
    setEvent(null);
    api
      .listIssueEvents(issueId, eventPage, 1)
      .then((r) => {
        setEvent(r.items[0] ?? null);
        setEventTotal(r.total);
      })
      .catch(() => setError("이벤트를 불러오지 못했습니다"));
  }, [issueId, eventPage]);

  async function changeStatus(status: IssueStatus) {
    if (!issue) return;
    setUpdating(true);
    try {
      setIssue(await api.setIssueStatus(issue.id, status));
    } catch {
      setError("상태 변경에 실패했습니다");
    } finally {
      setUpdating(false);
    }
  }

  if (error) return <div className="error-box">{error}</div>;
  if (!issue) return <div className="loading">불러오는 중...</div>;

  const levelColor = LEVEL_COLORS[issue.level];

  return (
    <div className="page">
      <div className="page-head">
        <Link className="back-link" to={`/projects/${issue.projectId}`}>
          ← 이슈 목록
        </Link>
      </div>

      <div className="detail-head" style={{ borderLeftColor: levelColor }}>
        <div className="detail-title-row">
          <span className="level-badge" style={{ color: levelColor }}>
            {issue.level}
          </span>
          <span className={`status-chip status-${issue.status}`}>
            {STATUS_LABEL[issue.status]}
          </span>
          {issue.regression && <span className="regression-chip">재발</span>}
        </div>
        <h1 className="detail-title">{issue.title}</h1>
        {issue.culprit && <div className="issue-culprit">{issue.culprit}</div>}
        <div className="detail-meta">
          <span>
            events <b>{formatCount(issue.timesSeen)}</b>
          </span>
          <span>
            users <b>{formatCount(issue.userCount)}</b>
          </span>
          <span>
            첫 발생 <b title={issue.firstSeen}>{timeAgo(issue.firstSeen)}</b>
          </span>
          <span>
            최근 발생 <b title={issue.lastSeen}>{timeAgo(issue.lastSeen)}</b>
          </span>
        </div>
        <div className="detail-actions">
          <button
            className="btn"
            disabled={updating || issue.status === "resolved"}
            onClick={() => void changeStatus("resolved")}
          >
            Resolve
          </button>
          <button
            className="btn btn-ghost"
            disabled={updating || issue.status === "ignored"}
            onClick={() => void changeStatus("ignored")}
          >
            Ignore
          </button>
          <button
            className="btn btn-ghost"
            disabled={updating || issue.status === "unresolved"}
            onClick={() => void changeStatus("unresolved")}
          >
            Reopen
          </button>
        </div>
      </div>

      <div className="event-nav">
        <button disabled={eventPage <= 1} onClick={() => setEventPage((p) => p - 1)}>
          ← 최신
        </button>
        <span>
          이벤트 {eventPage} / {eventTotal}
        </span>
        <button
          disabled={eventPage >= eventTotal}
          onClick={() => setEventPage((p) => p + 1)}
        >
          과거 →
        </button>
        {event && (
          <span className="event-id" title={event.receivedAt}>
            {event.eventId}
          </span>
        )}
      </div>

      {!event ? (
        <div className="loading">이벤트 불러오는 중...</div>
      ) : (
        <EventView event={event} />
      )}
    </div>
  );
}

function EventView({ event }: { event: StoredEvent }) {
  const payload = event.payload;
  // values는 oldest-first 저장 — 대표(가장 바깥) 예외를 먼저 보여준다
  const exceptions = [...(payload.exception?.values ?? [])].reverse();

  return (
    <>
      {payload.message && (
        <section className="card">
          <h2 className="card-title">메시지</h2>
          <p className="event-message">{payload.message}</p>
        </section>
      )}

      {exceptions.map((exc, i) => (
        <ExceptionView key={i} exception={exc} />
      ))}

      <section className="card">
        <h2 className="card-title">컨텍스트</h2>
        <div className="ctx-grid">
          <CtxItem label="environment" value={event.environment} />
          <CtxItem label="release" value={event.release} />
          <CtxItem label="url" value={payload.request?.url} />
          <CtxItem
            label="browser"
            value={
              payload.contexts?.browser
                ? `${payload.contexts.browser.name ?? "?"} ${payload.contexts.browser.version ?? ""}`
                : undefined
            }
          />
          <CtxItem
            label="os"
            value={
              payload.contexts?.os
                ? `${payload.contexts.os.name ?? "?"} ${payload.contexts.os.version ?? ""}`
                : undefined
            }
          />
          <CtxItem label="user" value={payload.user?.id} />
          <CtxItem
            label="sdk"
            value={payload.sdk ? `${payload.sdk.name}@${payload.sdk.version}` : undefined}
          />
          <CtxItem label="발생 시각" value={new Date(event.timestamp).toLocaleString()} />
        </div>
      </section>

      <details className="raw-json">
        <summary>원본 JSON</summary>
        <pre>{JSON.stringify(payload, null, 2)}</pre>
      </details>
    </>
  );
}

function ExceptionView({ exception }: { exception: ExceptionValue }) {
  const segments = segmentFrames(exception.stacktrace?.frames ?? []);

  return (
    <section className="card">
      <h2 className="card-title">
        <span className="exc-type">{exception.type}</span>
        {exception.value && <span className="exc-value">: {exception.value}</span>}
        {exception.mechanism && (
          <span className="mechanism-chip">{exception.mechanism.type}</span>
        )}
      </h2>
      {segments.length === 0 ? (
        <p className="no-stack">스택 트레이스 없음</p>
      ) : (
        <div className="stack">
          {segments.map((seg, i) =>
            seg.inApp ? (
              <div key={i}>
                {seg.frames.map((frame, j) => (
                  <div key={j} className="frame in-app">
                    <span className="frame-fn">
                      {frame.function ?? "<anonymous>"}
                    </span>
                    <span className="frame-loc">{frameLocation(frame)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <CollapsedFrames key={i} frames={seg.frames} />
            ),
          )}
        </div>
      )}
    </section>
  );
}

function CollapsedFrames({
  frames,
}: {
  frames: { function?: string; filename?: string; lineno?: number; colno?: number }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button className="frame-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? "▾" : "▸"} 시스템 프레임 {frames.length}개{open ? " 접기" : " 펼치기"}
      </button>
      {open &&
        frames.map((frame, j) => (
          <div key={j} className="frame system">
            <span className="frame-fn">{frame.function ?? "<anonymous>"}</span>
            <span className="frame-loc">{frameLocation(frame)}</span>
          </div>
        ))}
    </div>
  );
}

function CtxItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="ctx-item">
      <span className="ctx-label">{label}</span>
      <span className="ctx-value" title={value}>
        {value}
      </span>
    </div>
  );
}
