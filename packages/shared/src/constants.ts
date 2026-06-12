/**
 * STEP 0 설계 결정값 (docs/todo-backend.md STEP 0)
 * 값 변경 시 SDK·API가 모두 이 상수를 참조하므로 여기만 고치면 된다.
 */

/** 이벤트 1건 최대 크기. 체크리스트 허용 범위 200KB~1MB 중 상한 채택 */
export const MAX_EVENT_BYTES = 1_048_576;

/** 원본 이벤트 보관 기간 (일). 경과 시 삭제 — 이슈 요약은 영구 보관 */
export const EVENT_RETENTION_DAYS = 90;

/** 프로젝트별 수집 rate limit (분당 건수). 초과 시 429 + Retry-After */
export const PROJECT_RATE_LIMIT_PER_MINUTE = 300;

/** SDK Breadcrumbs 링 버퍼 크기 */
export const MAX_BREADCRUMBS = 100;

/** 수집 엔드포인트 인증 헤더 이름 */
export const AUTH_HEADER = "X-Sentry-Auth";
