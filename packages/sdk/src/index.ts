import {
  parseDsn,
  scrubSensitive,
  storeEndpoint,
  type Breadcrumb,
  type EventPayload,
  type Severity,
  type UserContext,
} from "@errortracking/shared";
import { BreadcrumbBuffer } from "./breadcrumbs";
import { deviceContext } from "./context";
import {
  buildExceptionEvent,
  buildMessageEvent,
  type BuildContext,
} from "./event-builder";
import { installInstrumentation } from "./instrument";
import { shouldSample } from "./sampling";
import { Scope } from "./scope";
import { createFetchTransport, type Transport } from "./transport";

export interface InitOptions {
  dsn: string;
  release?: string;
  environment?: string;
  /** 0~1 이벤트 샘플링 (기본 1 = 전부 전송) */
  sampleRate?: number;
  /** 전송 직전 이벤트 수정/필터 — null 반환 시 전송 취소 */
  beforeSend?: (event: EventPayload) => EventPayload | null;
}

interface SdkState {
  options: InitOptions;
  transport: Transport;
  scope: Scope;
  breadcrumbs: BreadcrumbBuffer;
}

let state: SdkState | null = null;
let handlersInstalled = false;

export function init(options: InitOptions): void {
  const dsn = parseDsn(options.dsn);
  const scope = new Scope();
  const breadcrumbs = new BreadcrumbBuffer();
  state = {
    options,
    transport: createFetchTransport(storeEndpoint(dsn), dsn.publicKey),
    scope,
    breadcrumbs,
  };
  installInstrumentation((crumb) => breadcrumbs.add(crumb));
  installGlobalHandlers();
}

// ── scope/breadcrumb 공개 API ──────────────────────────
export function setUser(user: UserContext | null): void {
  state?.scope.setUser(user);
}
export function setTag(key: string, value: string): void {
  state?.scope.setTag(key, value);
}
export function setExtra(key: string, value: unknown): void {
  state?.scope.setExtra(key, value);
}
export function addBreadcrumb(crumb: Breadcrumb): void {
  state?.breadcrumbs.add(crumb);
}

// ── 캡처 API ───────────────────────────────────────────
export function captureException(
  err: unknown,
  level: Severity = "error",
): string | null {
  if (!state) return null;
  return dispatch(buildExceptionEvent(err, "manual", buildContext(), level));
}

export function captureMessage(
  message: string,
  level: Severity = "info",
): string | null {
  if (!state) return null;
  return dispatch(buildMessageEvent(message, level, buildContext()));
}

/** 공통 전송 파이프라인 — 샘플링 → beforeSend → 스크러빙 → 전송 */
function dispatch(event: EventPayload): string | null {
  if (!state) return null;
  const rate = state.options.sampleRate ?? 1;
  if (!shouldSample(rate, Math.random())) return null;

  let processed: EventPayload | null = event;
  if (state.options.beforeSend) {
    try {
      processed = state.options.beforeSend(event);
    } catch {
      processed = event; // beforeSend 오류가 캡처를 막지 않도록
    }
  }
  if (!processed) return null;

  // 클라이언트 1차 스크러빙 (서버 2차 방어와 동일 로직)
  const scrubbed = scrubSensitive(processed);
  state.transport.send(scrubbed);
  return event.event_id;
}

function buildContext(): BuildContext {
  const scope = state?.scope.snapshot() ?? {};
  return {
    origin: typeof location !== "undefined" ? location.origin : null,
    url: typeof location !== "undefined" ? location.href : undefined,
    ua: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    release: state?.options.release,
    environment: state?.options.environment,
    device: deviceContext(),
    user: scope.user,
    tags: scope.tags,
    extra: scope.extra,
    breadcrumbs: state?.breadcrumbs.getAll(),
  };
}

function installGlobalHandlers(): void {
  if (handlersInstalled || typeof window === "undefined") return;
  handlersInstalled = true;

  window.addEventListener("error", (event) => {
    try {
      if (!state) return;
      if (!(event instanceof ErrorEvent)) return;
      const err =
        event.error ??
        syntheticError(event.message, event.filename, event.lineno, event.colno);
      dispatch(buildExceptionEvent(err, "onerror", buildContext()));
    } catch {
      /* 무시 — 재귀 보고/앱 영향 금지 */
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    try {
      if (!state) return;
      dispatch(
        buildExceptionEvent(event.reason, "onunhandledrejection", buildContext()),
      );
    } catch {
      /* 무시 */
    }
  });

  // 페이지 이탈 직전 잔여 이벤트 전송 (sendBeacon)
  window.addEventListener("pagehide", () => state?.transport.flush());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") state?.transport.flush();
  });
}

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
