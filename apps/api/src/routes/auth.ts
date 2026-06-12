import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema";
import { hashPassword, verifyPassword } from "../lib/password";
import { checkRateLimit } from "../lib/rate-limit";
import {
  clearSessionCookie,
  getSessionUserId,
  requireAuth,
  setSessionCookie,
} from "../lib/session";

/** 로그인 brute-force 방지 — IP당 분당 시도 제한 */
const LOGIN_ATTEMPTS_PER_MINUTE = 10;

export function registerAuthRoutes(app: FastifyInstance): void {
  app.post("/api/auth/login", async (req, reply) => {
    const rate = checkRateLimit(`login:${req.ip}`, {
      limit: LOGIN_ATTEMPTS_PER_MINUTE,
    });
    if (!rate.allowed) {
      return reply
        .code(429)
        .header("Retry-After", String(rate.retryAfterSec))
        .send({ error: "too many login attempts" });
    }

    const body = req.body as { email?: unknown; password?: unknown } | null;
    if (
      typeof body?.email !== "string" ||
      typeof body?.password !== "string" ||
      !body.email ||
      !body.password
    ) {
      return reply.code(400).send({ error: "email and password required" });
    }
    const user = await db.query.users.findFirst({
      where: eq(users.email, body.email.trim().toLowerCase()),
    });
    if (!user) {
      // 타이밍으로 계정 존재 여부가 드러나지 않도록 동일 비용 소모
      await hashPassword(body.password);
      return reply.code(401).send({ error: "invalid credentials" });
    }
    if (!(await verifyPassword(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: "invalid credentials" });
    }
    setSessionCookie(reply, user.id);
    return reply.send({ id: user.id, email: user.email, name: user.name });
  });

  app.post(
    "/api/auth/logout",
    { preHandler: requireAuth },
    async (_req, reply) => {
      clearSessionCookie(reply);
      return reply.send({ ok: true });
    },
  );

  app.get("/api/auth/me", { preHandler: requireAuth }, async (req, reply) => {
    const userId = getSessionUserId(req)!;
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) {
      clearSessionCookie(reply);
      return reply.code(401).send({ error: "authentication required" });
    }
    return reply.send({ id: user.id, email: user.email, name: user.name });
  });
}
