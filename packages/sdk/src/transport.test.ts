import { describe, expect, it, vi } from "vitest";
import type { EventPayload } from "@errortracking/shared";
import {
  backoffDelay,
  createFetchTransport,
  RateLimitGate,
} from "./transport";

const EVENT = {
  event_id: "a8450207-7ef8-4a37-b392-78da409a5001",
  timestamp: 1,
  platform: "javascript",
} as EventPayload;

describe("backoffDelay", () => {
  it("지수적으로 증가한다", () => {
    expect(backoffDelay(0)).toBe(1000);
    expect(backoffDelay(1)).toBe(2000);
    expect(backoffDelay(2)).toBe(4000);
  });

  it("max를 넘지 않는다", () => {
    expect(backoffDelay(10, 1000, 30_000)).toBe(30_000);
  });
});

describe("RateLimitGate", () => {
  it("pauseFor 동안 isPaused=true, 이후 false", () => {
    const gate = new RateLimitGate();
    gate.pauseFor(60, 1000);
    expect(gate.isPaused(1000)).toBe(true);
    expect(gate.isPaused(60_000)).toBe(true);
    expect(gate.isPaused(61_001)).toBe(false);
  });

  it("더 긴 pause만 연장한다", () => {
    const gate = new RateLimitGate();
    gate.pauseFor(60, 0);
    gate.pauseFor(1, 0); // 더 짧음 — 무시
    expect(gate.isPaused(30_000)).toBe(true);
  });
});

describe("createFetchTransport", () => {
  function okResponse(status = 202) {
    return Promise.resolve({
      status,
      headers: { get: () => null },
    } as unknown as Response);
  }

  it("send는 sentry_key 쿼리를 붙여 POST한다", () => {
    const fetchImpl = vi.fn((_url: string, _opts?: RequestInit) => okResponse());
    const t = createFetchTransport("http://h/api/1/store/", "pubkey", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    t.send(EVENT);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, opts] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("http://h/api/1/store/?sentry_key=pubkey");
    expect(opts!.credentials).toBe("omit");
    expect(opts!.keepalive).toBe(true);
  });

  it("5xx면 백오프 재시도를 예약한다", async () => {
    const fetchImpl = vi.fn(() => okResponse(500));
    const schedule = vi.fn();
    const t = createFetchTransport("http://h/api/1/store/", "k", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      setTimeoutImpl: schedule,
      now: () => 0,
    });
    t.send(EVENT);
    await Promise.resolve();
    await Promise.resolve();
    expect(schedule).toHaveBeenCalled();
  });

  it("429를 받으면 이후 전송을 멈추고 pending에 쌓는다", async () => {
    let status = 429;
    const fetchImpl = vi.fn(() =>
      Promise.resolve({
        status,
        headers: { get: (h: string) => (h === "Retry-After" ? "60" : null) },
      } as unknown as Response),
    );
    const now = vi.fn(() => 1000);
    const beacon = vi.fn(() => true);
    const t = createFetchTransport("http://h/api/1/store/", "k", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now,
      sendBeacon: beacon,
    });
    t.send(EVENT); // 429 수신 → 게이트 일시정지
    await Promise.resolve();
    await Promise.resolve();
    status = 202;
    t.send(EVENT); // 정지 중 — fetch 추가 호출 없이 pending
    expect(fetchImpl).toHaveBeenCalledOnce();
    // flush는 pending을 beacon으로 보낸다
    t.flush();
    expect(beacon).toHaveBeenCalledOnce();
  });

  it("flush는 sendBeacon이 없으면 조용히 무시", () => {
    const t = createFetchTransport("http://h/api/1/store/", "k", {
      fetchImpl: vi.fn(() => okResponse()) as unknown as typeof fetch,
      sendBeacon: undefined,
    });
    expect(() => t.flush()).not.toThrow();
  });
});
