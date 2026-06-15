import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { artifacts, projects, releases } from "../db/schema";
import { checkRateLimit } from "../lib/rate-limit";

/** 소스맵 업로드 최대 크기 (이벤트 1MB보다 큼) */
const UPLOAD_BODY_LIMIT = 20 * 1024 * 1024;

/** 업로드 시도 제한 — IP당 분당 (토큰 무차별 방지) */
const UPLOAD_ATTEMPTS_PER_MINUTE = 30;

/** 업로드 인증 — 프로젝트 secret_key (X-Upload-Token 헤더) */
function extractUploadToken(req: FastifyRequest): string | null {
  const header = req.headers["x-upload-token"];
  return typeof header === "string" && header.length > 0 ? header : null;
}

/** 타이밍 사이드채널 안전 토큰 비교 */
function tokenMatches(expected: string, got: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function registerReleaseRoutes(app: FastifyInstance): void {
  app.post<{
    Params: { projectId: string; version: string };
    Body: { name?: unknown; content?: unknown };
  }>(
    "/api/:projectId/releases/:version/files/",
    { bodyLimit: UPLOAD_BODY_LIMIT },
    async (req, reply) => {
      const projectId = Number(req.params.projectId);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        return reply.code(404).send({ error: "unknown project" });
      }

      // 토큰 무차별 방지 — IP당 시도 제한
      const rate = checkRateLimit(`upload:${req.ip}`, {
        limit: UPLOAD_ATTEMPTS_PER_MINUTE,
      });
      if (!rate.allowed) {
        return reply
          .code(429)
          .header("Retry-After", String(rate.retryAfterSec))
          .send({ error: "too many upload attempts" });
      }

      // secret_key 인증 (타이밍 안전 비교)
      const token = extractUploadToken(req);
      if (!token) {
        return reply.code(401).send({ error: "missing upload token" });
      }
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });
      if (!project) return reply.code(404).send({ error: "unknown project" });
      if (!tokenMatches(project.secretKey, token)) {
        return reply.code(401).send({ error: "invalid upload token" });
      }

      const version = req.params.version.trim();
      if (!version) {
        return reply.code(400).send({ error: "version required" });
      }
      const body = req.body;
      if (
        typeof body?.name !== "string" ||
        !body.name.trim() ||
        typeof body?.content !== "string" ||
        !body.content
      ) {
        return reply.code(400).send({ error: "name and content required" });
      }

      // 릴리즈 찾거나 생성
      let [release] = await db
        .select({ id: releases.id })
        .from(releases)
        .where(
          and(eq(releases.projectId, projectId), eq(releases.version, version)),
        )
        .limit(1);
      if (!release) {
        [release] = await db
          .insert(releases)
          .values({ projectId, version })
          .onConflictDoNothing()
          .returning({ id: releases.id });
        if (!release) {
          // 동시 생성 경합 — 다시 조회
          [release] = await db
            .select({ id: releases.id })
            .from(releases)
            .where(
              and(
                eq(releases.projectId, projectId),
                eq(releases.version, version),
              ),
            )
            .limit(1);
        }
      }

      // 아티팩트 upsert (release_id, name)
      await db
        .insert(artifacts)
        .values({
          releaseId: release!.id,
          name: body.name.trim(),
          content: body.content,
        })
        .onConflictDoUpdate({
          target: [artifacts.releaseId, artifacts.name],
          set: { content: body.content, uploadedAt: new Date() },
        });

      return reply.code(201).send({
        release: version,
        name: body.name.trim(),
        bytes: body.content.length,
      });
    },
  );
}
