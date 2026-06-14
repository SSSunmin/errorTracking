import type { FastifyInstance } from "fastify";
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  ISSUE_STATUSES,
  SEVERITY_LEVELS,
  type IssueStatus,
  type Severity,
} from "@errortracking/shared";
import { db } from "../db/client";
import { events, issues, projects } from "../db/schema";
import { fillBuckets, toDistribution, WINDOWS, windowStartEpoch } from "../lib/buckets";
import { parsePagination } from "../lib/pagination";
import { parseSearch, type SearchFilter } from "../lib/search";
import { requireAuth } from "../lib/session";

/** 정렬 키 → 컬럼 매핑: 최근 발생순 / 첫 발생순 / 발생 빈도순 */
const SORT_COLUMNS = {
  last_seen: issues.lastSeen,
  first_seen: issues.firstSeen,
  times_seen: issues.timesSeen,
} as const;

type SortKey = keyof typeof SORT_COLUMNS;

/** 일괄 상태 변경 1회 최대 건수 */
const MAX_BULK_IDS = 100;

interface IssueListQuery {
  status?: string;
  sort?: string;
  page?: string;
  limit?: string;
  /** free-text + `key:value` 태그 검색 */
  q?: string;
  level?: string;
}

export function registerIssueRoutes(app: FastifyInstance): void {
  app.get<{ Params: { projectId: string }; Querystring: IssueListQuery }>(
    "/api/projects/:projectId/issues",
    { preHandler: requireAuth },
    async (req, reply) => {
      const projectId = Number(req.params.projectId);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        return reply.code(404).send({ error: "unknown project" });
      }
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });
      if (!project) return reply.code(404).send({ error: "unknown project" });

      const q = req.query;

      let status: IssueStatus | undefined;
      if (q.status !== undefined) {
        if (!(ISSUE_STATUSES as readonly string[]).includes(q.status)) {
          return reply.code(400).send({ error: "invalid status" });
        }
        status = q.status as IssueStatus;
      }

      let level: Severity | undefined;
      if (q.level !== undefined) {
        if (!(SEVERITY_LEVELS as readonly string[]).includes(q.level)) {
          return reply.code(400).send({ error: "invalid level" });
        }
        level = q.level as Severity;
      }

      const sortKey: SortKey =
        q.sort !== undefined && q.sort in SORT_COLUMNS
          ? (q.sort as SortKey)
          : "last_seen";

      const { page, limit, offset } = parsePagination(q);

      // WHERE 조립 — 상태/level + 제목 텍스트 + 태그(이벤트 EXISTS) 필터
      const conds: SQL[] = [eq(issues.projectId, projectId)];
      if (status) conds.push(eq(issues.status, status));
      if (level) conds.push(eq(issues.level, level));
      const parsed = parseSearch(q.q);
      if (parsed.text) conds.push(ilike(issues.title, `%${parsed.text}%`));
      for (const f of parsed.filters) conds.push(tagExists(f));
      const where = and(...conds);

      const [items, [total]] = await Promise.all([
        db
          .select({
            id: issues.id,
            title: issues.title,
            culprit: issues.culprit,
            level: issues.level,
            status: issues.status,
            regression: issues.regression,
            firstSeen: issues.firstSeen,
            lastSeen: issues.lastSeen,
            timesSeen: issues.timesSeen,
            userCount: issues.userCount,
          })
          .from(issues)
          .where(where)
          .orderBy(desc(SORT_COLUMNS[sortKey]), desc(issues.id))
          .limit(limit)
          .offset(offset),
        db.select({ value: count() }).from(issues).where(where),
      ]);

      const sparklines = await sparklinesFor(items.map((i) => i.id));

      return reply.send({
        items: items.map((i) => ({ ...i, sparkline: sparklines[i.id] ?? [] })),
        total: total!.value,
        page,
        limit,
        sort: sortKey,
        status: status ?? null,
      });
    },
  );

  // 이슈 상세
  app.get<{ Params: { issueId: string } }>(
    "/api/issues/:issueId",
    { preHandler: requireAuth },
    async (req, reply) => {
      const issue = await findIssue(req.params.issueId);
      if (!issue) return reply.code(404).send({ error: "unknown issue" });
      return reply.send(issue);
    },
  );

  // 발생 추이 — 시간대별 버킷 (window=24h|14d)
  app.get<{ Params: { issueId: string }; Querystring: { window?: string } }>(
    "/api/issues/:issueId/stats",
    { preHandler: requireAuth },
    async (req, reply) => {
      const issue = await findIssue(req.params.issueId);
      if (!issue) return reply.code(404).send({ error: "unknown issue" });

      const windowKey = req.query.window === "14d" ? "14d" : "24h";
      const config = WINDOWS[windowKey]!;
      const startEpoch = windowStartEpoch(config, Date.now());
      const idxExpr = sql<number>`floor((extract(epoch from ${events.timestamp}) - ${startEpoch}) / ${config.bucketSec})::int`;

      // GROUP BY/ORDER BY는 출력 컬럼 순번(idx=1)으로 — 파라미터 표현식 재바인딩 회피
      const rows = await db
        .select({ idx: idxExpr, count: sql<number>`count(*)::int` })
        .from(events)
        .where(
          and(
            eq(events.issueId, issue.id),
            gte(events.timestamp, new Date(startEpoch * 1000)),
          ),
        )
        .groupBy(sql`1`)
        .orderBy(sql`1`);

      return reply.send({
        window: windowKey,
        bucketSec: config.bucketSec,
        startEpoch,
        buckets: fillBuckets(rows, config.count),
      });
    },
  );

  // 태그 분포 — browser/os/release/environment별 비율
  app.get<{ Params: { issueId: string } }>(
    "/api/issues/:issueId/tags",
    { preHandler: requireAuth },
    async (req, reply) => {
      const issue = await findIssue(req.params.issueId);
      if (!issue) return reply.code(404).send({ error: "unknown issue" });

      const exprs: Record<string, SQL<string | null>> = {
        browser: sql`${events.payload} #>> '{contexts,browser,name}'`,
        os: sql`${events.payload} #>> '{contexts,os,name}'`,
        release: sql`${events.release}`,
        environment: sql`${events.environment}`,
      };

      const out: Record<
        string,
        { value: string; count: number; percent: number }[]
      > = {};
      for (const [key, expr] of Object.entries(exprs)) {
        const rows = await db
          .select({ value: expr, count: sql<number>`count(*)::int` })
          .from(events)
          .where(eq(events.issueId, issue.id))
          .groupBy(expr);
        out[key] = toDistribution(rows);
      }
      return reply.send(out);
    },
  );

  // 동일 이슈의 개별 이벤트 페이지네이션 — payload(원본 JSON) 포함, 최신순
  app.get<{
    Params: { issueId: string };
    Querystring: { page?: string; limit?: string };
  }>(
    "/api/issues/:issueId/events",
    { preHandler: requireAuth },
    async (req, reply) => {
      const issue = await findIssue(req.params.issueId);
      if (!issue) return reply.code(404).send({ error: "unknown issue" });

      const { page, limit, offset } = parsePagination(req.query, {
        defaultLimit: 1,
        maxLimit: 50,
      });

      const [items, [total]] = await Promise.all([
        db
          .select({
            id: events.id,
            eventId: events.eventId,
            payload: events.payload,
            timestamp: events.timestamp,
            release: events.release,
            environment: events.environment,
            receivedAt: events.receivedAt,
          })
          .from(events)
          .where(eq(events.issueId, issue.id))
          .orderBy(desc(events.timestamp), desc(events.id))
          .limit(limit)
          .offset(offset),
        db
          .select({ value: count() })
          .from(events)
          .where(eq(events.issueId, issue.id)),
      ]);

      return reply.send({ items, total: total!.value, page, limit });
    },
  );

  // 상태 변경 — Resolve / Ignore / Reopen. resolve 시 regression 플래그 해제
  app.patch<{ Params: { issueId: string } }>(
    "/api/issues/:issueId",
    { preHandler: requireAuth },
    async (req, reply) => {
      const issue = await findIssue(req.params.issueId);
      if (!issue) return reply.code(404).send({ error: "unknown issue" });
      const status = parseStatus(req.body);
      if (!status) return reply.code(400).send({ error: "invalid status" });

      const [updated] = await db
        .update(issues)
        .set({
          status,
          regression:
            status === "resolved" ? false : sql`${issues.regression}`,
        })
        .where(eq(issues.id, issue.id))
        .returning();
      return reply.send(updated);
    },
  );

  // 일괄 상태 변경 — { ids: number[], status }
  app.patch("/api/issues", { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body as { ids?: unknown; status?: unknown } | null;
    const status = parseStatus(body);
    if (!status) return reply.code(400).send({ error: "invalid status" });
    if (
      !Array.isArray(body?.ids) ||
      body.ids.length === 0 ||
      body.ids.length > MAX_BULK_IDS ||
      !body.ids.every((id) => Number.isInteger(id) && (id as number) > 0)
    ) {
      return reply
        .code(400)
        .send({ error: `ids must be 1~${MAX_BULK_IDS} positive integers` });
    }

    const updated = await db
      .update(issues)
      .set({
        status,
        regression: status === "resolved" ? false : sql`${issues.regression}`,
      })
      .where(inArray(issues.id, body.ids as number[]))
      .returning({ id: issues.id });
    return reply.send({ updated: updated.length });
  });
}

/** 태그 검색 → 해당 이벤트가 존재하는 이슈만 (EXISTS 상관 서브쿼리) */
function tagExists(filter: SearchFilter): SQL {
  const { key, value } = filter;
  let match: SQL;
  switch (key) {
    case "browser":
      match = sql`ev.payload #>> '{contexts,browser,name}' = ${value}`;
      break;
    case "os":
      match = sql`ev.payload #>> '{contexts,os,name}' = ${value}`;
      break;
    case "release":
      match = sql`ev.release = ${value}`;
      break;
    case "environment":
      match = sql`ev.environment = ${value}`;
      break;
    default:
      // 커스텀 태그 — 키를 파라미터로 안전하게 바인딩
      match = sql`ev.payload #>> ARRAY['tags', ${key}] = ${value}`;
  }
  return sql`EXISTS (SELECT 1 FROM events ev WHERE ev.issue_id = ${issues.id} AND ${match})`;
}

/** 페이지 이슈들의 최근 24시간 시간대별 발생 수 (스파크라인용) */
async function sparklinesFor(ids: number[]): Promise<Record<number, number[]>> {
  if (ids.length === 0) return {};
  const config = WINDOWS["24h"]!;
  const startEpoch = windowStartEpoch(config, Date.now());
  const idxExpr = sql<number>`floor((extract(epoch from ${events.timestamp}) - ${startEpoch}) / ${config.bucketSec})::int`;

  const rows = await db
    .select({
      issueId: events.issueId,
      idx: idxExpr,
      count: sql<number>`count(*)::int`,
    })
    .from(events)
    .where(
      and(
        inArray(events.issueId, ids),
        gte(events.timestamp, new Date(startEpoch * 1000)),
      ),
    )
    // 출력 컬럼 순번(issueId=1, idx=2)으로 GROUP BY — 파라미터 재바인딩 회피
    .groupBy(sql`1`, sql`2`);

  const byIssue = new Map<number, { idx: number; count: number }[]>();
  for (const row of rows) {
    const arr = byIssue.get(row.issueId) ?? [];
    arr.push({ idx: row.idx, count: row.count });
    byIssue.set(row.issueId, arr);
  }
  const out: Record<number, number[]> = {};
  for (const id of ids) {
    out[id] = fillBuckets(byIssue.get(id) ?? [], config.count);
  }
  return out;
}

async function findIssue(idParam: string) {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return undefined;
  return db.query.issues.findFirst({ where: eq(issues.id, id) });
}

function parseStatus(body: unknown): IssueStatus | null {
  const status = (body as { status?: unknown } | null)?.status;
  return typeof status === "string" &&
    (ISSUE_STATUSES as readonly string[]).includes(status)
    ? (status as IssueStatus)
    : null;
}
