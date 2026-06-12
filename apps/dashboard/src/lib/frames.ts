import type { StackFrame } from "@errortracking/shared";

export interface FrameSegment {
  /** in_app 프레임(앱 코드) vs 시스템/라이브러리 프레임 */
  inApp: boolean;
  frames: StackFrame[];
}

/**
 * 저장 순서(안쪽이 마지막)를 표시 순서(안쪽이 먼저)로 뒤집고,
 * 연속된 in_app/시스템 프레임을 구간으로 묶는다 — 시스템 구간은 UI에서 접힌다.
 */
export function segmentFrames(frames: StackFrame[]): FrameSegment[] {
  const display = [...frames].reverse();
  const segments: FrameSegment[] = [];
  for (const frame of display) {
    const inApp = frame.in_app === true;
    const last = segments[segments.length - 1];
    if (last && last.inApp === inApp) {
      last.frames.push(frame);
    } else {
      segments.push({ inApp, frames: [frame] });
    }
  }
  return segments;
}

/** 프레임 위치 표기: "filename:line:col" (없는 값은 생략) */
export function frameLocation(frame: StackFrame): string {
  const file = frame.filename ?? "<unknown>";
  if (frame.lineno === undefined) return file;
  return frame.colno === undefined
    ? `${file}:${frame.lineno}`
    : `${file}:${frame.lineno}:${frame.colno}`;
}
