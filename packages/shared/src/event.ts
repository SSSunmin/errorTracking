/**
 * 이벤트 페이로드 스키마 — Sentry Event Payload 포맷 차용.
 * SDK가 만들고, 수집 API가 검증하고, 대시보드가 표시하는 단일 계약(contract).
 */

export const SEVERITY_LEVELS = [
  "fatal",
  "error",
  "warning",
  "info",
  "debug",
] as const;

export type Severity = (typeof SEVERITY_LEVELS)[number];

export type Platform = "javascript" | "python" | (string & {});

/** 캡처 경로 — 어떤 훅을 통해 잡혔는지 */
export type MechanismType =
  | "onerror"
  | "onunhandledrejection"
  | "console.error"
  | "manual";

export interface StackFrame {
  /** 파일 경로 또는 URL */
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  /** 내 코드(true) vs 라이브러리/node_modules(false) */
  in_app?: boolean;
  /** 심볼리케이션/서버 SDK가 채우는 주변 소스 — 이전 5줄 */
  pre_context?: string[];
  context_line?: string;
  post_context?: string[];
}

export interface ExceptionValue {
  /** 예외 타입 (예: "TypeError") */
  type: string;
  /** 예외 메시지 */
  value: string;
  stacktrace?: { frames: StackFrame[] };
  mechanism?: {
    type: MechanismType;
    handled?: boolean;
  };
}

export interface Breadcrumb {
  /** epoch seconds */
  timestamp: number;
  type?: string;
  category?: string;
  message?: string;
  level?: Severity;
  data?: Record<string, unknown>;
}

export interface UserContext {
  id?: string;
  username?: string;
  email?: string;
  ip_address?: string;
}

export type BrowserContext = {
  name?: string;
  version?: string;
};

export type OsContext = {
  name?: string;
  version?: string;
};

export type DeviceContext = {
  model?: string;
  screen_width_pixels?: number;
  screen_height_pixels?: number;
  memory_size?: number;
};

/** 서버 SDK용 — node / python 등 */
export type RuntimeContext = {
  name?: string;
  version?: string;
};

export interface Contexts {
  browser?: BrowserContext;
  os?: OsContext;
  device?: DeviceContext;
  runtime?: RuntimeContext;
  /** 커스텀 컨텍스트 허용 */
  [key: string]: Record<string, unknown> | undefined;
}

export interface RequestContext {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  query_string?: string;
  /** 서버 SDK만 body 일부 포함 */
  data?: unknown;
}

export interface SdkInfo {
  name: string;
  version: string;
}

export interface EventPayload {
  /** 클라이언트에서 생성하는 UUID(하이픈 제거 32자 hex) — 중복 제거 기준 */
  event_id: string;
  /** epoch seconds 또는 ISO 8601 문자열 */
  timestamp: number | string;
  platform: Platform;
  level?: Severity;
  release?: string;
  environment?: string;
  /** 체이닝 예외(cause)는 values 배열에 순서대로 누적 */
  exception?: { values: ExceptionValue[] };
  /** captureMessage용 — exception 없이 메시지만 */
  message?: string;
  breadcrumbs?: { values: Breadcrumb[] };
  user?: UserContext;
  /** 검색/필터용 키-값 */
  tags?: Record<string, string>;
  /** 임의 추가 데이터 */
  extra?: Record<string, unknown>;
  contexts?: Contexts;
  request?: RequestContext;
  sdk?: SdkInfo;
  /** SDK가 보내면 서버 그룹핑보다 우선 적용 */
  fingerprint?: string[];
}
