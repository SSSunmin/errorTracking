import { describe, expect, it } from "vitest";
import { TraceMap } from "@jridgewell/trace-mapping";
import { applySourceMap, basename, extractContext } from "./symbolicate";

describe("basename", () => {
  it("URL에서 파일명만 추출 (쿼리·해시 제거)", () => {
    expect(basename("https://app.example.com/assets/bundle.8a1b.js?v=2")).toBe(
      "bundle.8a1b.js",
    );
    expect(basename("/dist/main.js#x")).toBe("main.js");
    expect(basename("C:\\build\\app.js")).toBe("app.js");
  });

  it("없으면 null", () => {
    expect(basename(undefined)).toBeNull();
    expect(basename("")).toBeNull();
  });
});

describe("extractContext", () => {
  const src = "L1\nL2\nL3\nL4\nL5\nL6\nL7\nL8\nL9";

  it("앞뒤 5줄 + 해당 줄", () => {
    const ctx = extractContext(src, 6); // L6
    expect(ctx.context_line).toBe("L6");
    expect(ctx.pre_context).toEqual(["L1", "L2", "L3", "L4", "L5"]);
    expect(ctx.post_context).toEqual(["L7", "L8", "L9"]);
  });

  it("첫 줄은 pre 없음", () => {
    const ctx = extractContext(src, 1);
    expect(ctx.context_line).toBe("L1");
    expect(ctx.pre_context).toEqual([]);
  });

  it("범위 밖이면 빈 객체", () => {
    expect(extractContext(src, 99)).toEqual({});
    expect(extractContext(src, 0)).toEqual({});
  });
});

describe("applySourceMap", () => {
  // 손수 만든 소스맵: 생성 (line1,col0) → 원본 app.js line3
  // mappings "AAEA" = [genCol 0, source 0, origLine +2(0-based)=line3, origCol 0]
  const map = {
    version: 3 as const,
    sources: ["app.js"],
    sourcesContent: [
      "const a = 1;\nconst b = 2;\nthrow new Error('boom');\nconst c = 3;\nconst d = 4;",
    ],
    names: [],
    mappings: "AAEA",
  };

  it("minify된 위치를 원본 파일/라인으로 복원하고 컨텍스트를 붙인다", () => {
    const tracer = new TraceMap(map);
    const result = applySourceMap(
      { filename: "bundle.min.js", lineno: 1, colno: 1, in_app: true },
      tracer,
    );
    expect(result).not.toBeNull();
    expect(result!.filename).toBe("app.js");
    expect(result!.lineno).toBe(3);
    expect(result!.context_line).toBe("throw new Error('boom');");
    expect(result!.pre_context).toEqual(["const a = 1;", "const b = 2;"]);
    expect(result!.post_context).toEqual(["const c = 3;", "const d = 4;"]);
    // in_app 같은 기존 필드 보존
    expect(result!.in_app).toBe(true);
  });

  it("매핑 없는 위치는 null", () => {
    const tracer = new TraceMap(map);
    const result = applySourceMap(
      { filename: "bundle.min.js", lineno: 99, colno: 99 },
      tracer,
    );
    expect(result).toBeNull();
  });
});
