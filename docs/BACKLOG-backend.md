# BACKLOG — 백엔드

> 오류 추적 시스템(errorTracking) 백엔드 구현 백로그.
> 근거: [service-plan.md](service-plan.md) Phase 1~7 · 작업 순서 상세는 [todo-backend.md](todo-backend.md)
> 완료 시 `[x]` + `— YYYY-MM-DD 작업자` 표기. 다른 트랙: [프론트엔드](BACKLOG-frontend.md) · [인프라](BACKLOG-infra.md)

---

## 0. 기반 (Foundation)

- [x] **모노레포 스캐폴딩** — pnpm workspaces + TypeScript 통일, `apps/api`·`packages/shared`·`packages/sdk` 골격, 루트 `tsconfig.base.json`(strict), 전체 typecheck 통과 — 2026-06-12 sunmin
- [x] **공유 계약 패키지 `@errortracking/shared`** — SDK·API·대시보드가 공유하는 단일 계약 — 2026-06-12 sunmin
  - `event.ts` — 이벤트 페이로드 타입 (Sentry Event Payload 포맷 차용: exception/stacktrace/breadcrumbs/contexts/user/tags/sdk)
  - `dsn.ts` — DSN 파서/빌더 (`{protocol}://{public_key}@{host}/{project_id}`) + `storeEndpoint()`
  - `constants.ts` — 설계 결정값: 이벤트 최대 1MB · 보관 90일 · rate limit 분당 300건 · breadcrumbs 100개
  - `event-id.ts` — event_id 생성(`generateEventId`)·정규화(`normalizeEventId`, 32자 hex UUID)
  - `issue.ts` — `SEVERITY_LEVELS`/`ISSUE_STATUSES` 상수 배열 (DB enum과 동기)

## 1. 설계 결정 (todo STEP 0)

- [x] **페이로드 스키마·DSN 규칙·크기 제한(1MB)·보관 기간(원본 90일/이슈 영구)** — 문서가 아닌 `packages/shared` 코드로 확정, 변경 시 상수 한 곳만 수정 — 2026-06-12 sunmin
- [x] **IP 주소 기록 여부** — **기본 미기록** 결정 (개인정보 최소화 원칙, user.ip_address 제거). 필요 시 env `RECORD_IP=true`로 활성화 — 2026-06-12 sunmin

## 2. DB 스키마 (todo STEP 1)

- [x] **Drizzle ORM 마이그레이션 체계 + 핵심 테이블 6종** — 2026-06-12 sunmin
  - 도구: Drizzle ORM + drizzle-kit, SQL은 `apps/api/drizzle/`에 커밋 (`pnpm db:generate`/`db:migrate`)
  - 테이블: `projects` / `issues` / `events` / `releases` / `artifacts` / `users_affected` (`apps/api/src/db/schema.ts`)
  - 제약: `UNIQUE issues(project_id, fingerprint)` 그룹핑 기준 · `UNIQUE events(project_id, event_id)` 중복 제거 최종 방어
  - 인덱스: `events(issue_id, timestamp)` · `events(project_id, timestamp)`(보관기간 삭제용) · `issues(project_id, last_seen)`(목록 정렬용)
  - `events.payload`는 shared `EventPayload` 타입이 지정된 JSONB · `issues.regression` 컬럼 선반영(재발 감지용) · `artifacts.content`는 text(소스맵=JSON 텍스트)
  - dev DB 적용 + projects→issues→events FK 체인 INSERT 스모크 테스트 통과
- [ ] (선택) JSONB GIN 인덱스 — 태그 검색 구현(§6) 시점에 판단

## 3. 수집 API — Ingestion (todo STEP 2)

- [x] **`POST /api/{project_id}/store/` 수집 엔드포인트 (Fastify)** — 2026-06-12 sunmin
  - 인증: DSN public_key — `X-Sentry-Auth` 헤더·`?sentry_key=` 쿼리 양쪽 지원 (`src/lib/auth.ts`)
  - CORS 전체 허용 + `text/plain` 페이로드 JSON 파싱 (브라우저 SDK preflight 회피 대응)
  - 검증: event_id 형식(정규화 포함) 400 · bodyLimit 1MB 초과 413 · JSON 파싱 실패 400
  - 중복 제거: 인메모리 LRU(1만 건) + DB 조회 2단 (`src/lib/dedup.ts`)
  - rate limit: 프로젝트별 분당 300건 고정 윈도우 → `429 + Retry-After`, `RATE_LIMIT_PER_MINUTE` env 오버라이드 (`src/lib/rate-limit.ts`)
  - **202 즉시 응답 후 in-process FIFO 큐 위임** (`src/queue/`) — 워커 실행 방식 결정: 단일 서버 전제로 별도 프로세스 없음, 부하 분리 필요 시 `apps/worker` 추출
  - 부수: `/healthz`(DB ping 포함) · `pnpm seed`(dev 프로젝트 생성 + DSN 출력)
  - 검증: 실서버 시나리오 테스트 9종 통과 (401 키없음/오류 · 404 미존재 프로젝트 · 400 깨진JSON/잘못된 event_id · 202 정상/중복 · 429+Retry-After · 413)

## 4. 처리 파이프라인 (todo STEP 3)

- [x] **정규화** — 타임스탬프 보정(누락/미래 클램프, sec/ms 자동 판별), 누락 필드 기본값(platform/level/environment), 크기 초과 트리밍(문자열 8KB, breadcrumbs 최근 100개) (`src/pipeline/normalize.ts`) — 2026-06-12 sunmin
- [x] **민감정보 스크러빙 (서버 2차 방어)** — 키 이름 기반 `[REDACTED]`(password/secret/token/api_key/authorization/cookie/card/cvv/ssn 등) + 카드번호 패턴(13~19자리, 공백·하이픈 허용) 마스킹, 전체 페이로드 재귀 적용 (`src/pipeline/scrub.ts`) — 2026-06-12 sunmin
- [x] **IP 기록 정책 적용** — 기본 `user.ip_address` 제거, `RECORD_IP=true`일 때만 보존 (§1 결정 이행) — 2026-06-12 sunmin
- [x] **핑거프린팅** — in_app 프레임 추출(미지정=in_app 취급, 전무 시 전체 폴백) → 파일명 정규화(origin/쿼리 제거, 8자+ hex 빌드해시 `<hash>` 치환) + 함수명 정규화(익명 통일) → 안쪽 8프레임 + 예외 타입 sha256 해싱. **lineno/colno 의도적 제외**(minify 빌드마다 변동해 그룹핑 깨짐 방지). 스택 없으면 타입+메시지 템플릿(uuid/hex/숫자 치환) 폴백, 메시지 전용 이벤트 지원, SDK 커스텀 `fingerprint` 최우선 (`src/pipeline/fingerprint.ts`) — 2026-06-12 sunmin
- [x] **이슈 upsert + 이벤트 저장 (트랜잭션)** — `ON CONFLICT(project_id, fingerprint)`: times_seen+1 · last_seen GREATEST · level 갱신 / 신규: 제목="타입: 메시지" · culprit=최상위 in_app 프레임. events INSERT는 tx 내 중복 재확인 + UNIQUE 제약 백스톱 (`src/pipeline/index.ts`) — 2026-06-12 sunmin
- [x] **영향 유저 집계** — `users_affected` upsert: 신규 유저만 `issues.user_count` 증가, 기존 유저는 last_seen 갱신 — 2026-06-12 sunmin
- [x] **재발 감지** — resolved 이슈에 새 이벤트 → unresolved 전환 + regression 플래그 (upsert CASE 식, todo STEP 5 항목 조기 구현) — 2026-06-12 sunmin
- 검증(e2e): 동일 TypeError 3건(빌드해시·colno 상이) → 1이슈 times_seen=3·user_count=2 / "User 12345/67890 not found" 메시지 2건 → 1이슈(숫자 템플릿) / ReferenceError 별도 이슈 / password·카드번호 `[REDACTED]`·ip_address 미기록 확인 / resolve 후 재전송 → unresolved + regression=true + user_count=3
- [ ] 심볼리케이션(소스맵)은 §8 구현 시 핑거프린팅 앞 단계로 삽입

## 5. 조회 API (todo STEP 4)

- [x] **로그인/세션 인증** — `users` 테이블(마이그레이션 0001) + scrypt 비밀번호 해시(node:crypto, 외부 의존성 없음) + 서명된 httpOnly 세션 쿠키(7일, `@fastify/cookie`). `POST /api/auth/login`·`logout`·`GET /api/auth/me`, 대시보드 API 공용 `requireAuth` 가드, CORS `credentials: true` (`routes/auth.ts`, `lib/password.ts`, `lib/session.ts`) — 2026-06-12 sunmin
- [x] **프로젝트 CRUD + DSN 발급** — 목록/생성(public_key 자동 발급)/단건/수정/삭제(FK cascade로 이슈·이벤트 동반 삭제). DSN은 `PUBLIC_BASE_URL` env 또는 요청 host로 조립해 응답에 포함 (`routes/projects.ts`) — 2026-06-12 sunmin
- [x] **이슈 목록 API** — `GET /api/projects/:id/issues`: 정렬 3종(last_seen/first_seen/times_seen), status 필터(잘못된 값 400), page/limit 페이지네이션(기본 25, 최대 100), total 동시 반환 (`routes/issues.ts`) — 2026-06-12 sunmin
- [x] **seed 확장** — admin 계정 생성(`ADMIN_EMAIL`/`ADMIN_PASSWORD` env, 기본 admin@local.dev) + `.env.example`에 SESSION_SECRET 등 추가 — 2026-06-12 sunmin
- 검증(e2e): 시나리오 15종 통과 — 로그인 성공/실패, 쿠키 유무별 401/200, 프로젝트 목록·생성·삭제, 정렬(빈도순 4→2→1)·필터(resolved=0)·페이지네이션(limit2 page2=1건)·잘못된 status 400, 로그아웃 후 401
- ✅ **M1 마일스톤 (백엔드 측) 달성** — curl 에러 → 이슈 그룹핑 → 목록 API 노출. 프론트 이슈 목록 화면 연동 시 M1 완전 달성 — 2026-06-12

## 6. 이슈 상세·집계·검색 (todo STEP 5~6)

- [x] **이슈 상세 조회 API** — `GET /api/issues/:id` (목록 필드 + projectId/fingerprint) — 2026-06-12 sunmin
- [x] **이벤트 페이지네이션 API** — `GET /api/issues/:id/events?page&limit`: 최신순, payload(원본 JSON) 포함, 기본 1건씩(상세 화면 넘겨보기용), 페이지네이션 파싱은 `lib/pagination.ts`로 공통화(+테스트 5개) — 2026-06-12 sunmin
- [x] **상태 변경 API** — `PATCH /api/issues/:id` { status }: Resolve/Ignore/Reopen, **resolve 시 regression 플래그 자동 해제**. 검증: ISSUE_STATUSES 외 값 400 — 2026-06-12 sunmin
- [x] **일괄 상태 변경 API** — `PATCH /api/issues` { ids, status }: 1~100건 양의 정수 배열 검증(초과/비정수 400) — 2026-06-12 sunmin
- [ ] 🎯 **집계** — 시간대별 발생 버킷(그래프), 태그 분포(browser/OS/release) — 다음 작업(Phase 4)
- [ ] **검색** — 텍스트 + 태그 문법(`browser:Chrome`), level/environment/release 필터

## 7. 알림 (todo STEP 7)

- [ ] 트리거 3종(새 이슈/재발/급증) + 이메일·Slack webhook 발송 + 디바운싱(이슈당 시간당 1회) + 규칙 API

## 8. 소스맵 + 심볼리케이션 (todo STEP 8) — M6 마일스톤

- [ ] 업로드 엔드포인트(`POST /api/{project_id}/releases/{version}/files/`) + 소스맵 조회·(line,col) 복원·주변 5줄 첨부·폴백

## 9. 운영 (todo STEP 9)

- [ ] 보관 기간 삭제 잡(**필수**) · 소스맵 정리 잡 · 자기 에러 로깅 분리 (healthz는 §3에서 선구현됨)

## 10. 품질 (테스트 · 보안) — 모든 STEP의 완료 기준에 포함

- [x] **vitest 테스트 인프라** — shared/api 패키지에 vitest, 루트 `pnpm test`로 전체 실행 — 2026-06-12 sunmin
- [x] **단위 테스트 74개** — shared 22개(DSN 파서, event-id 정규화) + api 52개(스크러빙, 핑거프린팅, 정규화, 비밀번호 해시, rate limit). 그룹핑 회귀 방지 케이스 포함(빌드해시/lineno 무시, 메시지 템플릿화, in_app 우선, 커스텀 fingerprint) — 2026-06-12 sunmin
- [x] **보안 수정 ①: CORS 이원화** — (취약점) 임의 origin 반사 + credentials 허용 조합 제거. 수집 store 엔드포인트는 전체 origin·credentials 없음(SDK용), 대시보드 API는 `DASHBOARD_ORIGINS` 허용 목록 + credentials만 — 2026-06-12 sunmin
- [x] **보안 수정 ②: 로그인 brute-force 제한** — IP당 분당 10회 초과 시 `429 + Retry-After` (rate-limit 모듈을 문자열 키로 일반화해 재사용) — 2026-06-12 sunmin
- [x] **보안 수정 ③: scrypt 비동기화 + 타이밍 균등화** — `scryptSync` 이벤트 루프 블로킹(DoS 벡터) 제거, 계정 부재 시에도 동일 비용 해시 수행으로 계정 존재 여부 타이밍 노출 방지 — 2026-06-12 sunmin
- [x] **보안 수정 ④: 세션 쿠키 secure 플래그** — `NODE_ENV=production` 또는 `COOKIE_SECURE=true`에서 강제 — 2026-06-12 sunmin
- 검증: 단위 테스트 74개 전부 통과 + e2e(CORS preflight 3종 — evil origin은 대시보드 API에서 ACAO 미발급, brute-force 11번째 429) 통과

---

## 비고

- **마일스톤**: M1(§4+§5 완료 시) → M2~M4(프론트 트랙) → M6(§8) — [service-plan.md](service-plan.md) Phase 표 참고
- **미결정 1건**: GIN 인덱스(§2) — 태그 검색 구현 시 판단 (IP 기록 여부는 §1에서 기본 미기록으로 확정)
- 로컬 개발: `pnpm db:up` → `pnpm --filter @errortracking/api seed` → `pnpm --filter @errortracking/api dev` (PORT 4000, `127.0.0.1` 사용 — localhost는 IPv6로 풀릴 수 있음)
