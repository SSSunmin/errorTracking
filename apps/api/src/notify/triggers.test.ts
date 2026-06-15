import { describe, expect, it } from "vitest";
import { decideTrigger, isTriggerEnabled, withinDebounce } from "./triggers";

describe("decideTrigger", () => {
  it("새 이슈가 최우선", () => {
    expect(
      decideTrigger({ isNew: true, wasResolved: true, spike: true }),
    ).toBe("new_issue");
  });

  it("재발은 새 이슈 다음", () => {
    expect(
      decideTrigger({ isNew: false, wasResolved: true, spike: true }),
    ).toBe("regression");
  });

  it("급증은 마지막", () => {
    expect(
      decideTrigger({ isNew: false, wasResolved: false, spike: true }),
    ).toBe("spike");
  });

  it("아무것도 아니면 null", () => {
    expect(
      decideTrigger({ isNew: false, wasResolved: false, spike: false }),
    ).toBeNull();
  });
});

describe("isTriggerEnabled", () => {
  const base = {
    enabled: true,
    onNewIssue: true,
    onRegression: true,
    onSpike: true,
  };

  it("규칙 비활성화면 모든 트리거 off", () => {
    const rule = { ...base, enabled: false };
    expect(isTriggerEnabled(rule, "new_issue")).toBe(false);
    expect(isTriggerEnabled(rule, "regression")).toBe(false);
    expect(isTriggerEnabled(rule, "spike")).toBe(false);
  });

  it("트리거별 플래그를 따른다", () => {
    expect(isTriggerEnabled({ ...base, onNewIssue: false }, "new_issue")).toBe(
      false,
    );
    expect(isTriggerEnabled({ ...base, onRegression: false }, "regression")).toBe(
      false,
    );
    expect(isTriggerEnabled({ ...base, onSpike: false }, "spike")).toBe(false);
    expect(isTriggerEnabled(base, "new_issue")).toBe(true);
  });
});

describe("withinDebounce", () => {
  const NOW = 1_000_000_000;

  it("최근 발송이 없으면 억제 안 함", () => {
    expect(withinDebounce(null, NOW)).toBe(false);
  });

  it("윈도우(1시간) 이내면 억제", () => {
    expect(withinDebounce(NOW - 60_000, NOW)).toBe(true);
  });

  it("윈도우 경과면 억제 안 함", () => {
    expect(withinDebounce(NOW - 3_600_001, NOW)).toBe(false);
  });
});
