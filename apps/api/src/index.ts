import {
  EVENT_RETENTION_DAYS,
  MAX_EVENT_BYTES,
  PROJECT_RATE_LIMIT_PER_MINUTE,
} from "@errortracking/shared";

// 백엔드 STEP 1(DB 스키마)부터 docs/todo-backend.md 순서대로 구현한다.
// 비동기 처리 파이프라인(worker)은 우선 이 앱 안에서 시작하고, 필요해지면 apps/worker로 분리.
console.log("[api] scaffold ready", {
  MAX_EVENT_BYTES,
  EVENT_RETENTION_DAYS,
  PROJECT_RATE_LIMIT_PER_MINUTE,
});
