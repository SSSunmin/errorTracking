import {
  parseDsn,
  storeEndpoint,
  type Severity,
} from "@errortracking/shared";
import {
  buildExceptionEvent,
  buildMessageEvent,
  type BuildContext,
} from "./event-builder";
import { createFetchTransport, type Transport } from "./transport";

export interface InitOptions {
  dsn: string;
  release?: string;
  environment?: string;
}

interface SdkState {
  options: InitOptions;
  transport: Transport;
}

let state: SdkState | null = null;
let handlersInstalled = false;

export function init(options: InitOptions): void {
  const dsn = parseDsn(options.dsn);
  state = {
    options,
    transport: createFetchTransport(storeEndpoint(dsn), dsn.publicKey),
  };
  installGlobalHandlers();
}

/** 수동 캡처 — event_id 반환 (미초기화 시 no-op, 앱을 깨지 않는다) */
export function captureException(
  err: unknown,
  level: Severity = "error",
): string | null {
  if (!state) return null;
  const payload = buildExceptionEvent(err, "manual", buildContext(), level);
  state.transport.send(payload);
  return payload.event_id;
}

export function captureMessage(
  message: string,
  level: Severity = "info",
): string | null {
  if (!state) return null;
  const payload = buildMessageEvent(message, level, buildContext());
  state.transport.send(payload);
  return payload.event_id;
}

function buildContext(): BuildContext {
  return {
    origin: typeof location !== "undefined" ? location.origin : null,
    url: typeof location !== "undefined" ? location.href : undefined,
    ua: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    release: state?.options.release,
    environment: state?.options.environment,
  };
}

function installGlobalHandlers(): void {
  if (handlersInstalled || typeof window === "undefined") return;
  handlersInstalled = true;

  // window.onerror를 덮어쓰지 않도록 addEventListener 사용 (기존 핸들러 보존)
  window.addEventListener("error", (event) => {
    try {
      if (!state) return;
      // 리소스 로드 실패(이미지 등)는 ErrorEvent가 아님 — 런타임 에러만 캡처
      if (!(event instanceof ErrorEvent)) return;
      const err =
        event.error ??
        syntheticError(event.message, event.filename, event.lineno, event.colno);
      state.transport.send(
        buildExceptionEvent(err, "onerror", buildContext()),
      );
    } catch {
      // SDK 내부 오류는 무시 — 재귀 보고/앱 영향 금지
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    try {
      if (!state) return;
      state.transport.send(
        buildExceptionEvent(event.reason, "onunhandledrejection", buildContext()),
      );
    } catch {
      // 무시
    }
  });
}

/** error 객체 없이 발생한 onerror — 위치 정보만으로 합성 */
function syntheticError(
  message: string,
  filename: string | undefined,
  lineno: number | undefined,
  colno: number | undefined,
): { name: string; message: string; stack: string } {
  return {
    name: "Error",
    message,
    stack:
      filename !== undefined
        ? `Error: ${message}\n    at ${filename}:${lineno ?? 0}:${colno ?? 0}`
        : "",
  };
}
