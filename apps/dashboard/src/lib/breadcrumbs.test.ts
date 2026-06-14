import { describe, expect, it } from "vitest";
import type { Breadcrumb } from "@errortracking/shared";
import { crumbStyle, crumbText, crumbTime } from "./breadcrumbs";

describe("crumbStyle", () => {
  it("ui.click → CLICK", () => {
    expect(crumbStyle({ timestamp: 1, category: "ui.click" }).label).toBe("CLICK");
  });

  it("http 4xx+는 error 색", () => {
    const ok = crumbStyle({ timestamp: 1, category: "http", data: { status_code: 200 } });
    const fail = crumbStyle({ timestamp: 1, category: "http", data: { status_code: 500 } });
    expect(ok.color).not.toBe("var(--level-error)");
    expect(fail.color).toBe("var(--level-error)");
  });

  it("console 레벨별 라벨", () => {
    expect(crumbStyle({ timestamp: 1, category: "console", level: "warning" }).label).toBe("WARN");
    expect(crumbStyle({ timestamp: 1, category: "console", level: "error" }).label).toBe("ERROR");
    expect(crumbStyle({ timestamp: 1, category: "console" }).label).toBe("LOG");
  });
});

describe("crumbText", () => {
  it("message 우선", () => {
    expect(crumbText({ timestamp: 1, message: "hello" })).toBe("hello");
  });

  it("http는 method url → status 요약", () => {
    const c: Breadcrumb = {
      timestamp: 1,
      category: "http",
      data: { method: "POST", url: "/api/x", status_code: 404 },
    };
    expect(crumbText(c)).toBe("POST /api/x → 404");
  });

  it("navigation은 from → to", () => {
    const c: Breadcrumb = {
      timestamp: 1,
      category: "navigation",
      data: { from: "/a", to: "/b" },
    };
    expect(crumbText(c)).toBe("/a → /b");
  });
});

describe("crumbTime", () => {
  it("epoch seconds를 HH:MM:SS로", () => {
    // 로컬 타임존 의존이므로 형식만 검증
    expect(crumbTime(1781480655)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("잘못된 값은 빈 문자열", () => {
    expect(crumbTime(NaN)).toBe("");
  });
});
