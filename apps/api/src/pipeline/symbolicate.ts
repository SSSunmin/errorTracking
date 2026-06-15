import {
  originalPositionFor,
  sourceContentFor,
  TraceMap,
  type EncodedSourceMap,
} from "@jridgewell/trace-mapping";
import { and, eq } from "drizzle-orm";
import type { EventPayload, StackFrame } from "@errortracking/shared";
import { db } from "../db/client";
import { artifacts, releases } from "../db/schema";

/** 복원된 위치 주변 소스 줄 수 (앞뒤 각각) */
const CONTEXT_LINES = 5;

/** 파일 경로/URL → basename (쿼리·해시 제거) */
export function basename(filename: string | undefined): string | null {
  if (!filename) return null;
  const path = filename.split(/[?#]/)[0]!;
  const parts = path.split(/[\\/]/);
  const last = parts[parts.length - 1];
  return last || null;
}

/** 원본 소스에서 line(1-based) 주변 컨텍스트 추출 */
export function extractContext(
  sourceText: string,
  line: number,
): Pick<StackFrame, "pre_context" | "context_line" | "post_context"> {
  const lines = sourceText.split("\n");
  const idx = line - 1;
  if (idx < 0 || idx >= lines.length) return {};
  return {
    pre_context: lines.slice(Math.max(0, idx - CONTEXT_LINES), idx),
    context_line: lines[idx],
    post_context: lines.slice(idx + 1, idx + 1 + CONTEXT_LINES),
  };
}

/**
 * 한 프레임에 소스맵 적용 — 원본 위치/함수명/컨텍스트로 치환한 새 프레임 반환.
 * 매핑 불가(원본 위치 없음)면 null.
 */
export function applySourceMap(
  frame: StackFrame,
  tracer: TraceMap,
): StackFrame | null {
  // 브라우저 colno는 1-based, 소스맵은 column 0-based
  const column = Math.max(0, (frame.colno ?? 1) - 1);
  const orig = originalPositionFor(tracer, {
    line: frame.lineno ?? 1,
    column,
  });
  if (orig.source == null || orig.line == null) return null;

  const mapped: StackFrame = {
    ...frame,
    filename: orig.source,
    lineno: orig.line,
    colno: (orig.column ?? 0) + 1,
  };
  if (orig.name) mapped.function = orig.name;

  const content = sourceContentFor(tracer, orig.source);
  if (content) Object.assign(mapped, extractContext(content, orig.line));
  return mapped;
}

/**
 * 이벤트의 스택 프레임을 심볼리케이션 — release에 업로드된 소스맵으로 복원.
 * release/아티팩트 없으면 원본 그대로(폴백). 페이로드를 in-place로 수정.
 */
export async function symbolicate(
  payload: EventPayload,
  projectId: number,
): Promise<EventPayload> {
  if (!payload.release || !payload.exception) return payload;

  const release = await db.query.releases.findFirst({
    where: and(
      eq(releases.projectId, projectId),
      eq(releases.version, payload.release),
    ),
  });
  if (!release) return payload;

  const arts = await db
    .select({ name: artifacts.name, content: artifacts.content })
    .from(artifacts)
    .where(eq(artifacts.releaseId, release.id));
  if (arts.length === 0) return payload;

  const byName = new Map(arts.map((a) => [a.name, a.content]));
  const tracerCache = new Map<string, TraceMap | null>();

  function getTracer(name: string): TraceMap | null {
    if (tracerCache.has(name)) return tracerCache.get(name)!;
    let tracer: TraceMap | null = null;
    const content = byName.get(name);
    if (content) {
      try {
        tracer = new TraceMap(JSON.parse(content) as EncodedSourceMap);
      } catch {
        tracer = null;
      }
    }
    tracerCache.set(name, tracer);
    return tracer;
  }

  for (const exc of payload.exception.values) {
    const frames = exc.stacktrace?.frames;
    if (!frames) continue;
    for (let i = 0; i < frames.length; i++) {
      const base = basename(frames[i]!.filename);
      if (!base) continue;
      const tracer = getTracer(base);
      if (!tracer) continue;
      const mapped = applySourceMap(frames[i]!, tracer);
      if (mapped) frames[i] = mapped;
    }
  }
  return payload;
}
