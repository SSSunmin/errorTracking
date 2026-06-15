import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { alertRules, projects } from "../db/schema";
import { isValidEmail, isValidSlackWebhook } from "../lib/channel-validation";
import { requireAuth } from "../lib/session";

type AlertRule = typeof alertRules.$inferSelect;

/** 규칙 미존재 시 반환할 기본값 */
function defaults(projectId: number) {
  return {
    projectId,
    enabled: true,
    onNewIssue: true,
    onRegression: true,
    onSpike: false,
    email: null as string | null,
    slackWebhookUrl: null as string | null,
    updatedAt: null as Date | null,
  };
}

function serialize(rule: AlertRule) {
  return {
    projectId: rule.projectId,
    enabled: rule.enabled,
    onNewIssue: rule.onNewIssue,
    onRegression: rule.onRegression,
    onSpike: rule.onSpike,
    email: rule.email,
    slackWebhookUrl: rule.slackWebhookUrl,
    updatedAt: rule.updatedAt,
  };
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/** 빈 문자열/null은 미설정(null), 문자열은 trim. 검증 실패 시 Error */
function parseChannel(
  v: unknown,
  kind: "email" | "slack",
): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string") throw new Error(`invalid ${kind}`);
  const s = v.trim();
  if (!s) return null;
  if (kind === "email" && !isValidEmail(s)) {
    throw new Error("invalid email");
  }
  if (kind === "slack" && !isValidSlackWebhook(s)) {
    throw new Error("invalid slack webhook url");
  }
  return s;
}

export function registerAlertRuleRoutes(app: FastifyInstance): void {
  app.get<{ Params: { projectId: string } }>(
    "/api/projects/:projectId/alert-rule",
    { preHandler: requireAuth },
    async (req, reply) => {
      const projectId = Number(req.params.projectId);
      if (!(await projectExists(projectId))) {
        return reply.code(404).send({ error: "unknown project" });
      }
      const rule = await db.query.alertRules.findFirst({
        where: eq(alertRules.projectId, projectId),
      });
      return reply.send(rule ? serialize(rule) : defaults(projectId));
    },
  );

  app.put<{ Params: { projectId: string } }>(
    "/api/projects/:projectId/alert-rule",
    { preHandler: requireAuth },
    async (req, reply) => {
      const projectId = Number(req.params.projectId);
      if (!(await projectExists(projectId))) {
        return reply.code(404).send({ error: "unknown project" });
      }
      const body = (req.body ?? {}) as Record<string, unknown>;

      let email: string | null;
      let slackWebhookUrl: string | null;
      try {
        email = parseChannel(body.email, "email");
        slackWebhookUrl = parseChannel(body.slackWebhookUrl, "slack");
      } catch (err) {
        return reply
          .code(400)
          .send({ error: err instanceof Error ? err.message : "invalid input" });
      }

      const values = {
        projectId,
        enabled: asBool(body.enabled, true),
        onNewIssue: asBool(body.onNewIssue, true),
        onRegression: asBool(body.onRegression, true),
        onSpike: asBool(body.onSpike, false),
        email,
        slackWebhookUrl,
        updatedAt: new Date(),
      };

      const [saved] = await db
        .insert(alertRules)
        .values(values)
        .onConflictDoUpdate({
          target: alertRules.projectId,
          set: {
            enabled: values.enabled,
            onNewIssue: values.onNewIssue,
            onRegression: values.onRegression,
            onSpike: values.onSpike,
            email: values.email,
            slackWebhookUrl: values.slackWebhookUrl,
            updatedAt: values.updatedAt,
          },
        })
        .returning();
      return reply.send(serialize(saved!));
    },
  );
}

async function projectExists(projectId: number): Promise<boolean> {
  if (!Number.isInteger(projectId) || projectId <= 0) return false;
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  return !!project;
}
