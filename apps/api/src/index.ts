import { deleteExpiredSessions } from "./lib/session";
import { runRetention } from "./ops/retention";
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

// 보관 기간 경과 데이터 삭제 잡 — 6시간마다 (별도 cron 미사용 단일 서버 전제).
// cron으로 돌리려면 `pnpm --filter @errortracking/api retention` 사용.
const RETENTION_INTERVAL_MS = 1000 * 60 * 60 * 6;
function runRetentionJob() {
  runRetention()
    .then((r) => {
      if (r.events > 0 || r.releases > 0) {
        app.log.info(`보관 정리: 이벤트 ${r.events}건, 릴리즈 ${r.releases}건`);
      }
    })
    .catch((err) => app.log.error(err, "보관 정리 실패"));
}
setInterval(runRetentionJob, RETENTION_INTERVAL_MS).unref();
runRetentionJob(); // 기동 직후 1회

await app.listen({ port, host: "0.0.0.0" });
