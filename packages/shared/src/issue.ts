/** 이슈 상태 — DB enum과 대시보드 필터가 공유하는 값 */
export const ISSUE_STATUSES = ["unresolved", "resolved", "ignored"] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];
