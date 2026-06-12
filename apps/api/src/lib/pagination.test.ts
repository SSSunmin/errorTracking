import { describe, expect, it } from "vitest";
import { parsePagination } from "./pagination";

describe("parsePagination", () => {
  it("기본값: page 1, limit 25", () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 25, offset: 0 });
  });

  it("page/limit 파싱과 offset 계산", () => {
    expect(parsePagination({ page: "3", limit: "10" })).toEqual({
      page: 3,
      limit: 10,
      offset: 20,
    });
  });

  it("limit 상한 클램프 (기본 100)", () => {
    expect(parsePagination({ limit: "9999" }).limit).toBe(100);
  });

  it("0/음수/문자 입력은 기본값으로", () => {
    expect(parsePagination({ page: "0", limit: "-5" })).toEqual({
      page: 1,
      limit: 1,
      offset: 0,
    });
    expect(parsePagination({ page: "abc", limit: "xyz" })).toEqual({
      page: 1,
      limit: 25,
      offset: 0,
    });
  });

  it("옵션으로 기본/최대 limit 조정", () => {
    expect(
      parsePagination({}, { defaultLimit: 1, maxLimit: 10 }).limit,
    ).toBe(1);
    expect(
      parsePagination({ limit: "50" }, { maxLimit: 10 }).limit,
    ).toBe(10);
  });
});
