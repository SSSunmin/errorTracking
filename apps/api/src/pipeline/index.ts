import { and, count, eq, gte, sql } from "drizzle-orm";
import type { EventPayload } from "@errortracking/shared";
import { db } from "../db/client";
import { events, issues, usersAffected } from "../db/schema";
import { dispatchNotifications } from "../notify";
import { decideTrigger } from "../notify/triggers";
import { computeFingerprint } from "./fingerprint";
import { normalizeEvent } from "./normalize";

export interface IngestJob {
  projectId: number;
  payload: EventPayload;
}

/** 급증 감지 — 최근 윈도우 내 발생 수가 임계 이상이면 spike */
const SPIKE_WINDOW_MS = 5 * 60 * 1000;
const SPIKE_THRESHOLD = Number(process.env.SPIKE_THRESHOLD ?? 10);

/**
 * 처리 파이프라인: 정규화/스크러핑 → 핑거프린팅 → 트랜잭션(이슈 upsert + 이벤트 INSERT + 유저 집계)
 * → 알림 트리거(새 이슈/재발/급증) 발송.
 * 심볼리케이션(소스맵)은 STEP 8에서 핑거프린팅 앞 단계로 추가 예정.
 */
export async function processEvent(job: IngestJob): Promise<void> {
  const normalized = normalizeEvent(job.payload);
  const fp = computeFingerprint(normalized.payload);

  const result = await db.transaction(async (tx) => {
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
    if (dup.length > 0) return null;

    // 알림 트리거 판단용 — upsert 전 상태 캡처
    const [prev] = await tx
      .select({ id: issues.id, status: issues.status })
      .from(issues)
      .where(
        and(
          eq(issues.projectId, job.projectId),
          eq(issues.fingerprint, fp.fingerprint),
        ),
      )
      .limit(1);
    const isNew = !prev;
    const wasResolved = prev?.status === "resolved";

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
      .returning({ id: issues.id, timesSeen: issues.timesSeen });

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

    return {
      issueId: issue!.id,
      isNew,
      wasResolved,
      timesSeen: issue!.timesSeen,
    };
  });

  // 트랜잭션 커밋 후 알림 — 수집을 막지 않도록 실패는 삼킨다 (중복이면 result null)
  if (!result) return;
  try {
    const captured = result;
    let spike = false;
    if (!captured.isNew && !captured.wasResolved) {
      const [recent] = await db
        .select({ value: count() })
        .from(events)
        .where(
          and(
            eq(events.issueId, captured.issueId),
            gte(events.timestamp, new Date(Date.now() - SPIKE_WINDOW_MS)),
          ),
        );
      spike = (recent?.value ?? 0) >= SPIKE_THRESHOLD;
    }

    const trigger = decideTrigger({
      isNew: captured.isNew,
      wasResolved: captured.wasResolved,
      spike,
    });
    if (trigger) {
      await dispatchNotifications({
        issueId: captured.issueId,
        projectId: job.projectId,
        type: trigger,
        issueTitle: fp.title,
        level: normalized.level,
        timesSeen: captured.timesSeen,
        environment: normalized.environment,
      });
    }
  } catch (err) {
    console.error(`[notify] dispatch 실패 (issue ${result.issueId}):`, err);
  }
}
