import { describe, expect, it } from "vitest";
import {
  BreadcrumbBuffer,
  consoleBreadcrumb,
  domBreadcrumb,
  elementSelector,
  httpBreadcrumb,
  navigationBreadcrumb,
} from "./breadcrumbs";

describe("BreadcrumbBuffer", () => {
  it("추가한 순서대로 보관한다", () => {
    const b = new BreadcrumbBuffer(10);
    b.add({ timestamp: 1, message: "a" });
    b.add({ timestamp: 2, message: "b" });
    expect(b.getAll().map((c) => c.message)).toEqual(["a", "b"]);
  });

  it("max를 넘으면 오래된 것부터 밀어낸다", () => {
    const b = new BreadcrumbBuffer(3);
    for (let i = 0; i < 5; i++) b.add({ timestamp: i, message: `${i}` });
    expect(b.getAll().map((c) => c.message)).toEqual(["2", "3", "4"]);
  });

  it("getAll은 복사본 (외부 변경 격리)", () => {
    const b = new BreadcrumbBuffer();
    b.add({ timestamp: 1, message: "a" });
    b.getAll().push({ timestamp: 2, message: "x" });
    expect(b.getAll()).toHaveLength(1);
  });

  it("clear는 비운다", () => {
    const b = new BreadcrumbBuffer();
    b.add({ timestamp: 1 });
    b.clear();
    expect(b.getAll()).toEqual([]);
  });
});

describe("elementSelector", () => {
  it("id가 있으면 tag#id", () => {
    expect(elementSelector({ tagName: "BUTTON", id: "submit" } as Element)).toBe(
      "button#submit",
    );
  });

  it("id가 없으면 tag.첫클래스", () => {
    expect(
      elementSelector({ tagName: "DIV", id: "", className: "card active" } as Element),
    ).toBe("div.card");
  });

  it("tag만", () => {
    expect(
      elementSelector({ tagName: "SPAN", id: "", className: "" } as Element),
    ).toBe("span");
  });

  it("null은 <unknown>", () => {
    expect(elementSelector(null)).toBe("<unknown>");
  });
});

describe("breadcrumb 빌더", () => {
  it("domBreadcrumb은 ui.click 카테고리", () => {
    const c = domBreadcrumb("button#go");
    expect(c.category).toBe("ui.click");
    expect(c.message).toBe("button#go");
    expect(typeof c.timestamp).toBe("number");
  });

  it("navigationBreadcrumb은 from/to를 data에 담는다", () => {
    const c = navigationBreadcrumb("/a", "/b");
    expect(c.category).toBe("navigation");
    expect(c.data).toEqual({ from: "/a", to: "/b" });
  });

  it("httpBreadcrumb은 4xx/5xx면 error 타입", () => {
    expect(httpBreadcrumb("get", "/api", 200).type).toBe("default");
    expect(httpBreadcrumb("get", "/api", 500).type).toBe("error");
    expect(httpBreadcrumb("POST", "/api", 200).data).toEqual({
      method: "POST",
      url: "/api",
      status_code: 200,
    });
  });

  it("consoleBreadcrumb은 warn을 warning 레벨로 매핑", () => {
    expect(consoleBreadcrumb("warn", "msg").level).toBe("warning");
    expect(consoleBreadcrumb("error", "msg").level).toBe("error");
    expect(consoleBreadcrumb("log", "msg").type).toBe("default");
  });
});
