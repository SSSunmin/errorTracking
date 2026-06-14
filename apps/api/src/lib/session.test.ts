import { describe, expect, it } from "vitest";
import { isExpired, newSessionId } from "./session";

describe("newSessionId", () => {
  it("64자 hex(32바이트)를 생성한다", () => {
    expect(newSessionId()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("호출마다 추측 불가능한 다른 값을 생성한다", () => {
    const ids = new Set(Array.from({ length: 100 }, () => newSessionId()));
    expect(ids.size).toBe(100);
  });
});

describe("isExpired", () => {
  const NOW = 1_000_000_000_000;

  it("만료 시각이 현재보다 과거면 true", () => {
    expect(isExpired(new Date(NOW - 1), NOW)).toBe(true);
  });

  it("만료 시각이 미래면 false", () => {
    expect(isExpired(new Date(NOW + 1000), NOW)).toBe(false);
  });

  it("정확히 만료 시각이면 만료로 본다(경계 포함)", () => {
    expect(isExpired(new Date(NOW), NOW)).toBe(true);
  });
});
