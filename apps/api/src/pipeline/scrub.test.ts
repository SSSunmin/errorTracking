import { describe, expect, it } from "vitest";
import { REDACTED, scrubSensitive } from "./scrub";

describe("scrubSensitive — 키 이름 기반", () => {
  it.each([
    "password",
    "PASSWORD",
    "user_password",
    "secret",
    "access_token",
    "api_key",
    "apiKey",
    "authorization",
    "cookie",
    "credit_card",
    "card_number",
    "cvv",
    "ssn",
    "private_key",
  ])("민감 키 '%s'의 값을 마스킹한다", (key) => {
    const result = scrubSensitive({ [key]: "value" }) as Record<string, string>;
    expect(result[key]).toBe(REDACTED);
  });

  it("중첩 객체와 배열 내부도 마스킹한다", () => {
    const result = scrubSensitive({
      extra: { auth: { token: "abc" } },
      list: [{ password: "x" }],
    }) as { extra: { auth: { token: string } }; list: { password: string }[] };
    expect(result.extra.auth.token).toBe(REDACTED);
    expect(result.list[0]!.password).toBe(REDACTED);
  });

  it("민감하지 않은 키는 보존한다", () => {
    const input = { message: "hello", count: 3, flag: true, missing: null };
    expect(scrubSensitive(input)).toEqual(input);
  });
});

describe("scrubSensitive — 카드번호 패턴", () => {
  it("공백/하이픈 구분 카드번호를 마스킹한다", () => {
    expect(scrubSensitive("paid with 4111 1111 1111 1111 today")).toBe(
      `paid with ${REDACTED} today`,
    );
    expect(scrubSensitive("4111-1111-1111-1111")).toBe(REDACTED);
  });

  it("13자리(최소)와 19자리(최대)를 마스킹한다", () => {
    expect(scrubSensitive("4222222222222")).toBe(REDACTED); // 13자리
    expect(scrubSensitive("6011111111111111117")).toBe(REDACTED); // 19자리
  });

  it("12자리 이하 숫자는 건드리지 않는다", () => {
    expect(scrubSensitive("order 123456789012 done")).toBe(
      "order 123456789012 done",
    );
  });
});
