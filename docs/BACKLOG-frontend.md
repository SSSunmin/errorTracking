# BACKLOG — 프론트엔드 (대시보드 + JS SDK)

> 오류 추적 시스템(errorTracking) 프론트엔드 구현 백로그. 대시보드(웹 UI)와 브라우저 SDK를 모두 포함.
> 근거: [service-plan.md](service-plan.md) · 작업 순서 상세는 [todo-frontend.md](todo-frontend.md)
> 완료 시 `[x]` + `— YYYY-MM-DD 작업자` 표기. 다른 트랙: [백엔드](BACKLOG-backend.md) · [인프라](BACKLOG-infra.md)

---

## 0. 기반 (Foundation)

- [x] **SDK 패키지 골격 `@errortracking/sdk`** — `init({ dsn, release, environment })` DSN 파싱 + 수집 엔드포인트 결정, `captureException`/`captureMessage` 시그니처 스텁, shared 타입 의존. event_id 생성 유틸은 `@errortracking/shared`(`generateEventId`)에 준비됨 — 2026-06-12 sunmin
- [ ] **대시보드 스캐폴딩** — `apps/dashboard`에 Vite + React + TS 셋업(`@errortracking/shared` workspace 의존 추가). 현재 README 자리만 있음

## 1. 대시보드 기반 + 이슈 목록 (todo STEP 1) — M1 마일스톤

- [ ] **로그인/세션** — 🔗 백엔드 인증 API 대기
- [ ] **프로젝트 화면** — 목록/생성, 설정에서 DSN 표시(복사 버튼)
- [ ] **이슈 목록 (기본)** — 제목/level/발생 수/last_seen, 정렬 3종(최근·빈도·첫 발생), 상태 필터 → 백엔드 이슈 목록 API와 연동 시 **M1 달성**

## 2. JS SDK 기본 캡처 (todo STEP 2) — M2 마일스톤

- [ ] **자동 캡처** — `window.onerror` · `window.onunhandledrejection` 후킹, mechanism 기록
- [ ] **스택 트레이스 파싱** — 프레임별 filename/function/lineno/colno, `in_app` 판별, 체이닝 예외(`cause`)
- [ ] **전송(Transport)** — 이벤트 POST, 기본 컨텍스트 자동 첨부(browser/os UA 파싱, sdk, release, environment)
- [ ] 실제 브라우저 에러가 대시보드에 자동 표시되면 **M2 달성**

## 3. 이슈 상세 화면 (todo STEP 3) — M3 마일스톤

- [ ] **스택 트레이스 뷰어** — in_app 강조, 프레임 접기/펼치기
- [ ] **상태 변경** — Resolve/Ignore/Reopen 버튼, 이슈 목록 일괄 작업
- [ ] **이벤트 탐색** — 같은 이슈 내 개별 이벤트 페이지네이션, 원본 JSON 보기

## 4. 데이터 심화 (todo STEP 4-A/B/C) — M4 마일스톤

- [ ] **SDK Breadcrumbs** — 링 버퍼 100개, 자동 수집 4종(DOM 클릭·페이지 이동·fetch/XHR·console) + `addBreadcrumb()`
- [ ] **SDK 컨텍스트** — `setUser`/`setTag`/`setExtra`, scope(이후 이벤트 자동 첨부), device 정보
- [ ] **SDK 전송 안정성·프라이버시** — 지수 백오프 재시도, `sendBeacon`, 429 Retry-After 준수, `beforeSend` 훅, 민감정보 자동 스크러빙, sampleRate(선택)
- [ ] **대시보드 심화 화면** — Breadcrumbs 타임라인, 컨텍스트 패널, 태그 분포, 추이 그래프(24h/14d), 목록 스파크라인, 검색(`browser:Chrome` 문법)·필터 확장

## 5. 알림 설정 UI (todo STEP 5)

- [ ] 프로젝트별 알림 규칙 화면 — 트리거(새 이슈/재발/급증) on/off, 이메일·Slack webhook 입력

## 6. 소스맵 도구 (todo STEP 6) — M6 마일스톤

- [ ] **업로드 CLI** (`packages/cli`) + webpack/vite 플러그인 (빌드 시 자동 업로드 + release 주입)
- [ ] 스택 뷰어에 원본 소스 컨텍스트(주변 5줄) 표시

## 7. 마무리 (todo STEP 7)

- [ ] SDK 번들 크기·초기화 시간 측정(KPI), SDK 사용 문서, 대시보드 Docker 이미지화

---

## 비고

- **SDK와 대시보드가 한 트랙**: 담당을 나누게 되면 §2·§4(SDK 부분)·§6을 SDK 트랙으로 분리
- 페이로드 계약은 `@errortracking/shared`가 단일 소스 — SDK가 보내는 형태와 대시보드가 그리는 형태가 같은 타입
