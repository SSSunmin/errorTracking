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

- [x] **자동 캡처** — `addEventListener("error"/"unhandledrejection")`로 기존 핸들러를 덮어쓰지 않고 후킹, 리소스 로드 실패는 제외(ErrorEvent만), error 객체 없는 onerror는 filename/lineno로 합성, mechanism(onerror/onunhandledrejection/manual) 기록. SDK 내부 오류는 전부 삼켜서 앱 영향·재귀 보고 차단 (`src/index.ts`) — 2026-06-12 sunmin
- [x] **스택 트레이스 파싱** — Chrome(`at fn (url:l:c)`)·Firefox/Safari(`fn@url:l:c`) 포맷, innermost-last(Sentry 규약)로 정렬, `in_app` 판별(same-origin && !node_modules) (`src/stacktrace.ts`) — 2026-06-12 sunmin
- [x] **체이닝 예외 + 비Error 값** — `cause` 최대 5단계 oldest-first, mechanism은 대표 예외에만. 문자열/객체 throw도 안전 직렬화, 값 8KB 트리밍 (`src/event-builder.ts`) — 2026-06-12 sunmin
- [x] **컨텍스트 자동 첨부** — UA 파싱(browser: Edge>Firefox>Chrome>Safari 우선순위 / os: Windows·macOS·iOS·Android·Linux), sdk 이름/버전, release/environment, request.url (`src/context.ts`) — 2026-06-12 sunmin
- [x] **전송(Transport) — 보안 중심 설계** — `text/plain` simple request(CORS preflight 없음, 서버가 JSON 파싱), `credentials: omit`(수집 서버로 쿠키 유출 차단), `keepalive`(이탈 직전 전송), event_id 클라이언트 생성, 모든 실패 무시(fail-silent) (`src/transport.ts`) — 2026-06-12 sunmin
- [x] **데모 페이지 + 테스트** — `pnpm --filter @errortracking/sdk demo`(DSN은 쿼리로 주입 — 키 하드코딩 없음), 단위 테스트 26개(파서/UA/빌더) → 워크스페이스 총 107개 — 2026-06-12 sunmin
- 검증(브라우저 e2e): TypeError(onerror)/Promise 거부/cause 체인(values 2개)/captureMessage 4종 → 수집 → 그룹핑 → 대시보드 목록 표시까지 확인. mechanism·browser/os(Chrome/Windows)·in_app culprit 정확
- ⚠️ 알려진 트레이드오프: 같은 함수 위치에서 던진 같은 타입의 다른 에러는 한 이슈로 묶임 (lineno 제외 핑거프린팅의 의도된 결과 — 소스맵 심볼리케이션 후 context_line 추가로 개선 여지, 백엔드 §8)
- ✅ **M2 마일스톤 달성** — 실제 브라우저 에러 자동 캡처 → 대시보드 표시 — 2026-06-12

## 3. 이슈 상세 화면 (todo STEP 3) — M3 마일스톤

- [x] **이슈 상세 페이지** — `/issues/:id` 라우트, 헤더(level 색상 보더·제목·culprit·status 칩·재발 칩·events/users/첫·최근 발생), 목록 행 클릭 → 상세 이동 (`pages/IssueDetailPage.tsx`) — 2026-06-12 sunmin
- [x] **스택 트레이스 뷰어** — in_app 프레임 앰버 강조, 연속 시스템 프레임 구간 접기/펼치기(`▸ 시스템 프레임 N개`), cause 체인은 대표 예외부터 카드 복수 표시 + mechanism 칩. 프레임 세그먼트 로직은 `lib/frames.ts`로 분리(+테스트 7개) — 2026-06-12 sunmin
- [x] **상태 변경** — Resolve/Ignore/Reopen 버튼(현재 상태 비활성), status 칩 즉시 갱신 — 2026-06-12 sunmin
- [x] **이벤트 탐색** — 최신↔과거 1건씩 페이지네이션("이벤트 N / total"), event_id 표시, 원본 JSON 접이식 보기 — 2026-06-12 sunmin
- [x] **컨텍스트 패널** — environment/release/url/browser/os/user/sdk/발생 시각 그리드 (값 없는 항목 자동 생략) — 2026-06-12 sunmin
- [x] **이슈 목록 일괄 작업** — 행 체크박스(클릭 전파 차단) + 선택 N건 표시 + 해결/무시 일괄 버튼 → 목록 리로드 — 2026-06-12 sunmin
- 검증(브라우저 e2e): 목록 행 클릭 → 상세(이벤트 1/2, mechanism 칩, in_app 1개 강조, 시스템 2개 접힘, 컨텍스트 7종, 원본 JSON) → 과거 이벤트(cause 체인 예외 카드 2개) → Resolve(칩 "해결됨"·버튼 상태 갱신) → 목록 일괄 해결(5건 중 2건 → 3건). 테스트 총 119개 통과
- ✅ **M3 마일스톤 달성** — 2026-06-12

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
