import { describe, expect, it } from "vitest";
import { generateEventId, normalizeEventId } from "./event-id";

describe("generateEventId", () => {
  it("32자 소문자 hex를 생성한다", () => {
    const id = generateEventId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it("호출마다 다른 값을 생성한다", () => {
    expect(generateEventId()).not.toBe(generateEventId());
  });
});

describe("normalizeEventId", () => {
  it("하이픈 없는 32 hex를 canonical UUID로 정규화한다", () => {
    expect(normalizeEventId("a84502077ef84a37b39278da409a5001")).toBe(
      "a8450207-7ef8-4a37-b392-78da409a5001",
    );
  });

  it("하이픈 있는 UUID는 그대로 canonical로 유지한다", () => {
    expect(normalizeEventId("a8450207-7ef8-4a37-b392-78da409a5001")).toBe(
      "a8450207-7ef8-4a37-b392-78da409a5001",
    );
  });

  it("대문자를 소문자로 변환한다", () => {
    expect(normalizeEventId("A84502077EF84A37B39278DA409A5001")).toBe(
      "a8450207-7ef8-4a37-b392-78da409a5001",
    );
  });

  it.each([
    "not-a-uuid",
    "a8450207",
    "z".repeat(32),
    123 as unknown as string,
    null as unknown as string,
    undefined as unknown as string,
  ])("잘못된 입력은 null을 반환한다: %s", (input) => {
    expect(normalizeEventId(input)).toBeNull();
  });
});
