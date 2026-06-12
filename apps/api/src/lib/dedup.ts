/**
 * 수집 시점의 인메모리 중복 제거 (best-effort).
 * 최종 방어선은 events(project_id, event_id) UNIQUE 제약 — 파이프라인 INSERT에서 걸러진다.
 */
const MAX_ENTRIES = 10_000;

const seen = new Set<string>();

export function markAndCheckDuplicate(
  projectId: number,
  eventId: string,
): boolean {
  const key = `${projectId}:${eventId}`;
  if (seen.has(key)) return true;
  seen.add(key);
  if (seen.size > MAX_ENTRIES) {
    // Set은 삽입 순서를 유지하므로 가장 오래된 항목 제거 (LRU 근사)
    const oldest = seen.values().next().value;
    if (oldest !== undefined) seen.delete(oldest);
  }
  return false;
}
