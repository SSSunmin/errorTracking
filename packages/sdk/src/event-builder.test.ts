import { describe, expect, it } from "vitest";
import {
  buildExceptionEvent,
  buildMessageEvent,
  type BuildContext,
} from "./event-builder";

const CTX: BuildContext = {
  origin: "http://localhost:3000",
  url: "http://localhost:3000/checkout",
  ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  release: "demo@1.0.0",
  environment: "development",
};

describe("buildExceptionEvent", () => {
  it("기본 필드를 채운다 — event_id/timestamp/platform/sdk/contexts/request", () => {
    const p = buildExceptionEvent(new Error("boom"), "manual", CTX);
    expect(p.event_id).toMatch(/^[0-9a-f]{32}$/);
    expect(typeof p.timestamp).toBe("number");
    expect(p.platform).toBe("javascript");
    expect(p.level).toBe("error");
    expect(p.release).toBe("demo@1.0.0");
    expect(p.environment).toBe("development");
    expect(p.sdk?.name).toBe("@errortracking/sdk");
    expect(p.contexts?.browser?.name).toBe("Chrome");
    expect(p.contexts?.os?.name).toBe("Windows");
    expect(p.request?.url).toBe("http://localhost:3000/checkout");
  });

  it("Error의 type/value/stacktrace를 기록한다", () => {
    const err = new TypeError("bad access");
    const p = buildExceptionEvent(err, "onerror", CTX);
    const exc = p.exception!.values[0]!;
    expect(exc.type).toBe("TypeError");
    expect(exc.value).toBe("bad access");
    expect(exc.stacktrace!.frames.length).toBeGreaterThan(0);
    expect(exc.mechanism).toEqual({ type: "onerror", handled: false });
  });

  it("cause 체인을 oldest-first로 기록하고 mechanism은 대표(마지막)에만", () => {
    const root = new Error("root cause");
    const wrapper = new Error("wrapper", { cause: root });
    const p = buildExceptionEvent(wrapper, "manual", CTX);
    const values = p.exception!.values;
    expect(values).toHaveLength(2);
    expect(values[0]!.value).toBe("root cause");
    expect(values[0]!.mechanism).toBeUndefined();
    expect(values[1]!.value).toBe("wrapper");
    expect(values[1]!.mechanism?.type).toBe("manual");
  });

  it("Error가 아닌 throw 값(문자열/객체)도 처리한다", () => {
    const fromString = buildExceptionEvent("plain string", "onunhandledrejection", CTX);
    expect(fromString.exception!.values[0]).toMatchObject({
      type: "Error",
      value: "plain string",
    });
    const fromObject = buildExceptionEvent({ code: 42 }, "manual", CTX);
    expect(fromObject.exception!.values[0]!.value).toBe('{"code":42}');
  });

  it("8KB 초과 메시지는 클라이언트에서도 트리밍한다", () => {
    const err = new Error("x".repeat(10_000));
    const p = buildExceptionEvent(err, "manual", CTX);
    expect(p.exception!.values[0]!.value.length).toBe(8193);
  });
});

describe("buildMessageEvent", () => {
  it("message와 level을 기록한다", () => {
    const p = buildMessageEvent("deploy finished", "warning", CTX);
    expect(p.message).toBe("deploy finished");
    expect(p.level).toBe("warning");
    expect(p.exception).toBeUndefined();
  });

  it("호출마다 다른 event_id", () => {
    const a = buildMessageEvent("m", "info", CTX);
    const b = buildMessageEvent("m", "info", CTX);
    expect(a.event_id).not.toBe(b.event_id);
  });
});
