import { processEvent, type IngestJob } from "../pipeline";

/**
 * In-process FIFO 큐 — 단일 서버 전제(기획서 7장)에 따라 별도 워커/메시지 큐 없이
 * API 프로세스 안에서 순차 처리한다. 부하 분리가 필요해지면 apps/worker로 추출.
 */
const jobs: IngestJob[] = [];
let draining = false;

/** 큐 상한 — 초과 시 backpressure(수집 거부)로 메모리 고갈 DoS 방지 */
const MAX_QUEUE = Number(process.env.MAX_QUEUE ?? 10_000);

/** 적재 성공 여부 반환 — 가득 차면 false (호출부에서 503) */
export function enqueue(job: IngestJob): boolean {
  if (jobs.length >= MAX_QUEUE) return false;
  jobs.push(job);
  void drain();
  return true;
}

export function pendingCount(): number {
  return jobs.length;
}

async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (jobs.length > 0) {
      const job = jobs.shift()!;
      try {
        await processEvent(job);
      } catch (err) {
        // 파이프라인 실패가 수집을 막으면 안 된다 — 로그만 남기고 계속
        console.error(
          `[queue] processEvent failed for event ${job.payload.event_id}:`,
          err,
        );
      }
    }
  } finally {
    draining = false;
  }
}
