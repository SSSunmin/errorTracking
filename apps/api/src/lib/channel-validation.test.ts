import { describe, expect, it } from "vitest";
import { isValidEmail, isValidSlackWebhook } from "./channel-validation";

describe("isValidEmail", () => {
  it("정상 이메일 허용", () => {
    expect(isValidEmail("team@example.com")).toBe(true);
  });
  it.each(["no-at", "a@b", "a@b.", "@b.com", "a b@c.com"])(
    "잘못된 이메일 거부: %s",
    (e) => expect(isValidEmail(e)).toBe(false),
  );
});

describe("isValidSlackWebhook", () => {
  it("정식 hooks.slack.com만 허용", () => {
    expect(
      isValidSlackWebhook("https://hooks.slack.com/services/T0/B0/xyz"),
    ).toBe(true);
  });

  it.each([
    "http://hooks.slack.com/x", // https 아님
    "https://hooks.slack.com.evil.com/x", // 서브도메인 위장
    "https://evil.com/hooks.slack.com", // 경로 위장
    "https://hooks.slack.com@evil.com/x", // userinfo 위장
    "https://internal.local/x", // 내부 SSRF
    "not-a-url",
    "",
  ])("우회/SSRF 시도 거부: %s", (u) => {
    expect(isValidSlackWebhook(u)).toBe(false);
  });
});
