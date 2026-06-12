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

## 2. 기본 배포 구성 (todo STEP 2)

- [ ] **운영 Docker Compose** — API + Worker + DB + Front 4서비스 (Worker는 현재 API in-process 큐 → 분리 시점에 서비스 추가)
- [ ] **API Dockerfile** / 대시보드 빌드 이미지
- [ ] **리버스 프록시 + HTTPS** — DSN이 https 전제이므로 필수. 프록시 body size를 API bodyLimit(1MB)과 일치시킬 것
- [ ] **CORS 동작 확인** — 외부 브라우저 → 수집 엔드포인트 (API 쪽 설정은 완료됨)
- [ ] **스테이징 서버 1대** — SDK 실제 브라우저 테스트용 → **M2 지원**

## 3. 데이터 안전 (todo STEP 3)

- [ ] DB 정기 백업(pg_dump cron) + **복원 절차 1회 실제 검증**
- [ ] 디스크 사용량 모니터링 — 보관 정책 cron 전까지 events 무한 증가 주의

## 4. 알림 채널 (todo STEP 4)

- [ ] SMTP 계정/릴레이 + 발신 도메인(SPF) · Slack incoming webhook 발급 절차 문서화

## 5. 소스맵 스토리지 (todo STEP 5)

- [x] **저장 위치 결정** — DB text 컬럼(`artifacts.content`, 소스맵은 JSON 텍스트) — 별도 디스크 볼륨 불필요, DB 백업에 포함됨 — 2026-06-12 sunmin
- [ ] 업로드 파일 크기 제한 — 프록시(body size)와 API 양쪽 일치 (§2 프록시 구성 시 함께)

## 6. 운영 안정화 (todo STEP 6)

- [ ] **보관 기간 삭제 cron — 필수, 미구현 시 DB 무한 증가** (백엔드 삭제 잡 대기, 데이터 쌓이기 시작하면 조기 적용)
- [ ] 소스맵 정리 cron · Compose healthcheck 연동(API `/healthz`는 구현됨) · 외부 uptime 감시
- [ ] 시스템 자체 에러 로그 분리(자기 보고 무한 루프 금지) · 로그 로테이션 · 배포/롤백 절차 문서화 → **M7: 무인 운영**

---

## 비고

- **트랙 간 동기화**: Phase 2(SDK 테스트) 전 HTTPS 스테이징, Phase 5 전 SMTP/Slack, 데이터 적재 시작 시 백업 — [todo-infra.md](todo-infra.md) 동기화 표 참고
- 로컬 개발 시 API 접속은 `127.0.0.1:4000` 사용 (서버가 IPv4 바인딩, Windows에서 localhost가 ::1로 풀릴 수 있음)
