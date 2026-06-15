import { lt, sql } from "drizzle-orm";
import { EVENT_RETENTION_DAYS } from "@errortracking/shared";
import { db } from "../db/client";
import { events, releases } from "../db/schema";

/** 소스맵 아티팩트(릴리즈) 보관 기간 — 이벤트보다 길게 둘 수 있음 */
const ARTIFACT_RETENTION_DAYS = Number(
  process.env.ARTIFACT_RETENTION_DAYS ?? EVENT_RETENTION_DAYS,
);

const DAY_MS = 86_400_000;

/** now에서 days만큼 과거의 컷오프 Date */
export function cutoffDate(days: number, nowMs: number): Date {
  return new Date(nowMs - days * DAY_MS);
}

interface DeleteResult {
  rowCount: number | null;
}

/**
 * 보관 기간 경과 이벤트 삭제 — **필수, 없으면 DB 무한 증가**.
 * 이슈 요약(issues)은 영구 보관하므로 events만 지운다. 삭제 건수 반환.
 */
export async function deleteOldEvents(nowMs = Date.now()): Promise<number> {
  const cutoff = cutoffDate(EVENT_RETENTION_DAYS, nowMs);
  // returning 없이 rowCount만 — 대량 삭제 시 행을 메모리에 적재하지 않음
  const res = (await db.delete(events).where(lt(events.timestamp, cutoff))) as
    | DeleteResult
    | undefined;
  return res?.rowCount ?? 0;
}

/** 오래된 릴리즈 정리 — cascade로 소스맵 아티팩트도 삭제 */
export async function deleteOldArtifacts(nowMs = Date.now()): Promise<number> {
  const cutoff = cutoffDate(ARTIFACT_RETENTION_DAYS, nowMs);
  const res = (await db
    .delete(releases)
    .where(lt(releases.createdAt, cutoff))) as DeleteResult | undefined;
  return res?.rowCount ?? 0;
}

/** 전체 보관 정리 실행 */
export async function runRetention(
  nowMs = Date.now(),
): Promise<{ events: number; releases: number }> {
  return {
    events: await deleteOldEvents(nowMs),
    releases: await deleteOldArtifacts(nowMs),
  };
}

/** VACUUM 힌트용 — 대량 삭제 후 통계 갱신 (선택) */
export async function analyzeEvents(): Promise<void> {
  await db.execute(sql`ANALYZE events`);
}
