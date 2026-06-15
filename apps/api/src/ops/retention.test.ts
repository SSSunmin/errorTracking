import { describe, expect, it } from "vitest";
import { cutoffDate } from "./retention";

describe("cutoffDate", () => {
  const NOW = new Date("2026-06-15T00:00:00Z").getTime();

  it("now에서 N일 과거를 계산한다", () => {
    expect(cutoffDate(90, NOW).toISOString()).toBe("2026-03-17T00:00:00.000Z");
  });

  it("0일이면 현재 시각", () => {
    expect(cutoffDate(0, NOW).getTime()).toBe(NOW);
  });

  it("1일은 정확히 24시간 전", () => {
    expect(NOW - cutoffDate(1, NOW).getTime()).toBe(86_400_000);
  });
});
