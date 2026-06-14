import { deleteExpiredSessions } from "./lib/session";
import { buildServer } from "./server";

const port = Number(process.env.PORT ?? 4000);

const app = await buildServer();

// 만료 세션 정리 잡 — 1시간마다, 프로세스를 붙잡지 않도록 unref
const SESSION_CLEANUP_INTERVAL_MS = 1000 * 60 * 60;
setInterval(() => {
  deleteExpiredSessions()
    .then((n) => {
      if (n > 0) app.log.info(`만료 세션 ${n}건 정리`);
    })
    .catch((err) => app.log.error(err, "세션 정리 실패"));
}, SESSION_CLEANUP_INTERVAL_MS).unref();

await app.listen({ port, host: "0.0.0.0" });
