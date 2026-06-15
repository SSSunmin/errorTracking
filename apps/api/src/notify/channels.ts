import nodemailer, { type Transporter } from "nodemailer";
import type { SlackPayload } from "./format";

/** Slack incoming webhook 발송 — 성공 여부 반환 (실패는 throw 안 함) */
export async function sendSlack(
  webhookUrl: string,
  payload: SlackPayload,
): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// SMTP 트랜스포터 — SMTP_HOST 미설정이면 null (이메일 발송 비활성)
let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) {
    transporter = null;
    return null;
  }
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

/** SMTP 발송 — 미설정이면 false (조용히 비활성) */
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM ?? "errtrack@localhost",
      to,
      subject,
      text,
    });
    return true;
  } catch {
    return false;
  }
}
