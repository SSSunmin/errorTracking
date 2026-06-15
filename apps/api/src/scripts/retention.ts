import { pool } from "../db/client";
import { runRetention } from "../ops/retention";

// cron에서 호출: pnpm --filter @errortracking/api retention
const result = await runRetention();
console.log(
  `[retention] 이벤트 ${result.events}건, 릴리즈 ${result.releases}건 삭제`,
);
await pool.end();
