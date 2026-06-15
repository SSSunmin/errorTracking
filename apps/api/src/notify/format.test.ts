import { describe, expect, it } from "vitest";
import {
  alertSubject,
  alertTextLines,
  slackPayload,
  type AlertContext,
} from "./format";

const CTX: AlertContext = {
  projectName: "checkout-web",
  issueTitle: "TypeError: x is undefined",
  level: "error",
  timesSeen: 42,
  environment: "production",
  link: "https://errtrack.example.com/issues/7",
};

describe("alertSubject", () => {
  it("프로젝트·타입·제목을 담는다", () => {
    expect(alertSubject("new_issue", CTX)).toBe(
      "[checkout-web] 새 이슈: TypeError: x is undefined",
    );
    expect(alertSubject("regression", CTX)).toContain("이슈 재발");
    expect(alertSubject("spike", CTX)).toContain("급증 감지");
  });
});

describe("alertTextLines", () => {
  it("제목·메타·링크를 포함", () => {
    const lines = alertTextLines("new_issue", CTX);
    expect(lines).toContain("TypeError: x is undefined");
    expect(lines.some((l) => l.includes("42회"))).toBe(true);
    expect(lines.some((l) => l.includes("production"))).toBe(true);
    expect(lines).toContain("https://errtrack.example.com/issues/7");
  });

  it("링크 없으면 링크 줄 생략", () => {
    const lines = alertTextLines("new_issue", { ...CTX, link: null });
    expect(lines.some((l) => l.startsWith("http"))).toBe(false);
  });
});

describe("slackPayload", () => {
  it("폴백 text와 blocks를 만든다", () => {
    const p = slackPayload("regression", CTX);
    expect(p.text).toContain("이슈 재발");
    expect(p.blocks.length).toBeGreaterThan(0);
    expect(JSON.stringify(p.blocks)).toContain(CTX.link);
  });

  it("링크 없으면 제목만(링크 마크업 없음)", () => {
    const p = slackPayload("new_issue", { ...CTX, link: null });
    expect(JSON.stringify(p.blocks)).not.toContain("<http");
  });
});
