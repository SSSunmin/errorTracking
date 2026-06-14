import { describe, expect, it } from "vitest";
import { shouldSample } from "./sampling";

describe("shouldSample", () => {
  it("rate>=1이면 항상 전송", () => {
    expect(shouldSample(1, 0.99)).toBe(true);
    expect(shouldSample(2, 0.99)).toBe(true);
  });

  it("rate<=0이면 절대 전송 안 함", () => {
    expect(shouldSample(0, 0)).toBe(false);
    expect(shouldSample(-1, 0)).toBe(false);
  });

  it("rand<rate면 전송", () => {
    expect(shouldSample(0.5, 0.4)).toBe(true);
    expect(shouldSample(0.5, 0.6)).toBe(false);
    expect(shouldSample(0.5, 0.5)).toBe(false); // 경계
  });

  it("rate가 비정상(NaN)이면 안전하게 전송", () => {
    expect(shouldSample(NaN, 0.5)).toBe(true);
  });
});
