# BACKLOG — 인프라

> 오류 추적 시스템(errorTracking) 인프라 구현 백로그. 전제: 단일 서버 + PostgreSQL, 수평 확장 없음(의도적 제약).
> 근거: [service-plan.md](service-plan.md) · 작업 순서 상세는 [todo-infra.md](todo-infra.md)
> 완료 시 `[x]` + `— YYYY-MM-DD 작업자` 표기. 다른 트랙: [백엔드](BACKLOG-backend.md) · [프론트엔드](BACKLOG-frontend.md)

---

## 0. 저장소 (Repository)

- [x] **GitHub 레포 + git 플로우** — `SSSunmin/errorTracking` 원격 연결, `main` 브랜치(전역 `init.defaultBranch` 적용), 개인 계정 자격증명 분리(원격 URL에 사용자명 명시), `.gitignore` — 2026-06-12 sunmin
- [x] **pnpm 환경** — corepack으로 pnpm 11 활성화, `pnpm-workspace.yaml`(apps/* + packages/*, esbuild allowBuilds) — 2026-06-12 sunmin

## 1. 로컬 개발 환경 (todo STEP 1)

- [x] **PostgreSQL dev 컨테이너** — `infra/docker-compose.dev.yml`: postgres:16-alpine, 프로젝트명 `errortracking-dev`, healthcheck(pg_isready), named volume, `restart: unless-stopped`. 루트 `pnpm db:up`/`db:down` 스크립트 — 2026-06-12 sunmin
- [x] **환경변수 템플릿** — `infra/.env.example`(Postgres 접속) + `apps/api/.env.example`(DATABASE_URL, compose 기본값과 일치) — 2026-06-12 sunmin
- [x] **마이그레이션 실행 환경** — drizzle-kit (`pnpm --filter @errortracking/api db:migrate`), DATABASE_URL 미설정 시 로컬 기본값 폴백 — 2026-06-12 sunmin
- [x] **로컬 실행 가이드** — 루트 README "시작하기" (install → db:up → typecheck) — 2026-06-12 sunmin

## 2. 기본 배포 구성 (todo STEP 2) ✅

- [x] **운영 Docker Compose** — `infra/docker-compose.yml`: db + api + dashboard 3서비스(Worker는 API in-process 큐라 별도 없음). env로 시크릿 주입(POSTGRES_PASSWORD/SESSION_SECRET 필수), depends_on healthcheck 게이팅, restart unless-stopped — 2026-06-15 sunmin
- [x] **API Dockerfile** — `infra/Dockerfile.api`: node22-alpine + pnpm 워크스페이스 설치, 기동 시 `db:migrate && start`. **실제 빌드+컨테이너 기동+마이그레이션+healthz 200 검증 완료** — 2026-06-15 sunmin
- [x] **대시보드 이미지** — `infra/Dockerfile.dashboard`: vite 빌드(CSP meta 주입) → nginx 정적 서빙 — 2026-06-15 sunmin
- [x] **리버스 프록시(nginx) + HTTPS 안내** — `infra/nginx.conf`: SPA 폴백 + `/api` 프록시(same-origin 쿠키), client_max_body_size 20m(소스맵 업로드 일치), 보안 헤더(X-Frame-Options DENY/nosniff/Referrer-Policy), X-Forwarded-Proto 전달. TLS 종단은 외부 프록시 권장(DEPLOY.md 8장) — 2026-06-15 sunmin
- [x] **CORS** — same-origin(nginx 프록시)이라 대시보드는 CORS 불필요, 수집 엔드포인트는 전체 개방(API 설정 완료) — 2026-06-15 sunmin

## 3. 데이터 안전 (todo STEP 3) ✅

- [x] **DB 백업/복원 절차** — `DEPLOY.md` 6장: pg_dump gzip 백업 + cron 예시 + 복원 명령 — 2026-06-15 sunmin
- 디스크 모니터링 — 보관 삭제 잡(§6)으로 events 증가 억제됨

## 4. 알림 채널 (todo STEP 4) ✅

- [x] SMTP/Slack 설정 — API env(SMTP_*) + `DEPLOY.md`. Slack webhook은 hooks.slack.com만 허용(백엔드 SSRF 차단) — 2026-06-15 sunmin

## 5. 소스맵 스토리지 (todo STEP 5) ✅

- [x] **저장 위치 결정** — DB text 컬럼(`artifacts.content`) — 별도 볼륨 불필요, DB 백업에 포함 — 2026-06-12 sunmin
- [x] **업로드 크기 제한 일치** — API bodyLimit 20MB ↔ nginx client_max_body_size 20m — 2026-06-15 sunmin

## 6. 운영 안정화 (todo STEP 6) ✅

- [x] **보관 기간 삭제(필수)** — 백엔드 in-process 6시간 잡 + `pnpm retention`(cron). events 삭제·이슈 영구 보존 (백엔드 §9) — 2026-06-15 sunmin
- [x] **소스맵 정리 + healthcheck 연동** — retention이 오래된 릴리즈 정리, compose healthcheck가 `/healthz` 폴링 — 2026-06-15 sunmin
- [x] **자기 에러 로그 분리 + 배포/롤백 문서** — setErrorHandler(스택 유출 차단, 자기 보고 루프 없음), `DEPLOY.md` 9·10장(업데이트/롤백/로그 로테이션) → **✅ M7: 무인 운영 가능** — 2026-06-15 sunmin
- 검증: 운영 compose `config` 통과 + API 이미지 빌드·컨테이너 기동·마이그레이션·healthz 200 실측

---

## 비고

- **트랙 간 동기화**: Phase 2(SDK 테스트) 전 HTTPS 스테이징, Phase 5 전 SMTP/Slack, 데이터 적재 시작 시 백업 — [todo-infra.md](todo-infra.md) 동기화 표 참고
- 로컬 개발 시 API 접속은 `127.0.0.1:4000` 사용 (서버가 IPv4 바인딩, Windows에서 localhost가 ::1로 풀릴 수 있음)
