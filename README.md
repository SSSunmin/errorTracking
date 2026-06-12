# Error Tracking System

소규모 팀용 셀프호스팅 오류 추적 시스템 (Sentry 동등 수준 데이터, 단일 서버 + PostgreSQL).

## 문서

- [서비스 기획서](docs/service-plan.md)
- [개발 체크리스트 (원본)](docs/error-tracking-checklist.md)
- TODO: [백엔드](docs/todo-backend.md) · [프론트엔드](docs/todo-frontend.md) · [인프라](docs/todo-infra.md)

## 구조

```
apps/
  api/        수집 API + 조회 API (백엔드)
  dashboard/  웹 UI — 프론트엔드 STEP 0에서 Vite 스캐폴딩 예정
packages/
  shared/     이벤트 페이로드 스키마 타입, DSN 파서, 공통 상수 — 모든 패키지가 의존
  sdk/        브라우저 JavaScript SDK
  cli/        소스맵 업로드 CLI (Phase 6에서 구현)
infra/
  docker-compose.dev.yml  로컬 개발용 PostgreSQL
docs/         기획서 + 트랙별 TODO
```

> Worker(비동기 처리 파이프라인)는 초기에는 `apps/api` 안에서 시작하고,
> 부하 분리가 필요해지는 시점에 `apps/worker`로 분리한다.

## 시작하기

```sh
pnpm install
pnpm db:up        # 로컬 PostgreSQL 기동 (infra/.env.example 참고)
pnpm typecheck    # 전체 워크스페이스 타입 체크
```

## 다음 작업

[docs/todo-backend.md](docs/todo-backend.md) STEP 1(DB 스키마)부터 순서대로 진행.
STEP 0(설계 결정)의 산출물은 `packages/shared/src`에 코드로 반영되어 있다.
