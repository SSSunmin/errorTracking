import { describe, expect, it } from "vitest";
import { parseSearch } from "./search";

describe("parseSearch", () => {
  it("빈 입력은 text null, filters 없음", () => {
    expect(parseSearch(undefined)).toEqual({ text: null, filters: [] });
    expect(parseSearch("   ")).toEqual({ text: null, filters: [] });
  });

  it("free-text만", () => {
    expect(parseSearch("cannot read")).toEqual({
      text: "cannot read",
      filters: [],
    });
  });

  it("key:value 토큰을 필터로 분리", () => {
    expect(parseSearch("browser:Chrome")).toEqual({
      text: null,
      filters: [{ key: "browser", value: "Chrome" }],
    });
  });

  it("텍스트와 필터 혼합", () => {
    const r = parseSearch("cannot read browser:Chrome environment:production");
    expect(r.text).toBe("cannot read");
    expect(r.filters).toEqual([
      { key: "browser", value: "Chrome" },
      { key: "environment", value: "production" },
    ]);
  });

  it("key는 소문자로 정규화", () => {
    expect(parseSearch("Browser:Chrome").filters[0]!.key).toBe("browser");
  });

  it("value의 콜론/슬래시는 보존", () => {
    expect(parseSearch("release:app@1.2.3").filters[0]!.value).toBe("app@1.2.3");
  });
});
