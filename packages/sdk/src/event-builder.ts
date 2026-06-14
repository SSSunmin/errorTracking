import {
  generateEventId,
  type Breadcrumb,
  type DeviceContext,
  type EventPayload,
  type ExceptionValue,
  type MechanismType,
  type Severity,
  type UserContext,
} from "@errortracking/shared";
import { browserFromUa, osFromUa } from "./context";
import { markInApp, parseStack } from "./stacktrace";

export const SDK_INFO = { name: "@errortracking/sdk", version: "0.0.1" };

/** cause 체인 추적 최대 깊이 */
const MAX_CHAIN = 5;

/** 개별 문자열 값 상한 — 서버(8KB)와 동일, 전송량 절약 */
const MAX_VALUE_LENGTH = 8192;

/** 이벤트 조립에 필요한 환경 정보 — 순수 함수 유지를 위해 주입 */
export interface BuildContext {
  origin: string | null;
  url?: string;
  ua?: string;
  release?: string;
  environment?: string;
  device?: DeviceContext;
  /** scope에서 누적된 컨텍스트 */
  user?: UserContext;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  /** 링 버퍼에서 가져온 행적 */
  breadcrumbs?: Breadcrumb[];
}

export function buildExceptionEvent(
  err: unknown,
  mechanism: MechanismType,
  ctx: BuildContext,
  level: Severity = "error",
): EventPayload {
  return {
    ...baseEvent(ctx, level),
    exception: { values: exceptionValues(err, mechanism, ctx.origin) },
  };
}

export function buildMessageEvent(
  message: string,
  level: Severity,
  ctx: BuildContext,
): EventPayload {
  return {
    ...baseEvent(ctx, level),
    message: truncate(message),
  };
}

function baseEvent(ctx: BuildContext, level: Severity): EventPayload {
  const payload: EventPayload = {
    event_id: generateEventId(),
    timestamp: Math.floor(Date.now() / 1000),
    platform: "javascript",
    level,
    sdk: SDK_INFO,
  };
  if (ctx.release) payload.release = ctx.release;
  if (ctx.environment) payload.environment = ctx.environment;
  if (ctx.url) payload.request = { url: ctx.url };
  if (ctx.ua) {
    const browser = browserFromUa(ctx.ua);
    const os = osFromUa(ctx.ua);
    if (browser || os) payload.contexts = { browser, os };
  }
  if (ctx.device) {
    payload.contexts = { ...payload.contexts, device: ctx.device };
  }
  // scope에서 누적된 컨텍스트 병합
  if (ctx.user) payload.user = ctx.user;
  if (ctx.tags && Object.keys(ctx.tags).length) payload.tags = ctx.tags;
  if (ctx.extra && Object.keys(ctx.extra).length) payload.extra = ctx.extra;
  if (ctx.breadcrumbs && ctx.breadcrumbs.length) {
    payload.breadcrumbs = { values: ctx.breadcrumbs };
  }
  return payload;
}

/** cause 체인을 따라가며 oldest(근본 원인)→newest 순서로 기록. mechanism은 대표(마지막)에만 */
function exceptionValues(
  err: unknown,
  mechanism: MechanismType,
  origin: string | null,
): ExceptionValue[] {
  const chain: unknown[] = [];
  let current: unknown = err;
  while (current != null && chain.length < MAX_CHAIN) {
    chain.push(current);
    current = (current as { cause?: unknown }).cause;
  }
  chain.reverse();
  return chain.map((e, i) =>
    toExceptionValue(e, i === chain.length - 1 ? mechanism : undefined, origin),
  );
}

function toExceptionValue(
  err: unknown,
  mechanism: MechanismType | undefined,
  origin: string | null,
): ExceptionValue {
  const value: ExceptionValue = isErrorLike(err)
    ? {
        type: err.name || "Error",
        value: truncate(err.message ?? ""),
      }
    : {
        type: "Error",
        value: truncate(safeString(err)),
      };
  if (isErrorLike(err) && err.stack) {
    const frames = markInApp(parseStack(err.stack), origin);
    if (frames.length > 0) value.stacktrace = { frames };
  }
  if (mechanism) value.mechanism = { type: mechanism, handled: false };
  return value;
}

function isErrorLike(
  err: unknown,
): err is { name?: string; message?: string; stack?: string } {
  return (
    err instanceof Error ||
    (typeof err === "object" &&
      err !== null &&
      "message" in err &&
      "stack" in err)
  );
}

function safeString(value: unknown): string {
  try {
    if (typeof value === "string") return value;
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function truncate(s: string, max = MAX_VALUE_LENGTH): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
