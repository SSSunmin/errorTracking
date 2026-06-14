import { describe, expect, it } from "vitest";
import {
  fillBuckets,
  toDistribution,
  windowStartEpoch,
  WINDOWS,
} from "./buckets";

describe("windowStartEpoch", () => {
  it("24h는 now에서 24시간 과거", () => {
    const now = 1_000_000 * 1000; // ms
    expect(windowStartEpoch(WINDOWS["24h"]!, now)).toBe(1_000_000 - 24 * 3600);
  });
});

describe("fillBuckets", () => {
  it("희소 행을 밀집 배열로 채운다", () => {
    expect(fillBuckets([{ idx: 0, count: 3 }, { idx: 2, count: 5 }], 4)).toEqual([
      3, 0, 5, 0,
    ]);
  });

  it("범위 밖 idx는 무시", () => {
    expect(fillBuckets([{ idx: -1, count: 9 }, { idx: 5, count: 9 }], 3)).toEqual(
      [0, 0, 0],
    );
  });

  it("같은 idx는 합산", () => {
    expect(fillBuckets([{ idx: 1, count: 2 }, { idx: 1, count: 3 }], 3)).toEqual(
      [0, 5, 0],
    );
  });
});

describe("toDistribution", () => {
  it("비율을 계산하고 내림차순 정렬", () => {
    const r = toDistribution([
      { value: "Chrome", count: 3 },
      { value: "Firefox", count: 1 },
    ]);
    expect(r).toEqual([
      { value: "Chrome", count: 3, percent: 75 },
      { value: "Firefox", count: 1, percent: 25 },
    ]);
  });

  it("null value는 제외", () => {
    const r = toDistribution([
      { value: null, count: 5 },
      { value: "Chrome", count: 5 },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.value).toBe("Chrome");
    // null 포함 total(10) 기준 percent
    expect(r[0]!.percent).toBe(50);
  });

  it("빈 입력은 빈 배열", () => {
    expect(toDistribution([])).toEqual([]);
  });
});
