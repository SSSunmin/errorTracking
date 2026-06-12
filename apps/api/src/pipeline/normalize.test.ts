import { describe, expect, it } from "vitest";
import type { Breadcrumb, EventPayload } from "@errortracking/shared";
import { normalizeEvent } from "./normalize";

function eventWith(overrides: Partial<EventPayload>): EventPayload {
  return {
    event_id: "a8450207-7ef8-4a37-b392-78da409a5001",
    timestamp: 1781253000,
    platform: "javascript",
    ...overrides,
  };
}

describe("normalizeEvent — 타임스탬프 보정", () => {
  it("epoch 초 단위를 Date로 변환한다", () => {
    const r = normalizeEvent(eventWith({ timestamp: 1781253000 }));
    expect(r.timestamp.getTime()).toBe(1781253000 * 1000);
  });

  it("epoch 밀리초 단위도 판별한다", () => {
    const r = normalizeEvent(eventWith({ timestamp: 1781253000123 }));
    expect(r.timestamp.getTime()).toBe(1781253000123);
  });

  it("누락 시 서버 시각으로 채운다", () => {
    const r = normalizeEvent(
      eventWith({ timestamp: undefined as unknown as number }),
    );
    expect(Math.abs(r.timestamp.getTime() - Date.now())).toBeLessThan(5000);
  });

  it("미래(1분 초과) 타임스탬프는 서버 시각으로 클램프한다", () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const r = normalizeEvent(eventWith({ timestamp: future }));
    expect(Math.abs(r.timestamp.getTime() - Date.now())).toBeLessThan(5000);
  });
});

describe("normalizeEvent — 기본값/트리밍", () => {
  it("잘못된 level은 error로 보정한다", () => {
    const r = normalizeEvent(
      eventWith({ level: "critical" as unknown as EventPayload["level"] }),
    );
    expect(r.level).toBe("error");
  });

  it("environment 기본값은 production", () => {
    expect(normalizeEvent(eventWith({})).environment).toBe("production");
  });

  it("8KB 초과 문자열은 트리밍한다", () => {
    const r = normalizeEvent(eventWith({ message: "x".repeat(10_000) }));
    expect(r.payload.message!.length).toBe(8193); // 8192 + 말줄임표
  });

  it("breadcrumbs는 최근 100개만 유지한다", () => {
    const crumbs: Breadcrumb[] = Array.from({ length: 150 }, (_, i) => ({
      timestamp: i,
      message: `crumb ${i}`,
    }));
    const r = normalizeEvent(eventWith({ breadcrumbs: { values: crumbs } }));
    expect(r.payload.breadcrumbs!.values).toHaveLength(100);
    // 오래된 쪽이 잘리고 최신이 남는다
    expect(r.payload.breadcrumbs!.values[0]!.message).toBe("crumb 50");
  });
});

describe("normalizeEvent — 프라이버시", () => {
  it("기본 정책: user.ip_address를 제거한다 (RECORD_IP 미설정)", () => {
    const r = normalizeEvent(
      eventWith({ user: { id: "u1", ip_address: "203.0.113.5" } }),
    );
    expect(r.payload.user!.ip_address).toBeUndefined();
    expect(r.payload.user!.id).toBe("u1");
  });

  it("민감정보 스크러빙이 통합 적용된다", () => {
    const r = normalizeEvent(
      eventWith({ extra: { password: "hunter2", safe: "ok" } }),
    );
    expect(r.payload.extra!["password"]).toBe("[REDACTED]");
    expect(r.payload.extra!["safe"]).toBe("ok");
  });

  it("원본 페이로드를 변형하지 않는다", () => {
    const original = eventWith({ extra: { password: "hunter2" } });
    normalizeEvent(original);
    expect(original.extra!["password"]).toBe("hunter2");
  });
});
