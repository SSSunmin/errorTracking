import type { EventPayload } from "@errortracking/shared";

export interface IngestJob {
  projectId: number;
  payload: EventPayload;
}

/**
 * 처리 파이프라인 — STEP 3에서 구현:
 * 정규화 → (소스맵 심볼리케이션) → 핑거프린팅 → 이슈 upsert → events INSERT
 */
export async function processEvent(job: IngestJob): Promise<void> {
  console.log(
    `[pipeline] event ${job.payload.event_id} accepted for project ${job.projectId} — 처리 로직은 STEP 3에서 구현`,
  );
}
