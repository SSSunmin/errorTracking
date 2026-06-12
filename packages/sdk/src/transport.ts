import type { EventPayload } from "@errortracking/shared";

export interface Transport {
  send(payload: EventPayload): void;
}

/**
 * fetch 기반 전송.
 * - Content-Type text/plain → CORS preflight 없는 simple request (서버가 JSON으로 파싱)
 * - credentials omit → 수집 서버로 쿠키가 새지 않음
 * - keepalive → 페이지 이탈 직전 이벤트도 전송 시도
 * - SDK의 실패가 앱을 깨거나(throw) 재귀 보고를 일으키면 안 됨 — 전부 무시
 */
export function createFetchTransport(
  endpoint: string,
  publicKey: string,
  fetchImpl?: typeof fetch,
): Transport {
  const url = `${endpoint}?sentry_key=${encodeURIComponent(publicKey)}`;
  const doFetch = fetchImpl ?? globalThis.fetch?.bind(globalThis);
  return {
    send(payload) {
      if (!doFetch) return;
      let body: string;
      try {
        body = JSON.stringify(payload);
      } catch {
        return;
      }
      try {
        void doFetch(url, {
          method: "POST",
          body,
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          credentials: "omit",
          keepalive: true,
        }).catch(() => {});
      } catch {
        // 무시 — SDK가 앱 동작에 영향을 주지 않는다
      }
    },
  };
}
