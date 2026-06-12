import { describe, expect, it } from "vitest";
import type { EventPayload, StackFrame } from "@errortracking/shared";
import { computeFingerprint } from "./fingerprint";

function eventWith(overrides: Partial<EventPayload>): EventPayload {
  return {
    event_id: "a8450207-7ef8-4a37-b392-78da409a5001",
    timestamp: 1781253000,
    platform: "javascript",
    ...overrides,
  };
}

function exceptionEvent(
  type: string,
  value: string,
  frames: StackFrame[],
): EventPayload {
  return eventWith({
    exception: { values: [{ type, value, stacktrace: { frames } }] },
  });
}

const APP_FRAME: StackFrame = {
  filename: "https://app.example.com/assets/bundle.8a1b2c3d.js",
  function: "handleClick",
  in_app: true,
  lineno: 1,
  colno: 2345,
};

const VENDOR_FRAME: StackFrame = {
  filename: "https://app.example.com/assets/vendor.5f3a9c21.js",
  function: "t",
  in_app: false,
  lineno: 1,
  colno: 100,
};

describe("computeFingerprint — 스택 기반 그룹핑", () => {
  it("같은 에러는 같은 지문", () => {
    const a = computeFingerprint(exceptionEvent("TypeError", "boom", [APP_FRAME]));
    const b = computeFingerprint(exceptionEvent("TypeError", "boom", [APP_FRAME]));
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it("빌드 해시가 다른 파일명도 같은 지문 (해시 정규화)", () => {
    const a = computeFingerprint(exceptionEvent("TypeError", "boom", [APP_FRAME]));
    const b = computeFingerprint(
      exceptionEvent("TypeError", "boom", [
        { ...APP_FRAME, filename: "https://app.example.com/assets/bundle.ffee0011.js" },
      ]),
    );
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it("lineno/colno가 달라도 같은 지문 (minify 빌드 변동 무시)", () => {
    const a = computeFingerprint(exceptionEvent("TypeError", "boom", [APP_FRAME]));
    const b = computeFingerprint(
      exceptionEvent("TypeError", "boom", [{ ...APP_FRAME, lineno: 99, colno: 1 }]),
    );
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it("예외 타입이 다르면 다른 지문", () => {
    const a = computeFingerprint(exceptionEvent("TypeError", "boom", [APP_FRAME]));
    const b = computeFingerprint(exceptionEvent("RangeError", "boom", [APP_FRAME]));
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it("in_app 프레임이 있으면 vendor 프레임 변화는 지문에 영향 없음", () => {
    const a = computeFingerprint(
      exceptionEvent("TypeError", "boom", [VENDOR_FRAME, APP_FRAME]),
    );
    const b = computeFingerprint(
      exceptionEvent("TypeError", "boom", [
        { ...VENDOR_FRAME, function: "differentVendorFn" },
        APP_FRAME,
      ]),
    );
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it("in_app 프레임이 하나도 없으면 전체 프레임으로 폴백", () => {
    const a = computeFingerprint(exceptionEvent("TypeError", "boom", [VENDOR_FRAME]));
    const b = computeFingerprint(
      exceptionEvent("TypeError", "boom", [
        { ...VENDOR_FRAME, function: "other" },
      ]),
    );
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });
});

describe("computeFingerprint — 폴백/우선순위", () => {
  it("스택 없는 예외는 메시지 템플릿으로 그룹핑 (숫자 치환)", () => {
    const a = computeFingerprint(
      eventWith({ exception: { values: [{ type: "Error", value: "User 123 not found" }] } }),
    );
    const b = computeFingerprint(
      eventWith({ exception: { values: [{ type: "Error", value: "User 456 not found" }] } }),
    );
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it("uuid/hex도 템플릿 치환된다", () => {
    const a = computeFingerprint(
      eventWith({ message: "job a8450207-7ef8-4a37-b392-78da409a5001 failed" }),
    );
    const b = computeFingerprint(
      eventWith({ message: "job 11111111-2222-3333-4444-555555555555 failed" }),
    );
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it("메시지 전용 이벤트는 level이 다르면 다른 지문", () => {
    const a = computeFingerprint(eventWith({ message: "hi", level: "warning" }));
    const b = computeFingerprint(eventWith({ message: "hi", level: "error" }));
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it("커스텀 fingerprint가 스택보다 우선한다", () => {
    const a = computeFingerprint(
      exceptionEvent("TypeError", "boom", [APP_FRAME]),
    );
    const withCustom = { ...exceptionEvent("TypeError", "boom", [APP_FRAME]), fingerprint: ["checkout", "payment-fail"] };
    const b = computeFingerprint(withCustom);
    const c = computeFingerprint({ ...eventWith({}), fingerprint: ["checkout", "payment-fail"] });
    expect(b.fingerprint).not.toBe(a.fingerprint);
    expect(b.fingerprint).toBe(c.fingerprint);
  });
});

describe("computeFingerprint — title/culprit", () => {
  it("title은 '타입: 메시지' 형식", () => {
    const r = computeFingerprint(exceptionEvent("TypeError", "boom", [APP_FRAME]));
    expect(r.title).toBe("TypeError: boom");
  });

  it("culprit은 가장 안쪽 in_app 프레임", () => {
    const r = computeFingerprint(
      exceptionEvent("TypeError", "boom", [VENDOR_FRAME, APP_FRAME]),
    );
    expect(r.culprit).toBe(
      "handleClick (https://app.example.com/assets/bundle.8a1b2c3d.js:1)",
    );
  });

  it("메시지 전용 이벤트는 message가 title, culprit은 null", () => {
    const r = computeFingerprint(eventWith({ message: "plain message" }));
    expect(r.title).toBe("plain message");
    expect(r.culprit).toBeNull();
  });
});
