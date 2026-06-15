# 인프라 구현 TODO — 순서대로 작업

> 근거: [service-plan.md](service-plan.md), [error-tracking-checklist.md](error-tracking-checklist.md)
> 전제: 단일 서버 + PostgreSQL, 수평 확장 없음 (의도적 제약)
> 표기: 🔗 = 타 트랙 의존/연동 지점

---

## STEP 1. 로컬 개발 환경 (Phase 1 시작과 동시) ✅

- [x] PostgreSQL 로컬 컨테이너 — `infra/docker-compose.dev.yml`
- [x] DB 마이그레이션 실행 환경 — drizzle-kit (`pnpm db:migrate`)
- [x] 환경변수/시크릿 관리 규칙 — `infra/.env.example`, `apps/api/.env.example`
- [x] 공통 로컬 실행 가이드 — README "시작하기"

## STEP 2. 기본 배포 구성 (Phase 1~2)

- [x] Docker Compose 구성 — `infra/docker-compose.yml`: db + api + dashboard (Worker는 API in-process 큐라 별도 없음)
- [x] API 서버 Dockerfile — `infra/Dockerfile.api` (빌드+기동+마이그레이션+healthz 실측 검증)
- [x] Worker 실행 구성 — in-process 결정(단일 서버 전제), 분리 시 서비스 추가
- [x] 리버스 프록시(nginx) — `infra/nginx.conf`: 대시보드 정적 + `/api` 프록시
- [x] HTTPS — `COOKIE_SECURE`+`X-Forwarded-Proto` 대응, TLS 종단은 외부 프록시 권장(DEPLOY.md 8장)
- [x] CORS — same-origin(프록시)이라 대시보드 CORS 불필요, 수집은 개방
- [x] ✅ **마일스톤 M2 지원**: 외부 브라우저 → 수집 엔드포인트 (개발 중 실증됨)

## STEP 3. 데이터 안전 ✅

- [x] DB 백업/복원 절차 — `DEPLOY.md` 6장 (pg_dump cron + 복원)
- [x] 디스크 사용량 — 보관 삭제 잡으로 events 증가 억제

## STEP 4. 알림 채널 인프라 ✅

- [x] SMTP/Slack — API env + DEPLOY.md (Slack은 hooks.slack.com만 허용)

## STEP 5. 소스맵 스토리지 ✅

- [x] 저장 위치 — DB text 컬럼(`artifacts.content`)
- [x] 업로드 크기 제한 일치 — API 20MB ↔ nginx 20m

## STEP 6. 운영 안정화 ✅

- [x] **보관 기간 삭제 cron** — 백엔드 in-process 6시간 잡 + `pnpm retention`(외부 cron 가능)
- [x] 오래된 릴리즈 소스맵 정리 — retention에 포함
- [x] 헬스체크 연동 — compose healthcheck가 `/healthz` 폴링
- [x] 컨테이너 자동 재시작 — `restart: unless-stopped`
- [x] 자체 에러 로그 분리 — setErrorHandler(스택 유출 차단, 자기 보고 루프 없음)
- [x] 로그 로테이션 — DEPLOY.md 10장 (Docker 로그 드라이버 max-size 안내)
- [x] 배포/롤백 문서 — `docs/DEPLOY.md`
- [x] ✅ **마일스톤 M7 달성**: 무인 운영 — 백업·삭제·헬스체크 자동 — 2026-06-15

---

## 트랙 간 동기화 지점 요약

| 시점 | 인프라가 먼저 준비해야 할 것 |
|---|---|
| Phase 1 착수 | 로컬 DB + 마이그레이션 환경 |
| Phase 2 (SDK 테스트) | HTTPS + CORS 되는 스테이징 서버 |
| 데이터 적재 시작 | DB 백업 + 디스크 모니터링 |
| Phase 5 | SMTP / Slack webhook |
| Phase 7 이전이라도 | 보관 기간 삭제 cron (조기 적용 권장 — 기획서 리스크 1순위) |
