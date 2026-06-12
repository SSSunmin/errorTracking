import { PROJECT_RATE_LIMIT_PER_MINUTE } from "@errortracking/shared";

const WINDOW_MS = 60_000;

/** 분당 허용량 — 테스트용으로 env 오버라이드 가능 */
export const RATE_LIMIT_PER_MINUTE = Number(
  process.env.RATE_LIMIT_PER_MINUTE ?? PROJECT_RATE_LIMIT_PER_MINUTE,
);

interface Bucket {
  windowStart: number;
  count: number;
}

const buckets = new Map<number, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  /** 차단 시 429 응답의 Retry-After (초) */
  retryAfterSec: number;
}

/** 프로젝트별 고정 윈도우(1분) 카운터 — 단일 프로세스 전제라 인메모리로 충분 */
export function checkRateLimit(
  projectId: number,
  now = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(projectId);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(projectId, { windowStart: now, count: 1 });
    return { allowed: true, retryAfterSec: 0 };
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_PER_MINUTE) {
    const retryAfterSec = Math.ceil(
      (bucket.windowStart + WINDOW_MS - now) / 1000,
    );
    return { allowed: false, retryAfterSec };
  }
  return { allowed: true, retryAfterSec: 0 };
}
