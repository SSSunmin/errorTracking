import type { StackFrame } from "@errortracking/shared";

// Chrome/Edge/Node: "    at fn (url:line:col)" | "    at url:line:col" | "    at fn (<anonymous>)"
const CHROME_RE = /^\s*at (?:(.*?) )?\(?(.+?)(?::(\d+):(\d+))?\)?\s*$/;
// Firefox/Safari: "fn@url:line:col" | "@url:line:col"
const GECKO_RE = /^\s*(?:([^@]*)@)?(.+?):(\d+):(\d+)\s*$/;

/**
 * Error.stack 문자열 → 프레임 배열.
 * JS 스택 문자열은 안쪽(innermost) 프레임이 먼저 — Sentry 규약(안쪽이 마지막)으로 뒤집는다.
 */
export function parseStack(stack: string | undefined): StackFrame[] {
  if (!stack) return [];
  const frames: StackFrame[] = [];
  for (const line of stack.split("\n")) {
    const frame = parseLine(line);
    if (frame) frames.push(frame);
  }
  return frames.reverse();
}

function parseLine(line: string): StackFrame | null {
  if (/^\s*at /.test(line)) {
    const m = CHROME_RE.exec(line);
    if (!m || !m[2]) return null;
    return makeFrame(m[1], m[2], m[3], m[4]);
  }
  if (line.includes("@")) {
    const m = GECKO_RE.exec(line);
    if (!m || !m[2]) return null;
    return makeFrame(m[1] || undefined, m[2], m[3], m[4]);
  }
  return null;
}

function makeFrame(
  fn: string | undefined,
  filename: string,
  lineno: string | undefined,
  colno: string | undefined,
): StackFrame {
  const frame: StackFrame = { filename };
  if (fn && fn !== "?") frame.function = fn;
  if (lineno !== undefined) frame.lineno = Number(lineno);
  if (colno !== undefined) frame.colno = Number(colno);
  return frame;
}

/** in_app 판별 — 같은 origin의 스크립트만 내 코드로 취급 (CDN/외부/native 제외) */
export function markInApp(
  frames: StackFrame[],
  origin: string | null,
): StackFrame[] {
  return frames.map((f) => ({ ...f, in_app: isInApp(f.filename, origin) }));
}

function isInApp(filename: string | undefined, origin: string | null): boolean {
  if (!filename || !/^https?:/i.test(filename)) return false;
  if (filename.includes("/node_modules/")) return false;
  if (!origin) return true;
  return filename.startsWith(origin);
}
