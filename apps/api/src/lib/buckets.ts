/** 시간 버킷 설정 — 추이 그래프/스파크라인 공용 */
export interface BucketConfig {
  /** 버킷 개수 */
  count: number;
  /** 버킷 폭(초) */
  bucketSec: number;
}

export const WINDOWS: Record<string, BucketConfig> = {
  "24h": { count: 24, bucketSec: 3600 },
  "14d": { count: 14, bucketSec: 86_400 },
};

/** 윈도우 시작 epoch(초) — now에서 count*bucket 만큼 과거 */
export function windowStartEpoch(config: BucketConfig, nowMs: number): number {
  return Math.floor(nowMs / 1000) - config.count * config.bucketSec;
}

/** 희소한 {idx, count} 행을 count 길이의 밀집 배열로 채운다 */
export function fillBuckets(
  rows: { idx: number; count: number }[],
  count: number,
): number[] {
  const out = new Array<number>(count).fill(0);
  for (const r of rows) {
    if (r.idx >= 0 && r.idx < count) out[r.idx] = (out[r.idx] ?? 0) + r.count;
  }
  return out;
}

/** {value, count} 행 → 비율 포함 분포(내림차순), null value 제외 */
export function toDistribution(
  rows: { value: string | null; count: number }[],
): { value: string; count: number; percent: number }[] {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return rows
    .filter((r): r is { value: string; count: number } => r.value != null)
    .map((r) => ({
      value: r.value,
      count: r.count,
      percent: total > 0 ? Math.round((r.count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}
