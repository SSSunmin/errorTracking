# 인프라 구현 TODO — 순서대로 작업

> 근거: [service-plan.md](service-plan.md), [error-tracking-checklist.md](error-tracking-checklist.md)
> 전제: 단일 서버 + PostgreSQL, 수평 확장 없음 (의도적 제약)
> 표기: 🔗 = 타 트랙 의존/연동 지점

---

## STEP 1. 로컬 개발 환경 (Phase 1 시작과 동시)

- [ ] PostgreSQL 로컬 컨테이너 (개발용 docker-compose)
- [ ] DB 마이그레이션 실행 환경 정리 (🔗 백엔드: 마이그레이션 도구)
- [ ] 환경변수/시크릿 관리 규칙 (.env 템플릿 — DB 접속, 시크릿 키)
- [ ] 공통 로컬 실행 가이드 문서 (백엔드/프론트 모두 한 번에 띄우기)

## STEP 2. 기본 배포 구성 (Phase 1~2)

- [ ] Docker Compose 구성: **API + Worker + DB + Front** 4개 서비스
- [ ] API 서버 Dockerfile
- [ ] Worker(비동기 처리) 실행 구성 — 별도 프로세스/컨테이너 (🔗 백엔드: 잡 실행 방식 협의)
- [ ] 리버스 프록시 (수집 엔드포인트 + 대시보드 라우팅)
- [ ] HTTPS 인증서 — DSN이 `https://` 전제이므로 필수
- [ ] CORS 동작 확인 — 브라우저 SDK cross-origin 전송 (🔗 백엔드 설정과 일치)
- [ ] 스테이징(테스트) 서버 1대 준비 — SDK 실제 브라우저 테스트용
- [ ] ✅ **마일스톤 M2 지원**: 외부 브라우저에서 수집 엔드포인트로 전송 가능

## STEP 3. 데이터 안전 (Phase 3~4 사이, 데이터 쌓이기 시작하면 즉시)

- [ ] DB 정기 백업 (pg_dump cron + 보관 주기)
- [ ] 백업 복원 절차 1회 실제 검증
- [ ] DB 볼륨/디스크 사용량 모니터링 (보관 정책 전까지 무한 증가 주의)

## STEP 4. 알림 채널 인프라 (Phase 5)

- [ ] SMTP 계정/릴레이 설정 (🔗 백엔드: 이메일 발송)
- [ ] Slack incoming webhook 발급 절차 문서화
- [ ] 발신 도메인 설정 (SPF 등 — 스팸 분류 방지, 가능한 범위)

## STEP 5. 소스맵 스토리지 (Phase 6)

- [ ] 소스맵 아티팩트 저장 위치 결정 (DB bytea vs 디스크 볼륨) 및 볼륨 마운트
- [ ] 업로드 파일 크기 제한 — 프록시(body size)와 API 양쪽 일치

## STEP 6. 운영 안정화 (Phase 7)

- [ ] **보관 기간 삭제 cron 등록 — 필수, 없으면 DB 무한 증가** (🔗 백엔드: 삭제 잡)
- [ ] 오래된 릴리즈 소스맵 정리 cron 등록
- [ ] 헬스체크 연동 — Compose healthcheck + 외부 감시(uptime) (🔗 백엔드: `/healthz`)
- [ ] 컨테이너 자동 재시작 정책 (restart: unless-stopped)
- [ ] 시스템 자체 에러 로그 수집 경로 — 자기 자신에게 보고하는 무한 루프 금지, 파일/저널 로그로 분리
- [ ] 로그 로테이션 (Docker 로그 드라이버 max-size)
- [ ] 프로덕션 배포 절차 문서화 (업데이트/롤백 방법)
- [ ] ✅ **마일스톤 M7**: 무인 운영 가능 — 백업·삭제·헬스체크가 자동으로 돈다

---

## 트랙 간 동기화 지점 요약

| 시점 | 인프라가 먼저 준비해야 할 것 |
|---|---|
| Phase 1 착수 | 로컬 DB + 마이그레이션 환경 |
| Phase 2 (SDK 테스트) | HTTPS + CORS 되는 스테이징 서버 |
| 데이터 적재 시작 | DB 백업 + 디스크 모니터링 |
| Phase 5 | SMTP / Slack webhook |
| Phase 7 이전이라도 | 보관 기간 삭제 cron (조기 적용 권장 — 기획서 리스크 1순위) |
