import type { EventPayload, IssueStatus, Severity } from "@errortracking/shared";

export interface User {
  id: number;
  email: string;
  name: string | null;
}

export interface Project {
  id: number;
  name: string;
  platform: string;
  publicKey: string;
  dsn: string;
  createdAt: string;
}

export interface IssueSummary {
  id: number;
  title: string;
  culprit: string | null;
  level: Severity;
  status: IssueStatus;
  regression: boolean;
  firstSeen: string;
  lastSeen: string;
  timesSeen: number;
  userCount: number;
  /** 최근 24시간 시간대별 발생 수 (24개) */
  sparkline: number[];
}

export interface IssueStats {
  window: "24h" | "14d";
  bucketSec: number;
  startEpoch: number;
  buckets: number[];
}

export interface TagValue {
  value: string;
  count: number;
  percent: number;
}

/** browser/os/release/environment → 분포 */
export type TagDistribution = Record<string, TagValue[]>;

export interface AlertRule {
  projectId: number;
  enabled: boolean;
  onNewIssue: boolean;
  onRegression: boolean;
  onSpike: boolean;
  email: string | null;
  slackWebhookUrl: string | null;
  updatedAt: string | null;
}

export type IssueSort = "last_seen" | "first_seen" | "times_seen";

export interface IssueListResponse {
  items: IssueSummary[];
  total: number;
  page: number;
  limit: number;
  sort: IssueSort;
  status: IssueStatus | null;
}

export interface IssueDetail extends IssueSummary {
  projectId: number;
  fingerprint: string;
}

export interface StoredEvent {
  id: number;
  eventId: string;
  payload: EventPayload;
  timestamp: string;
  release: string | null;
  environment: string | null;
  receivedAt: string;
}

export interface EventListResponse {
  items: StoredEvent[];
  total: number;
  page: number;
  limit: number;
}
