/**
 * 서버 측 민감정보 스크러빙 (2차 방어) — 클라이언트 beforeSend가 1차.
 * 키 이름 기반 마스킹 + 카드번호 패턴 마스킹.
 */

const SENSITIVE_KEY =
  /password|passwd|secret|token|api[_-]?key|authorization|cookie|credit[_-]?card|card[_-]?number|cvv|ssn|private[_-]?key/i;

/** 13~19자리 숫자(공백/하이픈 허용) — 카드번호 형태 */
const CARD_PATTERN = /\b\d(?:[ -]?\d){12,18}\b/g;

export const REDACTED = "[REDACTED]";

export function scrubSensitive<T>(value: T): T {
  return scrubValue(value) as T;
}

function scrubValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(CARD_PATTERN, REDACTED);
  }
  if (Array.isArray(value)) {
    return value.map(scrubValue);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : scrubValue(v);
    }
    return out;
  }
  return value;
}
