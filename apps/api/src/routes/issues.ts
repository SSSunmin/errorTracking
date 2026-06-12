import type { FastifyInstance } from "fastify";
import { and, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { ISSUE_STATUSES, type IssueStatus } from "@errortracking/shared";
import { db } from "../db/client";
import { events, issues, projects } from "../db/schema";
import { parsePagination } from "../lib/pagination";
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

      const sortKey: SortKey =
        q.sort !== undefined && q.sort in SORT_COLUMNS
          ? (q.sort as SortKey)
          : "last_seen";

      const { page, limit, offset } = parsePagination(q);

      const where: SQL | undefined = status
        ? and(eq(issues.projectId, projectId), eq(issues.status, status))
        : eq(issues.projectId, projectId);

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

      return reply.send({
        items,
        total: total!.value,
        page,
        limit,
        sort: sortKey,
        status: status ?? null,
      });
    },
  );

  // 이슈 상세 — 목록 필드 + projectId
  app.get<{ Params: { issueId: string } }>(
    "/api/issues/:issueId",
    { preHandler: requireAuth },
    async (req, reply) => {
      const issue = await findIssue(req.params.issueId);
      if (!issue) return reply.code(404).send({ error: "unknown issue" });
      return reply.send(issue);
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
