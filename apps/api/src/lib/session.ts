import type { FastifyReply, FastifyRequest } from "fastify";

export const SESSION_COOKIE = "et_session";

/** 쿠키 서명 비밀키 — 운영에서는 반드시 env로 설정 */
export const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "dev-session-secret-change-in-production";

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7일

export function setSessionCookie(reply: FastifyReply, userId: number): void {
  reply.setCookie(SESSION_COOKIE, String(userId), {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

/** 서명 검증된 세션에서 user id 추출 — 없거나 위조면 null */
export function getSessionUserId(req: FastifyRequest): number | null {
  const raw = req.cookies[SESSION_COOKIE];
  if (!raw) return null;
  const unsigned = req.unsignCookie(raw);
  if (!unsigned.valid || unsigned.value === null) return null;
  const id = Number(unsigned.value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** 대시보드 API 공용 가드 — preHandler로 사용 */
export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (getSessionUserId(req) === null) {
    await reply.code(401).send({ error: "authentication required" });
  }
}
