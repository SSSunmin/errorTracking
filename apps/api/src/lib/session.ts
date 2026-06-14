import { randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/client";
import { sessions } from "../db/schema";

export const SESSION_COOKIE = "et_session";

/** 쿠키 서명 비밀키 — 운영에서는 반드시 env로 설정 */
export const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "dev-session-secret-change-in-production";

/** 유휴 타임아웃 — 마지막 활동 후 이 기간 무활동 시 만료 (활동 시 슬라이딩 연장) */
const IDLE_TIMEOUT_MS = 1000 * 60 * 60 * 24 * 7; // 7일

/** 슬라이딩 갱신 최소 간격 — 매 요청마다 쓰지 않고 이 간격 지났을 때만 갱신 */
const SLIDE_THRESHOLD_MS = 1000 * 60 * 5; // 5분

/** HTTPS 환경(운영)에서는 secure 쿠키 강제 */
const COOKIE_SECURE =
  process.env.COOKIE_SECURE === "true" ||
  process.env.NODE_ENV === "production";

/** requireAuth가 검증한 userId를 요청에 실어 라우트가 재조회 없이 읽도록 */
type AuthedRequest = FastifyRequest & { userId?: number };

/** 추측 불가능한 세션 id (랜덤 32바이트) */
export function newSessionId(): string {
  return randomBytes(32).toString("hex");
}

export function isExpired(expiresAt: Date, now = Date.now()): boolean {
  return expiresAt.getTime() <= now;
}

/** 로그인 성공 시 호출 — 새 세션 행 생성 후 id 반환 */
export async function createSession(
  userId: number,
  now = Date.now(),
): Promise<string> {
  const id = newSessionId();
  await db.insert(sessions).values({
    id,
    userId,
    createdAt: new Date(now),
    lastSeenAt: new Date(now),
    expiresAt: new Date(now + IDLE_TIMEOUT_MS),
  });
  return id;
}

/**
 * 세션 검증 + 슬라이딩 갱신.
 * 유효하면 userId, 만료/부재면 null(만료 행은 삭제).
 */
export async function touchSession(
  sessionId: string,
  now = Date.now(),
): Promise<number | null> {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });
  if (!session) return null;
  if (isExpired(session.expiresAt, now)) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }
  // 활동 시 만료 연장 — 잦은 쓰기 방지를 위해 SLIDE_THRESHOLD 지났을 때만
  if (now - session.lastSeenAt.getTime() > SLIDE_THRESHOLD_MS) {
    await db
      .update(sessions)
      .set({
        lastSeenAt: new Date(now),
        expiresAt: new Date(now + IDLE_TIMEOUT_MS),
      })
      .where(eq(sessions.id, sessionId));
  }
  return session.userId;
}

export async function destroySession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/** 한 유저의 모든 세션 무효화 (비밀번호 변경/전체 로그아웃용) */
export async function destroyUserSessions(userId: number): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** 만료 세션 정리 — 정리 잡에서 주기 호출. 삭제 건수 반환 */
export async function deleteExpiredSessions(now = Date.now()): Promise<number> {
  const deleted = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date(now)))
    .returning({ id: sessions.id });
  return deleted.length;
}

export function setSessionCookie(reply: FastifyReply, sessionId: string): void {
  reply.setCookie(SESSION_COOKIE, sessionId, {
    signed: true,
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(IDLE_TIMEOUT_MS / 1000),
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

/** 쿠키에서 서명 검증된 세션 id 추출 — 없거나 위조면 null */
export function readSessionId(req: FastifyRequest): string | null {
  const raw = req.cookies[SESSION_COOKIE];
  if (!raw) return null;
  const unsigned = req.unsignCookie(raw);
  return unsigned.valid && unsigned.value !== null ? unsigned.value : null;
}

/** 대시보드 API 공용 가드 — 검증된 userId를 req에 실어둔다 */
export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const sessionId = readSessionId(req);
  const userId = sessionId ? await touchSession(sessionId) : null;
  if (userId === null) {
    await reply.code(401).send({ error: "authentication required" });
    return;
  }
  (req as AuthedRequest).userId = userId;
}

/** requireAuth 통과 후 라우트에서 현재 userId 읽기 (재조회 없음) */
export function currentUserId(req: FastifyRequest): number {
  const id = (req as AuthedRequest).userId;
  if (id === undefined) {
    throw new Error("currentUserId: requireAuth가 먼저 실행되어야 함");
  }
  return id;
}
