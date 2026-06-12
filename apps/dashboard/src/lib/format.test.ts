import { describe, expect, it } from "vitest";
import { formatCount, timeAgo } from "./format";

const NOW = new Date("2026-06-12T12:00:00Z").getTime();

describe("timeAgo", () => {
  it("1분 미만은 '방금 전'", () => {
    expect(timeAgo("2026-06-12T11:59:30Z", NOW)).toBe("방금 전");
  });

  it("분/시간/일 단위", () => {
    expect(timeAgo("2026-06-12T11:45:00Z", NOW)).toBe("15분 전");
    expect(timeAgo("2026-06-12T09:00:00Z", NOW)).toBe("3시간 전");
    expect(timeAgo("2026-06-10T12:00:00Z", NOW)).toBe("2일 전");
  });

  it("30일 이상은 날짜 표기", () => {
    expect(timeAgo("2026-04-01T12:00:00Z", NOW)).toBe("2026-04-01");
  });

  it("잘못된 입력은 '-'", () => {
    expect(timeAgo("garbage", NOW)).toBe("-");
  });
});

describe("formatCount", () => {
  it("1000 미만은 그대로", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
  });

  it("천 단위 축약", () => {
    expect(formatCount(1000)).toBe("1k");
    expect(formatCount(1234)).toBe("1.2k");
    expect(formatCount(45_600)).toBe("45.6k");
  });

  it("백만 단위 축약", () => {
    expect(formatCount(1_200_000)).toBe("1.2m");
    expect(formatCount(2_000_000)).toBe("2m");
  });
});
