import {
  MAX_BREADCRUMBS,
  SEVERITY_LEVELS,
  scrubSensitive,
  type EventPayload,
  type Severity,
} from "@errortracking/shared";

/** IP 주소 기록 정책 — 기본 미기록(개인정보 최소화), env로 활성화 */
const RECORD_IP = process.env.RECORD_IP === "true";

/** 개별 문자열 필드 최대 길이 (크기 초과 트리밍) */
const MAX_STRING_LENGTH = 8192;

export interface NormalizedEvent {
  payload: EventPayload;
  /** 보정된 발생 시각 */
  timestamp: Date;
  level: Severity;
  release: string | null;
  environment: string | null;
}

export function normalizeEvent(raw: EventPayload): NormalizedEvent {
  const payload = structuredClone(raw);

  // 타임스탬프 보정 — 누락/파싱 불가/미래(1분 초과)는 서버 수신 시각으로
  const now = Date.now();
  let ts = parseTimestamp(payload.timestamp);
  if (!ts || ts.getTime() > now + 60_000) ts = new Date(now);
  payload.timestamp = Math.floor(ts.getTime() / 1000);

  // 누락 필드 기본값
  if (!payload.platform) payload.platform = "javascript";
  if (!payload.level || !(SEVERITY_LEVELS as readonly string[]).includes(payload.level)) {
    payload.level = "error";
  }
  if (!payload.environment) payload.environment = "production";

  // 크기 초과 트리밍
  if (payload.message) payload.message = truncate(payload.message);
  for (const exc of payload.exception?.values ?? []) {
    if (exc.value) exc.value = truncate(exc.value);
  }
  if (payload.breadcrumbs?.values) {
    payload.breadcrumbs.values = payload.breadcrumbs.values
      .slice(-MAX_BREADCRUMBS)
      .map((b) => (b.message ? { ...b, message: truncate(b.message) } : b));
  }

  // IP 기록 정책 적용
  if (!RECORD_IP && payload.user) {
    delete payload.user.ip_address;
  }

  // 민감정보 스크러빙 (마지막 — 보정된 전체 페이로드 대상)
  const scrubbed = scrubSensitive(payload);

  return {
    payload: scrubbed,
    timestamp: ts,
    level: scrubbed.level as Severity,
    release: scrubbed.release ?? null,
    environment: scrubbed.environment ?? null,
  };
}

function parseTimestamp(v: number | string | undefined): Date | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    // epoch seconds vs milliseconds 판별
    return new Date(v < 1e12 ? v * 1000 : v);
  }
  if (typeof v === "string") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function truncate(s: string, max = MAX_STRING_LENGTH): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
