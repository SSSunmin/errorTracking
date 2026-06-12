# BACKLOG — 프론트엔드 (대시보드 + JS SDK)

> 오류 추적 시스템(errorTracking) 프론트엔드 구현 백로그. 대시보드(웹 UI)와 브라우저 SDK를 모두 포함.
> 근거: [service-plan.md](service-plan.md) · 작업 순서 상세는 [todo-frontend.md](todo-frontend.md)
> 완료 시 `[x]` + `— YYYY-MM-DD 작업자` 표기. 다른 트랙: [백엔드](BACKLOG-backend.md) · [인프라](BACKLOG-infra.md)

---

## 0. 기반 (Foundation)

- [x] **SDK 패키지 골격 `@errortracking/sdk`** — `init({ dsn, release, environment })` DSN 파싱 + 수집 엔드포인트 결정, `captureException`/`captureMessage` 시그니처 스텁, shared 타입 의존. event_id 생성 유틸은 `@errortracking/shared`(`generateEventId`)에 준비됨 — 2026-06-12 sunmin
- [x] **대시보드 스캐폴딩** — Vite 7 + React 19 + TS + react-router 7, `@errortracking/shared` workspace 의존. `/api`는 vite dev 프록시로 same-origin 연결(세션 쿠키가 cross-origin 없이 동작 — CORS 표면 최소화), vitest 포함 — 2026-06-12 sunmin
- [x] **디자인 시스템** — "유틸리테리언 터미널 콘솔" 테마: 다크 블루(#0b0e14) + 시그널 앰버(#ffb224) 액센트, IBM Plex Sans KR(UI) + IBM Plex Mono(데이터), level별 색상 토큰(fatal/error/warning/info/debug), 그리드 배경 텍스처, 블링킹 커서 워드마크 `errtrack_` (`src/styles.css` CSS 변수) — 2026-06-12 sunmin

## 1. 대시보드 기반 + 이슈 목록 (todo STEP 1) — M1 마일스톤

- [x] **로그인/세션 게이트** — `AuthProvider`(앱 로드 시 `/api/auth/me` 확인) + 보호 라우트(`ProtectedLayout`), 로그인 폼(401 "비밀번호 올바르지 않음" / 429 "시도 초과" 구분 표시), 상단바 사용자 표시 + 로그아웃 (`src/auth.tsx`, `pages/LoginPage.tsx`) — 2026-06-12 sunmin
- [x] **프로젝트 화면** — 목록(카드 그리드) / 인라인 생성 폼 / **DSN 표시 + 클립보드 복사 버튼**(복사됨 피드백), 플랫폼 칩 (`pages/ProjectsPage.tsx`) — 2026-06-12 sunmin
- [x] **이슈 목록 화면** — level 색상 바·배지, mono 에러 제목 + culprit, 발생 수·영향 유저(k 축약), last_seen 상대 시간, **재발 칩**, 정렬 3종 select, 상태 필터 세그먼트(미해결/해결됨/무시됨/전체), 페이지네이션, 빈 상태 안내 (`pages/IssuesPage.tsx`, `lib/format.ts`) — 2026-06-12 sunmin
- [x] **테스트** — format 유틸 단위 테스트 7개(timeAgo 한국어 상대시간, formatCount k/m 축약) → 워크스페이스 총 81개 — 2026-06-12 sunmin
- 검증(브라우저 e2e): 미인증 접근 → /login 리다이렉트 → 로그인 → 프로젝트 목록(DSN 표시) → 이슈 목록(실데이터 3건: level/재발 칩/카운트/상대시간 렌더) → 상태 필터 전환(해결됨=빈 상태) 전부 확인. `pnpm build` 통과(gzip 77KB)
- ✅ **M1 마일스톤 완전 달성** — 에러 전송 → 그룹핑 → 대시보드 표시 루프 완성 — 2026-06-12

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
