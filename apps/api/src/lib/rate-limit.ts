import { PROJECT_RATE_LIMIT_PER_MINUTE } from "@errortracking/shared";

const WINDOW_MS = 60_000;

/** 수집 엔드포인트 분당 허용량 — 테스트용으로 env 오버라이드 가능 */
export const RATE_LIMIT_PER_MINUTE = Number(
  process.env.RATE_LIMIT_PER_MINUTE ?? PROJECT_RATE_LIMIT_PER_MINUTE,
);

interface Bucket {
  windowStart: number;
  count: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  /** 차단 시 429 응답의 Retry-After (초) */
  retryAfterSec: number;
}

/**
 * 고정 윈도우(1분) 카운터 — 단일 프로세스 전제라 인메모리로 충분.
 * key 예: `project:2`(수집), `login:1.2.3.4`(로그인 brute-force 방지)
 */
export function checkRateLimit(
  key: string,
  opts?: { now?: number; limit?: number },
): RateLimitResult {
  const now = opts?.now ?? Date.now();
  const limit = opts?.limit ?? RATE_LIMIT_PER_MINUTE;
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { windowStart: now, count: 1 });
    return { allowed: true, retryAfterSec: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    const retryAfterSec = Math.ceil(
      (bucket.windowStart + WINDOW_MS - now) / 1000,
    );
    return { allowed: false, retryAfterSec };
  }
  return { allowed: true, retryAfterSec: 0 };
}

/** 테스트 전용 — 윈도우 상태 초기화 */
export function resetRateLimits(): void {
  buckets.clear();
}
