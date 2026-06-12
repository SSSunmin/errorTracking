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
