import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  normalizeEventId,
  type EventPayload,
} from "@errortracking/shared";
import { db } from "../db/client";
import { events, projects } from "../db/schema";
import { extractPublicKey } from "../lib/auth";
import { markAndCheckDuplicate } from "../lib/dedup";
import { checkRateLimit } from "../lib/rate-limit";
import { enqueue } from "../queue";

interface StoreParams {
  projectId: string;
}

export function registerStoreRoute(app: FastifyInstance): void {
  app.post<{ Params: StoreParams }>(
    "/api/:projectId/store/",
    async (req, reply) => {
      const projectId = Number(req.params.projectId);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        return reply.code(404).send({ error: "unknown project" });
      }

      // 1. DSN public_key 인증
      const publicKey = extractPublicKey(req);
      if (!publicKey) {
        return reply.code(401).send({ error: "missing sentry_key" });
      }
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });
      if (!project) {
        return reply.code(404).send({ error: "unknown project" });
      }
      if (project.publicKey !== publicKey) {
        return reply.code(401).send({ error: "invalid sentry_key" });
      }

      // 2. 프로젝트별 rate limit → 초과 시 429 + Retry-After (SDK가 준수)
      const rate = checkRateLimit(`project:${projectId}`);
      if (!rate.allowed) {
        return reply
          .code(429)
          .header("Retry-After", String(rate.retryAfterSec))
          .send({ error: "rate limit exceeded" });
      }

      // 3. 페이로드 검증 — JSON 파싱 실패(400)와 크기 초과(413)는 Fastify 단계에서 처리됨
      const body = req.body;
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return reply.code(400).send({ error: "payload must be a JSON object" });
      }
      const eventId = normalizeEventId(
        (body as Record<string, unknown>)["event_id"],
      );
      if (!eventId) {
        return reply
          .code(400)
          .send({ error: "event_id must be a 32-char hex UUID" });
      }

      // 4. event_id 기준 중복 수신 제거 — 인메모리(빠른 경로) + DB(이미 처리된 이벤트)
      if (markAndCheckDuplicate(projectId, eventId)) {
        return reply.code(202).send({ id: eventId, duplicate: true });
      }
      const existing = await db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.eventId, eventId))
        .limit(1);
      if (existing.length > 0) {
        return reply.code(202).send({ id: eventId, duplicate: true });
      }

      // 5. 즉시 202 응답 후 비동기 처리 — 파이프라인 지연이 클라이언트에 영향 없도록.
      //    큐가 가득 차면 backpressure(503)로 메모리 고갈 방지.
      const payload = { ...(body as EventPayload), event_id: eventId };
      if (!enqueue({ projectId, payload })) {
        return reply
          .code(503)
          .header("Retry-After", "5")
          .send({ error: "server busy" });
      }
      return reply.code(202).send({ id: eventId });
    },
  );
}
