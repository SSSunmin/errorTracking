import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { alertRules, notifications, projects } from "../db/schema";
import {
  alertSubject,
  alertTextLines,
  slackPayload,
  type AlertContext,
  type AlertType,
} from "./format";
import { sendEmail as defaultSendEmail, sendSlack as defaultSendSlack } from "./channels";
import { isTriggerEnabled, withinDebounce } from "./triggers";

export interface DispatchInput {
  issueId: number;
  projectId: number;
  type: AlertType;
  issueTitle: string;
  level: string;
  timesSeen: number;
  environment: string | null;
}

export interface NotifyDeps {
  sendSlack?: (url: string, payload: ReturnType<typeof slackPayload>) => Promise<boolean>;
  sendEmail?: (to: string, subject: string, text: string) => Promise<boolean>;
  now?: () => number;
}

/** 대시보드 이슈 링크 — 미설정이면 null */
function issueLink(issueId: number): string | null {
  const base = process.env.DASHBOARD_URL;
  return base ? `${base.replace(/\/$/, "")}/issues/${issueId}` : null;
}

/**
 * 알림 발송 — 규칙 조회 → 트리거 on 확인 → 디바운스 → 채널 발송 → 로그.
 * 파이프라인을 막지 않도록 호출부에서 await하되 실패는 삼킨다.
 */
export async function dispatchNotifications(
  input: DispatchInput,
  deps: NotifyDeps = {},
): Promise<void> {
  const sendSlack = deps.sendSlack ?? defaultSendSlack;
  const sendEmail = deps.sendEmail ?? defaultSendEmail;
  const now = deps.now ?? (() => Date.now());

  const rule = await db.query.alertRules.findFirst({
    where: eq(alertRules.projectId, input.projectId),
  });
  if (!rule || !isTriggerEnabled(rule, input.type)) return;
  if (!rule.email && !rule.slackWebhookUrl) return;

  // 디바운스 — 같은 이슈의 최근 발송 시각 확인
  const [last] = await db
    .select({ sentAt: notifications.sentAt })
    .from(notifications)
    .where(eq(notifications.issueId, input.issueId))
    .orderBy(desc(notifications.sentAt))
    .limit(1);
  if (withinDebounce(last?.sentAt.getTime() ?? null, now())) return;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
  });

  const ctx: AlertContext = {
    projectName: project?.name ?? `project ${input.projectId}`,
    issueTitle: input.issueTitle,
    level: input.level,
    timesSeen: input.timesSeen,
    environment: input.environment,
    link: issueLink(input.issueId),
  };

  const sent: string[] = [];
  if (rule.slackWebhookUrl) {
    const ok = await sendSlack(rule.slackWebhookUrl, slackPayload(input.type, ctx));
    if (ok) sent.push("slack");
  }
  if (rule.email) {
    const ok = await sendEmail(
      rule.email,
      alertSubject(input.type, ctx),
      alertTextLines(input.type, ctx).join("\n"),
    );
    if (ok) sent.push("email");
  }

  if (sent.length > 0) {
    await db.insert(notifications).values(
      sent.map((channel) => ({
        issueId: input.issueId,
        projectId: input.projectId,
        type: input.type,
        channel,
      })),
    );
  }
}

export { decideTrigger } from "./triggers";
