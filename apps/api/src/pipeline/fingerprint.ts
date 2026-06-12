import { createHash } from "node:crypto";
import type {
  EventPayload,
  ExceptionValue,
  StackFrame,
} from "@errortracking/shared";

/** 그룹핑에 사용할 안쪽(최신) 프레임 수 */
const FRAME_COUNT = 8;

const MAX_TITLE_LENGTH = 200;

export interface FingerprintResult {
  /** sha256 hex — issues(project_id, fingerprint) upsert 기준 */
  fingerprint: string;
  /** 이슈 제목: "예외타입: 메시지" 또는 message */
  title: string;
  /** 최상위 in_app 프레임 위치 */
  culprit: string | null;
}

export function computeFingerprint(payload: EventPayload): FingerprintResult {
  const exception = primaryException(payload);
  return {
    fingerprint: createHash("sha256")
      .update(buildMaterial(payload, exception))
      .digest("hex"),
    title: buildTitle(payload, exception),
    culprit: exception ? buildCulprit(exception) : null,
  };
}

/** values는 oldest(원인)→newest 순 — 마지막이 대표 예외 */
function primaryException(payload: EventPayload): ExceptionValue | undefined {
  const values = payload.exception?.values;
  return values && values.length > 0 ? values[values.length - 1] : undefined;
}

function buildMaterial(
  payload: EventPayload,
  exception: ExceptionValue | undefined,
): string {
  // SDK가 보낸 커스텀 fingerprint 우선
  if (payload.fingerprint && payload.fingerprint.length > 0) {
    return `custom|${payload.fingerprint.join("|")}`;
  }
  if (exception) {
    const frames = groupingFrames(exception);
    if (frames.length > 0) {
      const parts = frames.map(
        (f) =>
          `${normalizeFilename(f.filename ?? "")}:${normalizeFunction(f.function)}`,
      );
      return `exc|${exception.type}|${parts.join("|")}`;
    }
    // 스택 없는 예외 폴백 — 타입 + 메시지 템플릿
    return `exc-msg|${exception.type}|${templateMessage(exception.value ?? "")}`;
  }
  // captureMessage 등 메시지 전용 이벤트
  return `msg|${payload.level ?? "error"}|${templateMessage(payload.message ?? "")}`;
}

/**
 * in_app 프레임만 추출(미지정은 in_app 취급), 없으면 전체 사용.
 * lineno/colno는 의도적으로 제외 — minify된 빌드마다 변해서 그룹핑을 깨뜨린다.
 */
function groupingFrames(exception: ExceptionValue): StackFrame[] {
  const all = exception.stacktrace?.frames ?? [];
  const inApp = all.filter((f) => f.in_app !== false);
  const chosen = inApp.length > 0 ? inApp : all;
  return chosen.slice(-FRAME_COUNT);
}

/** 파일 경로 정규화 — 쿼리스트링/origin 제거, 해시·빌드ID 치환 */
function normalizeFilename(filename: string): string {
  let f = filename.split(/[?#]/)[0]!;
  if (/^https?:\/\//i.test(f)) {
    try {
      f = new URL(f).pathname;
    } catch {
      // URL 파싱 실패 시 원본 유지
    }
  }
  f = f.replace(/\\/g, "/");
  // 경로 구분자 사이의 8자 이상 hex 청크 = 빌드 해시로 간주
  f = f.replace(/(?<=[./-])[0-9a-f]{8,}(?=[./-]|$)/gi, "<hash>");
  return f.toLowerCase();
}

function normalizeFunction(fn: string | undefined): string {
  const t = fn?.trim();
  if (!t || t === "?" || /^<?anonymous>?$/i.test(t)) return "<anonymous>";
  return t;
}

/** 메시지 템플릿화 — 가변 부분(uuid/hex/숫자)을 치환해 같은 원인끼리 묶는다 */
function templateMessage(msg: string): string {
  return msg
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "<uuid>",
    )
    .replace(/\b[0-9a-f]{16,}\b/gi, "<hex>")
    .replace(/\d+/g, "<num>");
}

function buildTitle(
  payload: EventPayload,
  exception: ExceptionValue | undefined,
): string {
  if (exception) {
    const value = exception.value?.trim();
    const title = value ? `${exception.type}: ${value}` : exception.type;
    return truncate(title);
  }
  if (payload.message?.trim()) return truncate(payload.message.trim());
  return "Unknown error";
}

/** culprit = 가장 안쪽 in_app 프레임 (없으면 가장 안쪽 프레임) */
function buildCulprit(exception: ExceptionValue): string | null {
  const frames = exception.stacktrace?.frames ?? [];
  const frame =
    [...frames].reverse().find((f) => f.in_app !== false && f.filename) ??
    frames[frames.length - 1];
  if (!frame?.filename) return null;
  const fn = normalizeFunction(frame.function);
  const line = frame.lineno != null ? `:${frame.lineno}` : "";
  return truncate(`${fn} (${frame.filename}${line})`);
}

function truncate(s: string, max = MAX_TITLE_LENGTH): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
