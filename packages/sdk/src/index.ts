import {
  parseDsn,
  storeEndpoint,
  type DsnComponents,
  type Severity,
} from "@errortracking/shared";

export interface InitOptions {
  dsn: string;
  release?: string;
  environment?: string;
  /** 0~1 이벤트 샘플링 (선택) */
  sampleRate?: number;
}

interface SdkState {
  dsn: DsnComponents;
  endpoint: string;
  options: InitOptions;
}

let state: SdkState | null = null;

/** 프론트엔드 STEP 2: 여기서 window.onerror / onunhandledrejection 후킹 */
export function init(options: InitOptions): void {
  const dsn = parseDsn(options.dsn);
  state = { dsn, endpoint: storeEndpoint(dsn), options };
}

export function captureException(_err: unknown): string {
  if (!state) throw new Error("SDK not initialized — call init() first");
  throw new Error("Not implemented: frontend STEP 2");
}

export function captureMessage(_msg: string, _level: Severity = "info"): string {
  if (!state) throw new Error("SDK not initialized — call init() first");
  throw new Error("Not implemented: frontend STEP 2");
}
