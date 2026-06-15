import type { AlertType } from "./format";

export interface TriggerInput {
  /** 이 이벤트로 이슈가 새로 생성됨 */
  isNew: boolean;
  /** 직전 상태가 resolved였음 (재발) */
  wasResolved: boolean;
  /** 최근 윈도우 발생 수가 임계 초과 */
  spike: boolean;
}

/** 트리거 우선순위: 새 이슈 > 재발 > 급증 (하나만 발화) */
export function decideTrigger(input: TriggerInput): AlertType | null {
  if (input.isNew) return "new_issue";
  if (input.wasResolved) return "regression";
  if (input.spike) return "spike";
  return null;
}

export interface AlertRuleFlags {
  enabled: boolean;
  onNewIssue: boolean;
  onRegression: boolean;
  onSpike: boolean;
}

/** 규칙에서 해당 트리거가 켜져 있는지 */
export function isTriggerEnabled(
  rule: AlertRuleFlags,
  type: AlertType,
): boolean {
  if (!rule.enabled) return false;
  if (type === "new_issue") return rule.onNewIssue;
  if (type === "regression") return rule.onRegression;
  return rule.onSpike;
}

/** 디바운스 — 마지막 발송이 윈도우(기본 1시간) 이내면 억제 */
export function withinDebounce(
  lastSentMs: number | null,
  nowMs: number,
  windowMs = 3_600_000,
): boolean {
  if (lastSentMs === null) return false;
  return nowMs - lastSentMs < windowMs;
}
