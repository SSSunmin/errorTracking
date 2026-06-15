/** 알림 채널 값 검증 — 이메일 형식, Slack webhook URL(SSRF 방지) */

export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * Slack incoming webhook URL 검증 — 문자열 접두 비교가 아니라 URL 파싱 후
 * 호스트 정확 일치로 SSRF/우회(`hooks.slack.com@evil.com` 등)를 차단.
 */
export function isValidSlackWebhook(s: string): boolean {
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return false;
  }
  return url.protocol === "https:" && url.hostname === "hooks.slack.com";
}
