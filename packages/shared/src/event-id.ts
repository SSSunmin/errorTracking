/**
 * event_id 규칙: UUID v4의 32자 소문자 hex (Sentry 동일).
 * SDK가 생성하고, 서버는 중복 제거 기준으로 사용한다.
 */

// 브라우저(Web Crypto)와 Node 19+ 모두 전역 crypto 제공 — DOM/node 타입 없이 최소 선언
declare const crypto: { randomUUID(): string };

/** 브라우저/Node 공통 — crypto.randomUUID 기반 */
export function generateEventId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/**
 * 하이픈 유무와 대소문자를 허용해 canonical UUID(하이픈 포함 소문자)로 정규화.
 * 형식이 아니면 null — 수집 API의 검증에 사용.
 */
export function normalizeEventId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const hex = raw.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
