# 백엔드 구현 TODO — 순서대로 작업

> 근거: [service-plan.md](service-plan.md), [error-tracking-checklist.md](error-tracking-checklist.md)
> 범위: DB 스키마, 수집 API, 처리 파이프라인, 조회 API, 알림
> 표기: 🔗 = 타 트랙 의존/연동 지점

---

## STEP 0. 사전 설계 결정 (코드 작성 전 확정) ✅

- [x] 이벤트 페이로드 스키마 확정 — `packages/shared/src/event.ts` (Sentry Event Payload 포맷 차용)
- [x] DSN 발급 규칙 확정 — `packages/shared/src/dsn.ts`
- [x] 이벤트 1건 최대 크기 확정 — 1MB (`shared/src/constants.ts` `MAX_EVENT_BYTES`)
- [x] 이벤트 보관 기간 확정 — 원본 90일 / 이슈 요약 영구 (`EVENT_RETENTION_DAYS`)
- [ ] IP 주소 기록 여부 결정 — **미결정**, STEP 3(정규화) 구현 전까지 확정 필요
- [x] 🔗 확정된 페이로드 스키마를 프론트엔드(SDK 개발)에 공유 — 모노레포 `@errortracking/shared` 공용 의존성으로 해결

## STEP 1. DB 스키마 (Phase 1) ✅

- [x] 마이그레이션 도구 셋업 — Drizzle ORM + drizzle-kit (`apps/api/drizzle/`에 SQL 커밋)
- [x] `projects` 테이블 — 이름, 플랫폼, public_key(DSN), 생성일
- [x] `issues` 테이블 — fingerprint, 제목(culprit), 상태(unresolved/resolved/ignored), level, first_seen, last_seen, times_seen, 영향 유저 수
- [x] `events` 테이블 — event_id(UUID), issue_id(FK), 원본 페이로드(JSONB), timestamp, release, environment
- [x] `releases`, `artifacts`(sourcemaps) 테이블 — 6단계에서 사용하지만 스키마는 지금 확정
- [x] `users_affected` 테이블 — 이슈별 영향 유저 distinct 집계용
- [x] UNIQUE 제약: `issues(project_id, fingerprint)`
- [x] 인덱스: `events(issue_id, timestamp)`, `events(project_id, timestamp)`
- [ ] (선택) JSONB GIN 인덱스 — 태그 검색용 → STEP 6(태그 검색 구현) 시점에 판단

## STEP 2. 수집 API — Ingestion (Phase 1)

- [ ] `POST /api/{project_id}/store/` 엔드포인트
- [ ] DSN public_key 인증 (`X-Sentry-Auth` 헤더 또는 쿼리 파라미터)
- [ ] CORS 설정 (브라우저 SDK cross-origin 전송 허용)
- [ ] 페이로드 검증 — 필수 필드, 크기 제한, JSON 파싱 실패 처리
- [ ] `event_id` 기준 중복 수신 제거
- [ ] 프로젝트별 rate limit (분당 300건) → 초과 시 `429 + Retry-After`
- [ ] 즉시 202 응답 후 비동기 처리(백그라운드 잡)로 위임
- [ ] 🔗 인프라: 워커(백그라운드 잡) 실행 방식 협의

## STEP 3. 처리 파이프라인 — 기본 (Phase 1)

- [ ] 페이로드 정규화 — 누락 필드 기본값, 타임스탬프 보정, 크기 초과 필드 트리밍
- [ ] 서버 측 민감정보 스크러빙 (비밀번호/토큰/카드번호 패턴 — 2차 방어)
- [ ] IP 기록 정책 적용
- [ ] 스택 트레이스 정규화 — in_app 프레임 추출, 경로의 해시/빌드ID 제거, 함수명 정규화(익명/minify 처리)
- [ ] 지문(fingerprint) 생성 — 정규화된 상위 N개 프레임 + 예외 타입 해싱
- [ ] 스택 없는 이벤트 폴백 — 예외 타입 + 메시지 템플릿화(숫자/ID 치환) 후 해싱
- [ ] SDK 커스텀 `fingerprint` 필드 우선 적용
- [ ] 이슈 upsert (트랜잭션) — 동일 지문이면 `times_seen`+1, `last_seen` 갱신 / 없으면 새 이슈 생성 (제목 = 예외타입: 메시지, culprit = 최상위 in_app 프레임)

## STEP 4. 대시보드용 조회 API — 기본 (Phase 1)

- [ ] 로그인/세션 인증 API
- [ ] 프로젝트 CRUD API + DSN 발급/표시
- [ ] 이슈 목록 API — 정렬(최근 발생/빈도/첫 발생), 상태 필터, 페이지네이션
- [ ] 🔗 프론트엔드: 이슈 목록 화면 연동
- [ ] ✅ **마일스톤 M1**: curl로 보낸 에러가 이슈로 묶여 목록 API에 나온다

## STEP 5. 이슈 상세 API (Phase 3)

- [ ] 이슈 상세 조회 API — 스택 트레이스, 컨텍스트 포함
- [ ] 동일 이슈 내 개별 이벤트 페이지네이션 API
- [ ] 원본 JSON 반환 API
- [ ] 상태 변경 API — Resolve / Ignore / Reopen
- [ ] 일괄 상태 변경 API (여러 이슈 선택)
- [ ] **재발 감지** — resolved 이슈에 새 이벤트 → unresolved 전환 + regression 플래그 (파이프라인에 추가)
- [ ] (선택) `comments` / `activity` — 이슈 메모, 상태 변경 이력

## STEP 6. 집계 + 검색 고도화 (Phase 4)

- [ ] 이슈별 시간대별 발생 횟수 집계 (시간 단위 버킷 — 그래프/스파크라인용)
- [ ] 이슈별 영향 유저 수 집계 (distinct user.id)
- [ ] 태그별 분포 집계 — browser/OS/release별 발생 비율
- [ ] 이슈 검색 API — 메시지/예외타입 텍스트 검색
- [ ] 태그 검색 (`browser:Chrome` 문법 파싱)
- [ ] 필터 확장 — level, environment, release
- [ ] 🔗 프론트엔드: 그래프·필터·검색 UI 연동

## STEP 7. 알림 (Phase 5)

- [ ] 알림 트리거 ① 새 이슈 생성 시
- [ ] 알림 트리거 ② 재발(regression) 시
- [ ] 알림 트리거 ③ 급증 감지 (기준 정의 포함)
- [ ] 이메일 발송 구현 (🔗 인프라: SMTP 설정)
- [ ] Slack incoming webhook 발송 구현
- [ ] 알림 메시지 포맷 — 이슈 제목/링크/발생 수/환경 포함
- [ ] 디바운싱 — 동일 이슈 알림 시간당 1회 제한
- [ ] 프로젝트별 알림 규칙 저장/조회 API (🔗 프론트엔드: 설정 UI)

## STEP 8. 소스맵 + 심볼리케이션 (Phase 6 — 난이도 최고, 마지막)

- [ ] 소스맵 업로드 엔드포인트 — `POST /api/{project_id}/releases/{version}/files/`
- [ ] 릴리즈/아티팩트 저장 로직 (`releases`, `artifacts` 테이블)
- [ ] 심볼리케이션 — 이벤트의 release + 파일명으로 소스맵 조회
- [ ] 압축된 (line, col) → 원본 파일/함수/라인 복원
- [ ] 복원 위치 기준 주변 소스 5줄 추출해 프레임에 첨부 (pre/context/post_context)
- [ ] 소스맵 없을 때 원본 그대로 처리하는 폴백
- [ ] 🔗 프론트엔드: 소스맵 업로드 CLI/플러그인과 엔드포인트 스펙 맞추기
- [ ] ✅ **마일스톤 M6**: minify된 에러가 원본 코드 위치로 표시된다

## STEP 9. 운영 코드 (Phase 7)

- [ ] 보관 기간 경과 이벤트 삭제 잡 — **필수, 미구현 시 DB 무한 증가** (🔗 인프라: cron 등록)
- [ ] 오래된 릴리즈의 소스맵 아티팩트 정리 잡
- [ ] 헬스체크 엔드포인트 (`/healthz` — DB 연결 포함)
- [ ] 자기 자신의 에러 로깅 — 자기 자신에게 보고하는 무한 루프 방지 (별도 경로 분리)
