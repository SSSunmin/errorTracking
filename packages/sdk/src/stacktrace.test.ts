import { describe, expect, it } from "vitest";
import { markInApp, parseStack } from "./stacktrace";

const CHROME_STACK = `TypeError: Cannot read properties of undefined (reading 'foo')
    at handleClick (http://localhost:3000/src/app.js:10:5)
    at HTMLButtonElement.onclick (http://localhost:3000/:1:1)
    at Array.forEach (<anonymous>)`;

const FIREFOX_STACK = `handleClick@http://localhost:3000/src/app.js:10:5
onclick@http://localhost:3000/:1:1
@http://localhost:3000/main.js:2:3`;

describe("parseStack — Chrome 포맷", () => {
  it("함수명/파일/라인/컬럼을 파싱하고 안쪽 프레임을 마지막에 둔다", () => {
    const frames = parseStack(CHROME_STACK);
    expect(frames).toHaveLength(3);
    // 뒤집힌 순서: 안쪽(handleClick)이 마지막
    const innermost = frames[frames.length - 1]!;
    expect(innermost).toMatchObject({
      function: "handleClick",
      filename: "http://localhost:3000/src/app.js",
      lineno: 10,
      colno: 5,
    });
  });

  it("함수명 없는 프레임과 <anonymous>도 처리한다", () => {
    const frames = parseStack(CHROME_STACK);
    expect(frames[0]!.filename).toBe("<anonymous>");
    expect(frames[0]!.function).toBe("Array.forEach");
  });

  it("메시지 줄('TypeError: ...')은 프레임이 아니다", () => {
    expect(parseStack("Error: boom").length).toBe(0);
  });
});

describe("parseStack — Firefox/Safari 포맷", () => {
  it("fn@url:line:col 형식을 파싱한다", () => {
    const frames = parseStack(FIREFOX_STACK);
    expect(frames).toHaveLength(3);
    expect(frames[frames.length - 1]).toMatchObject({
      function: "handleClick",
      filename: "http://localhost:3000/src/app.js",
      lineno: 10,
      colno: 5,
    });
  });

  it("익명 프레임(@url)은 함수명 없이 파싱한다", () => {
    const frames = parseStack(FIREFOX_STACK);
    expect(frames[0]!.function).toBeUndefined();
    expect(frames[0]!.filename).toBe("http://localhost:3000/main.js");
  });
});

describe("parseStack — 엣지 케이스", () => {
  it("undefined/빈 문자열은 빈 배열", () => {
    expect(parseStack(undefined)).toEqual([]);
    expect(parseStack("")).toEqual([]);
  });
});

describe("markInApp", () => {
  const ORIGIN = "http://localhost:3000";

  it("같은 origin은 in_app=true", () => {
    const [f] = markInApp([{ filename: `${ORIGIN}/src/app.js` }], ORIGIN);
    expect(f!.in_app).toBe(true);
  });

  it("다른 origin(CDN)은 in_app=false", () => {
    const [f] = markInApp(
      [{ filename: "https://cdn.example.com/lib.js" }],
      ORIGIN,
    );
    expect(f!.in_app).toBe(false);
  });

  it("node_modules 경로는 in_app=false", () => {
    const [f] = markInApp(
      [{ filename: `${ORIGIN}/node_modules/react/index.js` }],
      ORIGIN,
    );
    expect(f!.in_app).toBe(false);
  });

  it("<anonymous>/native는 in_app=false", () => {
    const [f] = markInApp([{ filename: "<anonymous>" }], ORIGIN);
    expect(f!.in_app).toBe(false);
  });
});
