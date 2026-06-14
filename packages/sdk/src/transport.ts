import type { EventPayload } from "@errortracking/shared";

export interface Transport {
  send(payload: EventPayload): void;
  /** 페이지 이탈 시 잔여 이벤트를 sendBeacon으로 마지막 전송 */
  flush(): void;
}

/** 지수 백오프 지연(ms) — attempt 0,1,2… */
export function backoffDelay(attempt: number, base = 1000, max = 30_000): number {
  return Math.min(max, base * 2 ** attempt);
}

/** 429 Retry-After를 받으면 그 시각까지 전송을 멈추는 게이트 */
export class RateLimitGate {
  private pausedUntil = 0;

  isPaused(now: number): boolean {
    return now < this.pausedUntil;
  }

  pauseFor(retryAfterSec: number, now: number): void {
    const until = now + Math.max(0, retryAfterSec) * 1000;
    if (until > this.pausedUntil) this.pausedUntil = until;
  }
}

const MAX_RETRIES = 3;

export interface TransportDeps {
  fetchImpl?: typeof fetch;
  sendBeacon?: (url: string, data: string) => boolean;
  setTimeoutImpl?: (fn: () => void, ms: number) => void;
  now?: () => number;
}

/**
 * fetch 기반 전송 — text/plain simple request, credentials omit, keepalive.
 * 네트워크 실패 시 지수 백오프 재시도, 429 Retry-After 준수, flush 시 sendBeacon.
 */
export function createFetchTransport(
  endpoint: string,
  publicKey: string,
  deps: TransportDeps = {},
): Transport {
  const url = `${endpoint}?sentry_key=${encodeURIComponent(publicKey)}`;
  const doFetch = deps.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  const beacon =
    deps.sendBeacon ??
    (typeof navigator !== "undefined" && navigator.sendBeacon
      ? (u: string, d: string) => navigator.sendBeacon(u, d)
      : undefined);
  const schedule = deps.setTimeoutImpl ?? ((fn, ms) => void setTimeout(fn, ms));
  const now = deps.now ?? (() => Date.now());
  const gate = new RateLimitGate();
  const pending: string[] = [];

  function serialize(payload: EventPayload): string | null {
    try {
      return JSON.stringify(payload);
    } catch {
      return null;
    }
  }

  function attempt(body: string, retry: number): void {
    if (!doFetch || gate.isPaused(now())) {
      pending.push(body);
      return;
    }
    try {
      void doFetch(url, {
        method: "POST",
        body,
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        credentials: "omit",
        keepalive: true,
      })
        .then((res) => {
          if (res.status === 429) {
            const retryAfter = Number(res.headers?.get?.("Retry-After")) || 60;
            gate.pauseFor(retryAfter, now());
            return;
          }
          if (res.status >= 500 && retry < MAX_RETRIES) {
            schedule(() => attempt(body, retry + 1), backoffDelay(retry));
          }
        })
        .catch(() => {
          if (retry < MAX_RETRIES) {
            schedule(() => attempt(body, retry + 1), backoffDelay(retry));
          }
        });
    } catch {
      /* 무시 — SDK가 앱을 깨지 않는다 */
    }
  }

  return {
    send(payload) {
      const body = serialize(payload);
      if (body === null) return;
      attempt(body, 0);
    },
    flush() {
      if (!beacon) return;
      while (pending.length > 0) {
        const body = pending.shift()!;
        try {
          beacon(url, body);
        } catch {
          /* 무시 */
        }
      }
    },
  };
}
