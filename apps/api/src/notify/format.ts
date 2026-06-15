export type AlertType = "new_issue" | "regression" | "spike";

export const ALERT_LABELS: Record<AlertType, string> = {
  new_issue: "새 이슈",
  regression: "이슈 재발",
  spike: "급증 감지",
};

const ALERT_EMOJI: Record<AlertType, string> = {
  new_issue: "🆕",
  regression: "🔁",
  spike: "📈",
};

export interface AlertContext {
  projectName: string;
  issueTitle: string;
  level: string;
  timesSeen: number;
  environment: string | null;
  /** 대시보드 이슈 링크 (없으면 생략) */
  link: string | null;
}

export function alertSubject(type: AlertType, ctx: AlertContext): string {
  return `[${ctx.projectName}] ${ALERT_LABELS[type]}: ${ctx.issueTitle}`;
}

/** 이메일/일반 텍스트 본문 라인 */
export function alertTextLines(type: AlertType, ctx: AlertContext): string[] {
  const lines = [
    `${ALERT_LABELS[type]} — ${ctx.projectName}`,
    "",
    ctx.issueTitle,
    `level: ${ctx.level} · 발생 ${ctx.timesSeen}회${ctx.environment ? ` · ${ctx.environment}` : ""}`,
  ];
  if (ctx.link) lines.push("", ctx.link);
  return lines;
}

export interface SlackPayload {
  text: string;
  blocks: unknown[];
}

export function slackPayload(type: AlertType, ctx: AlertContext): SlackPayload {
  const heading = `${ALERT_EMOJI[type]} *${ALERT_LABELS[type]}* — ${ctx.projectName}`;
  const meta = `level: ${ctx.level} · 발생 ${ctx.timesSeen}회${ctx.environment ? ` · ${ctx.environment}` : ""}`;
  const titleLine = ctx.link
    ? `<${ctx.link}|${ctx.issueTitle}>`
    : ctx.issueTitle;
  return {
    // 알림 미리보기/폴백용 text
    text: alertSubject(type, ctx),
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: heading } },
      { type: "section", text: { type: "mrkdwn", text: `${titleLine}\n${meta}` } },
    ],
  };
}
