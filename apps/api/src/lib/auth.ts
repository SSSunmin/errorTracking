import type { FastifyRequest } from "fastify";

/**
 * DSN public_key 추출 — 두 경로 지원:
 * - `X-Sentry-Auth: Sentry sentry_key=<key>, sentry_version=7, ...` 헤더
 * - `?sentry_key=<key>` 쿼리 파라미터 (브라우저 SDK가 preflight 없이 보낼 때)
 */
export function extractPublicKey(req: FastifyRequest): string | null {
  const header = req.headers["x-sentry-auth"];
  if (typeof header === "string") {
    const match = /sentry_key=([\w-]+)/.exec(header);
    if (match) return match[1]!;
  }
  const query = req.query as Record<string, unknown>;
  const fromQuery = query["sentry_key"];
  return typeof fromQuery === "string" && fromQuery.length > 0
    ? fromQuery
    : null;
}
