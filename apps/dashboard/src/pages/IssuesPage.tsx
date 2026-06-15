import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SEVERITY_LEVELS, type IssueStatus, type Severity } from "@errortracking/shared";
import { api } from "../api/client";
import type { IssueListResponse, IssueSort, Project } from "../api/types";
import { Sparkline } from "../components/charts";
import { formatCount, timeAgo } from "../lib/format";

const STATUS_TABS: { value: IssueStatus | "all"; label: string }[] = [
  { value: "unresolved", label: "미해결" },
  { value: "resolved", label: "해결됨" },
  { value: "ignored", label: "무시됨" },
  { value: "all", label: "전체" },
];

const SORT_OPTIONS: { value: IssueSort; label: string }[] = [
  { value: "last_seen", label: "최근 발생순" },
  { value: "times_seen", label: "발생 빈도순" },
  { value: "first_seen", label: "첫 발생순" },
];

const LEVEL_COLORS: Record<Severity, string> = {
  fatal: "var(--level-fatal)",
  error: "var(--level-error)",
  warning: "var(--level-warning)",
  info: "var(--level-info)",
  debug: "var(--level-debug)",
};

export function IssuesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [data, setData] = useState<IssueListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<IssueStatus | "all">("unresolved");
  const [sort, setSort] = useState<IssueSort>("last_seen");
  const [level, setLevel] = useState<Severity | "">("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // 입력 중인 검색어와 실제 적용된 검색어 분리 (Enter/제출 시 적용)
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!projectId) return;
    api.getProject(projectId).then(setProject).catch(() => {});
  }, [projectId]);

  const reload = useCallback(() => {
    if (!projectId) return;
    setData(null);
    setSelected(new Set());
    api
      .listIssues(projectId, {
        status: status === "all" ? undefined : status,
        sort,
        page,
        q: query || undefined,
        level: level || undefined,
      })
      .then(setData)
      .catch(() => setError("이슈 목록을 불러오지 못했습니다"));
  }, [projectId, status, sort, page, query, level]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setQuery(queryInput.trim());
  }

  useEffect(() => {
    reload();
  }, [reload]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkAction(newStatus: IssueStatus) {
    if (selected.size === 0) return;
    try {
      await api.bulkSetStatus([...selected], newStatus);
      reload();
    } catch {
      setError("일괄 변경에 실패했습니다");
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="page">
      <div className="page-head">
        <Link className="back-link" to="/">
          ← 프로젝트
        </Link>
        <h1 className="page-title">{project?.name ?? `#${projectId}`}</h1>
        {data && <span className="page-sub">이슈 {data.total}건</span>}
      </div>

      <form className="issue-search" onSubmit={onSearch}>
        <input
          type="text"
          placeholder="검색 — 텍스트 또는 browser:Chrome release:1.0.0"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
        />
        <button className="btn" type="submit">
          검색
        </button>
        {query && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setQueryInput("");
              setQuery("");
              setPage(1);
            }}
          >
            지우기
          </button>
        )}
      </form>

      <div className="issue-toolbar">
        <div className="seg" role="tablist">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              className={status === tab.value ? "active" : ""}
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as IssueSort);
            setPage(1);
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={level}
          onChange={(e) => {
            setLevel(e.target.value as Severity | "");
            setPage(1);
          }}
        >
          <option value="">모든 level</option>
          {SEVERITY_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        {selected.size > 0 && (
          <div className="bulk-bar">
            <span>{selected.size}건 선택</span>
            <button className="btn" onClick={() => void bulkAction("resolved")}>
              해결
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => void bulkAction("ignored")}
            >
              무시
            </button>
          </div>
        )}
      </div>

      {error ? (
        <div className="error-box">{error}</div>
      ) : !data ? (
        <div className="loading">불러오는 중...</div>
      ) : data.items.length === 0 ? (
        <div className="issue-list">
          <div className="list-empty">
            이슈가 없습니다 — DSN으로 이벤트를 보내면 여기에 표시됩니다
          </div>
        </div>
      ) : (
        <>
          <div className="issue-list">
            {data.items.map((issue) => (
              <div
                className="issue-row clickable"
                key={issue.id}
                onClick={() => navigate(`/issues/${issue.id}`)}
              >
                <div
                  className="level-bar"
                  style={{ background: LEVEL_COLORS[issue.level] }}
                />
                <input
                  type="checkbox"
                  className="row-check"
                  checked={selected.has(issue.id)}
                  onChange={() => toggleSelect(issue.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span
                  className="level-badge"
                  style={{ color: LEVEL_COLORS[issue.level] }}
                >
                  {issue.level}
                </span>
                <div className="issue-main">
                  <div className="issue-title" title={issue.title}>
                    {issue.title}
                    {issue.regression && (
                      <span className="regression-chip">재발</span>
                    )}
                  </div>
                  {issue.culprit && (
                    <div className="issue-culprit" title={issue.culprit}>
                      {issue.culprit}
                    </div>
                  )}
                </div>
                <div className="spark-cell">
                  <Sparkline data={issue.sparkline} />
                </div>
                <div className="metric">
                  {formatCount(issue.timesSeen)}
                  <small>events</small>
                </div>
                <div className="metric">
                  {formatCount(issue.userCount)}
                  <small>users</small>
                </div>
                <div className="issue-when" title={issue.lastSeen}>
                  {timeAgo(issue.lastSeen)}
                </div>
              </div>
            ))}
          </div>
          <div className="list-foot">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← 이전
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              다음 →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
