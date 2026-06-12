import { describe, expect, it } from "vitest";
import type { StackFrame } from "@errortracking/shared";
import { frameLocation, segmentFrames } from "./frames";

const f = (name: string, inApp: boolean | undefined): StackFrame => ({
  filename: `${name}.js`,
  function: name,
  in_app: inApp,
});

describe("segmentFrames", () => {
  it("표시 순서로 뒤집는다 (안쪽 프레임이 먼저)", () => {
    // 저장 순서: outermost → innermost
    const segments = segmentFrames([f("outer", true), f("inner", true)]);
    expect(segments).toHaveLength(1);
    expect(segments[0]!.frames.map((x) => x.function)).toEqual([
      "inner",
      "outer",
    ]);
  });

  it("연속 구간을 in_app별로 묶는다", () => {
    // 저장: [vendor, app1, app2, vendor2] → 표시: [vendor2, app2, app1, vendor]
    const segments = segmentFrames([
      f("vendor", false),
      f("app1", true),
      f("app2", true),
      f("vendor2", false),
    ]);
    expect(segments.map((s) => ({ inApp: s.inApp, n: s.frames.length }))).toEqual([
      { inApp: false, n: 1 },
      { inApp: true, n: 2 },
      { inApp: false, n: 1 },
    ]);
  });

  it("in_app 미지정은 시스템 프레임으로 취급", () => {
    const segments = segmentFrames([f("unknown", undefined)]);
    expect(segments[0]!.inApp).toBe(false);
  });

  it("빈 입력은 빈 배열", () => {
    expect(segmentFrames([])).toEqual([]);
  });
});

describe("frameLocation", () => {
  it("file:line:col 표기", () => {
    expect(
      frameLocation({ filename: "app.js", lineno: 10, colno: 5 }),
    ).toBe("app.js:10:5");
  });

  it("colno 없으면 file:line, lineno 없으면 file만", () => {
    expect(frameLocation({ filename: "app.js", lineno: 10 })).toBe("app.js:10");
    expect(frameLocation({ filename: "app.js" })).toBe("app.js");
  });

  it("filename 없으면 <unknown>", () => {
    expect(frameLocation({})).toBe("<unknown>");
  });
});
