# 프론트엔드 구현 TODO — 순서대로 작업

> 근거: [service-plan.md](service-plan.md), [error-tracking-checklist.md](error-tracking-checklist.md)
> 범위: 대시보드(웹 UI) + JavaScript SDK + 빌드 도구
> 표기: 🔗 = 타 트랙 의존/연동 지점

---

## STEP 0. 사전 준비

- [x] 🔗 백엔드: 이벤트 페이로드 스키마 / API 스펙 수령 — `@errortracking/shared` 공용 의존성
- [x] 대시보드 프레임워크·빌드 환경 셋업 — Vite + React 19 + TS, `/api` dev 프록시(same-origin 쿠키)
- [ ] SDK 패키지(별도 번들) 빌드 환경 셋업 — 번들 크기 목표 설정 (STEP 2에서)

## STEP 1. 대시보드 기반 + 이슈 목록 (Phase 1) ✅

- [x] 로그인 화면 / 세션 처리 — AuthProvider(me 확인) + 보호 라우트, 401/429 에러 구분 표시
- [x] 프로젝트 목록 / 생성 화면
- [x] 프로젝트 설정 화면 — DSN 표시(복사 버튼) — 카드 안에 DSN + 클립보드 복사
- [x] 이슈 목록 화면 (기본) — 제목, level, 발생 수, 영향 유저, last_seen, 재발 칩
- [x] 정렬: 최근 발생순 / 발생 빈도순 / 첫 발생순
- [x] 상태 필터: unresolved / resolved / ignored / 전체 + 페이지네이션
- [x] ✅ **마일스톤 M1**: 백엔드에 들어온 에러가 이슈 목록에 보인다 — 2026-06-12 달성 (브라우저 e2e 확인)

## STEP 2. JavaScript SDK — 기본 캡처 (Phase 2) ✅

- [x] SDK `init({ dsn, release, environment })` 진입점
- [x] DSN 파싱 → 수집 엔드포인트 결정 (shared 재사용)
- [x] `window.onerror` 후킹 — addEventListener로 기존 핸들러 보존, error 객체 없으면 합성
- [x] `window.onunhandledrejection` 후킹 (Promise 거부)
- [x] 수동 캡처 API — `captureException(err)`, `captureMessage(msg, level)`
- [x] 스택 트레이스 파싱 — Chrome/Firefox/Safari 포맷, 프레임별 `filename`/`function`/`lineno`/`colno`
- [x] `in_app` 판별 — same-origin이며 node_modules 아닌 스크립트만 true
- [x] `mechanism` 기록 — onerror / onunhandledrejection / manual
- [x] 체이닝 예외 지원 — `cause` 최대 5단계, oldest-first 기록
- [x] 전송(Transport) — text/plain simple request POST, `event_id` 클라이언트 생성, credentials omit
- [x] 기본 컨텍스트 자동 첨부 — browser/os(UA 파싱), sdk 이름/버전, release, environment, request.url
- [x] ✅ **마일스톤 M2**: 실제 브라우저 에러가 자동으로 대시보드에 나타난다 — 2026-06-12 달성 (데모 페이지 e2e)

## STEP 3. 이슈 상세 화면 (Phase 3) ✅

- [x] 스택 트레이스 뷰어 — in_app 프레임 강조(앰버 바), 시스템 프레임 구간 접기/펼치기, cause 체인은 예외 카드 복수 표시
- [x] 상태 변경 버튼 — Resolve / Ignore / Reopen (현재 상태 비활성, resolve 시 regression 해제)
- [x] 이벤트 페이지네이션 — 최신↔과거 1건씩 넘겨보기 (이벤트 N / total)
- [x] 원본 JSON 보기 — details/summary 접이식
- [x] 이슈 목록 → 일괄 작업 — 체크박스 선택 + 해결/무시 일괄 버튼
- [x] ✅ **마일스톤 M3**: 이슈 하나를 화면에서 끝까지 분석·처리할 수 있다 — 2026-06-12 달성 (브라우저 e2e)

## STEP 4-A. SDK — Breadcrumbs + 컨텍스트 (Phase 4) ✅

- [x] Breadcrumbs 링 버퍼 (최근 100개) — `breadcrumbs.ts` BreadcrumbBuffer
- [x] breadcrumb 스키마 — `timestamp`, `type`, `category`, `message`, `level`, `data`
- [x] 자동 수집: DOM 클릭 (요소 셀렉터 기록, capture 단계)
- [x] 자동 수집: 페이지 이동 (history pushState/popstate)
- [x] 자동 수집: `fetch` / `XHR` (URL, 메서드, 상태코드)
- [x] 자동 수집: `console.log/warn/error` 호출 (warn→warning 레벨 매핑)
- [x] 수동 추가 API — `addBreadcrumb({...})`
- [x] `setUser()` / `setTag()` / `setExtra()` API — `scope.ts`
- [x] `scope` 개념 — 설정한 컨텍스트가 이후 모든 이벤트에 자동 첨부
- [x] device 컨텍스트 — 화면 해상도, 메모리(deviceMemory)
- (선택) `console.error` 자동 캡처 — console 후킹에 포함됨

## STEP 4-B. SDK — 전송 안정성 + 프라이버시 (Phase 4) ✅

- [x] 전송 실패 시 재시도 (지수 백오프) — 5xx/네트워크 오류, 최대 3회
- [x] 페이지 이탈 시 잔여 이벤트 전송 (`navigator.sendBeacon`) — pagehide/visibilitychange flush
- [x] 서버 `429 + Retry-After` 수신 시 전송 중단 — RateLimitGate, pending 적재
- [x] `beforeSend` 훅 — 전송 전 이벤트 수정/필터링 (null 반환 시 취소)
- [x] 민감정보 자동 스크러빙 — shared `scrubSensitive` 공유(서버 2차와 동일 로직)
- [x] `sampleRate` 옵션 — `shouldSample` 순수 함수

## STEP 4-C. 대시보드 — 데이터 심화 화면 (Phase 4) — 진행 중

- [x] Breadcrumbs 타임라인 표시 — 최신순, 카테고리 라벨·색상, 시각 (`lib/breadcrumbs.ts`)
- [x] 컨텍스트 패널 — user, browser, os, device, request (STEP 3에서 구현, device는 4-A 데이터로 채워짐)
- [x] 이벤트 태그 표시 — 이슈 상세에 tag pill (분포 집계는 아래 별도)
- [x] 태그 분포 — browser/os/release/environment별 % 막대 (인라인 SVG, 차트 라이브러리 없음)
- [x] 발생 추이 그래프 — 24시간 / 14일 토글 (TrendBars 인라인 SVG)
- [x] 이슈 목록 행에 스파크라인 — 최근 24시간 시간대별 막대 (Sparkline 인라인 SVG)
- [x] 검색 — 제목 텍스트 + 태그 검색 (`browser:Chrome` 문법), 검색바 폼
- [x] 필터 확장 — level 셀렉트 (environment/release는 태그 검색 문법으로 지원)
- [x] ✅ **마일스톤 M4 완전 달성**: 에러 직전 행적·환경 정보·추이·태그분포·검색 — 2026-06-15

## STEP 5. 알림 설정 UI (Phase 5) ✅

- [x] 프로젝트별 알림 규칙 설정 화면 — 트리거(새 이슈/재발/급증) on/off, 활성화 토글
- [x] 채널 설정 — 이메일 주소, Slack webhook URL 입력
- [x] 🔗 백엔드: 알림 규칙 API 연동 (`GET/PUT alert-rule`), SSRF 검증 에러 표시
- 진입: 이슈 목록 헤더 "알림 설정" 링크 → `/projects/:id/alerts`

## STEP 6. 소스맵 도구 + 표시 (Phase 6) ✅

- [x] 소스맵 업로드 CLI — `errtrack-upload --dsn --secret --release --dist` (`packages/cli`), dist의 .map 재귀 수집 후 업로드
- [x] vite 플러그인 — `errtrackSourcemaps({dsn, secretKey, release})` closeBundle에서 자동 업로드 (vite 직접 의존 없이 구조적 타입)
- [x] 스택 뷰어에 원본 소스 컨텍스트(주변 5줄) 표시 — 라인번호 + 에러 줄 강조 (`SourceContext`)
- [ ] "특정 릴리즈에서 해결됨" 표시 (선택) — 미구현
- [x] ✅ **마일스톤 M6 달성**: minify된 에러가 원본 코드 위치 + 소스로 표시 — 2026-06-15 (CLI 업로드 → 심볼리케이션 → 대시보드 컨텍스트 e2e)

## STEP 7. 마무리 (Phase 7)

- [ ] SDK 번들 크기·초기화 시간 측정 (KPI: 페이지 로드 영향 최소화)
- [ ] SDK 사용 문서 (init 옵션, API 레퍼런스, 업로드 도구 가이드)
- [x] 대시보드 빌드 산출물 Docker 이미지화 — `infra/Dockerfile.dashboard` (nginx, Compose 편입)
