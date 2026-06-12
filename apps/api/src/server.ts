import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { MAX_EVENT_BYTES } from "@errortracking/shared";
import { pool } from "./db/client";
import { registerStoreRoute } from "./routes/store";

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
    bodyLimit: MAX_EVENT_BYTES, // 초과 시 413
  });

  // 브라우저 SDK는 cross-origin으로 전송 — 모든 origin 허용
  await app.register(cors, {
    origin: true,
    methods: ["POST", "GET", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Sentry-Auth"],
  });

  // 브라우저 SDK가 preflight 회피를 위해 text/plain으로 보내는 경우 JSON으로 파싱
  app.addContentTypeParser(
    "text/plain",
    { parseAs: "string" },
    (_req, body, done) => {
      try {
        done(null, JSON.parse(body as string));
      } catch {
        done(Object.assign(new Error("invalid JSON"), { statusCode: 400 }));
      }
    },
  );

  app.get("/healthz", async (_req, reply) => {
    await pool.query("SELECT 1");
    return reply.send({ ok: true });
  });

  registerStoreRoute(app);

  return app;
}
