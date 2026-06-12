import type { FastifyInstance } from "fastify";
import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { ISSUE_STATUSES, type IssueStatus } from "@errortracking/shared";
import { db } from "../db/client";
import { issues, projects } from "../db/schema";
import { requireAuth } from "../lib/session";

/** 정렬 키 → 컬럼 매핑: 최근 발생순 / 첫 발생순 / 발생 빈도순 */
const SORT_COLUMNS = {
  last_seen: issues.lastSeen,
  first_seen: issues.firstSeen,
  times_seen: issues.timesSeen,
} as const;

type SortKey = keyof typeof SORT_COLUMNS;

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

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

      const page = Math.max(1, Number(q.page) || 1);
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, Number(q.limit) || DEFAULT_LIMIT),
      );

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
          .offset((page - 1) * limit),
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
}
