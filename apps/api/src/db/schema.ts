import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  ISSUE_STATUSES,
  SEVERITY_LEVELS,
  type EventPayload,
  type IssueStatus,
  type Severity,
} from "@errortracking/shared";

// enum 값은 packages/shared가 단일 소스 — SDK·대시보드와 동일한 값 사용
export const severityEnum = pgEnum(
  "severity",
  SEVERITY_LEVELS as unknown as [Severity, ...Severity[]],
);

export const issueStatusEnum = pgEnum(
  "issue_status",
  ISSUE_STATUSES as unknown as [IssueStatus, ...IssueStatus[]],
);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    /** scrypt — `{salt}:{hash}` hex */
    passwordHash: text("password_hash").notNull(),
    name: text("name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

// 서버측 세션 저장소 — 쿠키엔 추측 불가능한 랜덤 id만 담고 userId는 여기서 매핑.
// 서버 주도 로그아웃·강제 만료·유휴 타임아웃을 가능하게 한다.
export const sessions = pgTable(
  "sessions",
  {
    /** 랜덤 32바이트 hex */
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** 유휴 타임아웃 — 활동 시 슬라이딩 연장 */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("sessions_user_idx").on(t.userId),
    index("sessions_expires_idx").on(t.expiresAt),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    platform: text("platform").notNull().default("javascript"),
    /** DSN의 public_key — 수집 API 인증에 사용 */
    publicKey: text("public_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("projects_public_key_uq").on(t.publicKey)],
);

export const issues = pgTable(
  "issues",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    /** 예: "TypeError: Cannot read properties of undefined" */
    title: text("title").notNull(),
    /** 최상위 in_app 프레임 위치 */
    culprit: text("culprit"),
    status: issueStatusEnum("status").notNull().default("unresolved"),
    level: severityEnum("level").notNull().default("error"),
    firstSeen: timestamp("first_seen", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeen: timestamp("last_seen", { withTimezone: true })
      .notNull()
      .defaultNow(),
    timesSeen: bigint("times_seen", { mode: "number" }).notNull().default(1),
    /** users_affected에서 distinct 집계한 비정규화 값 (목록 표시용) */
    userCount: integer("user_count").notNull().default(0),
    /** resolved 상태에서 재발하면 true (STEP 5 재발 감지) */
    regression: boolean("regression").notNull().default(false),
  },
  (t) => [
    uniqueIndex("issues_project_fingerprint_uq").on(t.projectId, t.fingerprint),
    index("issues_project_last_seen_idx").on(t.projectId, t.lastSeen),
  ],
);

export const events = pgTable(
  "events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** SDK가 생성한 UUID — 중복 수신 제거 기준 */
    eventId: uuid("event_id").notNull(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    issueId: bigint("issue_id", { mode: "number" })
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    payload: jsonb("payload").$type<EventPayload>().notNull(),
    /** 클라이언트에서 에러가 발생한 시각 */
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    release: text("release"),
    environment: text("environment"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("events_project_event_id_uq").on(t.projectId, t.eventId),
    index("events_issue_timestamp_idx").on(t.issueId, t.timestamp),
    // 보관 기간 경과 삭제(retention cron)용
    index("events_project_timestamp_idx").on(t.projectId, t.timestamp),
  ],
);

export const releases = pgTable(
  "releases",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("releases_project_version_uq").on(t.projectId, t.version)],
);

export const artifacts = pgTable(
  "artifacts",
  {
    id: serial("id").primaryKey(),
    releaseId: integer("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    /** 업로드된 파일 식별자 — 스택 프레임의 filename과 매칭 */
    name: text("name").notNull(),
    /** 소스맵(.map)은 JSON 텍스트이므로 text로 저장 */
    content: text("content").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("artifacts_release_name_uq").on(t.releaseId, t.name)],
);

export const usersAffected = pgTable(
  "users_affected",
  {
    issueId: bigint("issue_id", { mode: "number" })
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    /** 이벤트 payload의 user.id */
    userId: text("user_id").notNull(),
    firstSeen: timestamp("first_seen", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeen: timestamp("last_seen", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.issueId, t.userId] })],
);

// 프로젝트별 알림 규칙 (프로젝트당 1개)
export const alertRules = pgTable(
  "alert_rules",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    /** 트리거 ① 새 이슈 ② 재발 ③ 급증 */
    onNewIssue: boolean("on_new_issue").notNull().default(true),
    onRegression: boolean("on_regression").notNull().default(true),
    onSpike: boolean("on_spike").notNull().default(false),
    /** 채널 — 미설정 시 해당 채널 미발송 */
    email: text("email"),
    slackWebhookUrl: text("slack_webhook_url"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("alert_rules_project_uq").on(t.projectId)],
);

// 발송 로그 — 디바운싱 판단 + 감사 추적
export const notifications = pgTable(
  "notifications",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    issueId: bigint("issue_id", { mode: "number" })
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** new_issue | regression | spike */
    type: text("type").notNull(),
    /** email | slack */
    channel: text("channel").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_issue_sent_idx").on(t.issueId, t.sentAt)],
);
