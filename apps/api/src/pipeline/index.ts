import { and, eq, sql } from "drizzle-orm";
import type { EventPayload } from "@errortracking/shared";
import { db } from "../db/client";
import { events, issues, usersAffected } from "../db/schema";
import { computeFingerprint } from "./fingerprint";
import { normalizeEvent } from "./normalize";

export interface IngestJob {
  projectId: number;
  payload: EventPayload;
}

/**
 * 처리 파이프라인: 정규화/스크러빙 → 핑거프린팅 → 트랜잭션(이슈 upsert + 이벤트 INSERT + 유저 집계).
 * 심볼리케이션(소스맵)은 STEP 8에서 핑거프린팅 앞 단계로 추가 예정.
 */
export async function processEvent(job: IngestJob): Promise<void> {
  const normalized = normalizeEvent(job.payload);
  const fp = computeFingerprint(normalized.payload);

  await db.transaction(async (tx) => {
    // 중복 수신 최종 확인 — UNIQUE(project_id, event_id) 제약이 백스톱
    const dup = await tx
      .select({ id: events.id })
      .from(events)
      .where(
        and(
          eq(events.projectId, job.projectId),
          eq(events.eventId, normalized.payload.event_id),
        ),
      )
      .limit(1);
    if (dup.length > 0) return;

    // 이슈 upsert — 동일 지문이면 카운트/last_seen 갱신,
    // resolved 상태였으면 재발(regression): unresolved로 전환 + 플래그
    const [issue] = await tx
      .insert(issues)
      .values({
        projectId: job.projectId,
        fingerprint: fp.fingerprint,
        title: fp.title,
        culprit: fp.culprit,
        level: normalized.level,
        firstSeen: normalized.timestamp,
        lastSeen: normalized.timestamp,
      })
      .onConflictDoUpdate({
        target: [issues.projectId, issues.fingerprint],
        set: {
          timesSeen: sql`${issues.timesSeen} + 1`,
          lastSeen: sql`GREATEST(${issues.lastSeen}, ${normalized.timestamp})`,
          level: sql`excluded.level`,
          regression: sql`CASE WHEN ${issues.status} = 'resolved' THEN true ELSE ${issues.regression} END`,
          status: sql`CASE WHEN ${issues.status} = 'resolved' THEN 'unresolved'::issue_status ELSE ${issues.status} END`,
        },
      })
      .returning({ id: issues.id });

    await tx.insert(events).values({
      eventId: normalized.payload.event_id,
      projectId: job.projectId,
      issueId: issue!.id,
      payload: normalized.payload,
      timestamp: normalized.timestamp,
      release: normalized.release,
      environment: normalized.environment,
    });

    // 영향 유저 집계 — 신규 유저일 때만 user_count 증가
    const userId = normalized.payload.user?.id;
    if (userId) {
      const inserted = await tx
        .insert(usersAffected)
        .values({
          issueId: issue!.id,
          userId,
          firstSeen: normalized.timestamp,
          lastSeen: normalized.timestamp,
        })
        .onConflictDoNothing()
        .returning({ userId: usersAffected.userId });

      if (inserted.length > 0) {
        await tx
          .update(issues)
          .set({ userCount: sql`${issues.userCount} + 1` })
          .where(eq(issues.id, issue!.id));
      } else {
        await tx
          .update(usersAffected)
          .set({
            lastSeen: sql`GREATEST(${usersAffected.lastSeen}, ${normalized.timestamp})`,
          })
          .where(
            and(
              eq(usersAffected.issueId, issue!.id),
              eq(usersAffected.userId, userId),
            ),
          );
      }
    }
  });
}
