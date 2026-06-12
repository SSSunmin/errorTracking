import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import cors, { type FastifyCorsOptions } from "@fastify/cors";
import { MAX_EVENT_BYTES } from "@errortracking/shared";
import { pool } from "./db/client";
import { SESSION_SECRET } from "./lib/session";
import { registerAuthRoutes } from "./routes/auth";
import { registerIssueRoutes } from "./routes/issues";
import { registerProjectRoutes } from "./routes/projects";
import { registerStoreRoute } from "./routes/store";

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
    bodyLimit: MAX_EVENT_BYTES, // 초과 시 413
  });

  // CORS 이원화:
  // - 수집 엔드포인트(store): 브라우저 SDK가 어디서든 전송 → 모든 origin, credentials 없음
  // - 대시보드 API: 세션 쿠키가 실리므로 허용 origin 목록으로 제한
  //   (임의 origin 반사 + credentials 조합은 세션 탈취 통로가 되므로 금지)
  const STORE_PATH = /^\/api\/\d+\/store\/?($|\?)/;
  const dashboardOrigins = (
    process.env.DASHBOARD_ORIGINS ??
    "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  await app.register(cors, () => (
    req: FastifyRequest,
    callback: (error: Error | null, options: FastifyCorsOptions) => void,
  ) => {
    if (STORE_PATH.test(req.url ?? "")) {
      callback(null, {
        origin: true,
        credentials: false,
        methods: ["POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "X-Sentry-Auth"],
      });
      return;
    }
    callback(null, {
      origin: dashboardOrigins,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
    });
  });

  await app.register(cookie, { secret: SESSION_SECRET });

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
  registerAuthRoutes(app);
  registerProjectRoutes(app);
  registerIssueRoutes(app);

  return app;
}
