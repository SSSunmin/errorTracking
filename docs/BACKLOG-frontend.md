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

- [x] **SDK Breadcrumbs** — 링 버퍼 100개(`breadcrumbs.ts`), 자동 수집 4종(`instrument.ts`): DOM 클릭(capture 단계, 셀렉터 `tag#id.class`)·라우팅(pushState/popstate)·fetch/XHR(메서드·URL·status)·console(warn→warning 매핑). 각 패치 try/catch로 앱 영향 차단. `addBreadcrumb()` 수동 API — 2026-06-15 sunmin
- [x] **SDK 컨텍스트 + scope** — `setUser`/`setTag`/`setExtra`(`scope.ts` Scope, snapshot은 복사본), 설정값이 이후 모든 이벤트 자동 첨부. device 컨텍스트(화면 해상도·deviceMemory) — 2026-06-15 sunmin
- [x] **SDK 전송 안정성** — 지수 백오프 재시도(5xx/네트워크, 최대 3회, `backoffDelay`), `sendBeacon` flush(pagehide/visibilitychange), 429 `Retry-After` 준수(`RateLimitGate`, 정지 중 pending 적재) (`transport.ts`) — 2026-06-15 sunmin
- [x] **SDK 프라이버시** — `beforeSend` 훅(null 반환 시 취소, 오류 시 원본 유지), 민감정보 자동 스크러빙(shared `scrubSensitive`로 서버 2차와 **동일 로직 공유** — `apps/api`의 scrub를 `packages/shared`로 이동), `sampleRate`(`shouldSample` 순수 함수) — 2026-06-15 sunmin
- [x] **테스트** — SDK 신규 30개(scope/breadcrumbs/sampling/transport: 링 버퍼·셀렉터·백오프·게이트·429 pending·beacon) + scrub 이동 → 워크스페이스 총 154개 — 2026-06-15 sunmin
- 검증(브라우저 e2e): 데모 ⑤ 버튼 → DB에서 breadcrumbs 4종(ui.click·console.log·console.warn→warning·http) + scope(user demo-user-42, tag feature=checkout) + device(screen_width 1536) 정확 수집 확인
- [x] **대시보드 Breadcrumbs 타임라인** — 이슈 상세에 에러 직전 행적 최신순 표시(카테고리 라벨·색상: CLICK/NAV/HTTP/LOG/WARN/ERROR, http 4xx+는 빨강, 시각 HH:MM:SS). 이벤트 태그 pill 표시. 표시 로직 `lib/breadcrumbs.ts`(+테스트 8개) (`pages/IssueDetailPage.tsx`) — 2026-06-15 sunmin
- 검증(브라우저 e2e): 이슈 상세에서 Breadcrumbs 4종(HTTP→WARN→LOG→CLICK 최신순) + 태그(feature=checkout) + 컨텍스트(device 포함) 렌더 확인. 워크스페이스 테스트 총 162개
- ✅ **M4 마일스톤 달성** — 에러 직전 행적·환경 정보가 대시보드에 함께 표시 — 2026-06-15
- [x] **발생 추이 그래프** — 이슈 상세에 24시간/14일 토글 막대 그래프(`TrendBars`), 빈 버킷 포함 (`components/charts.tsx`) — 2026-06-15 sunmin
- [x] **태그 분포** — browser/os/release/environment별 value→percent 막대(내림차순), 한국어 라벨 — 2026-06-15 sunmin
- [x] **목록 스파크라인** — 이슈 행에 최근 24시간 막대(`Sparkline`), 데이터 없으면 점선 (인라인 SVG — 차트 라이브러리 없이 번들 gzip 80KB 유지) — 2026-06-15 sunmin
- [x] **검색 + 필터** — 검색바 폼(제목 텍스트 + `browser:Chrome`·`release:1.0.0` 태그 문법, 지우기), level 셀렉트. page 1로 리셋 — 2026-06-15 sunmin
- 검증(브라우저 e2e): 상세 추이 그래프(24h 24막대→14d 14막대 토글) + 태그 분포 4종(브라우저/OS/릴리즈/환경 100%) + 목록 스파크라인(활성 1·빈 3) + 태그검색(browser:Chrome→1건) + level 필터(warning→1건) 전부 확인. 워크스페이스 테스트 총 175개
- ✅ **M4 마일스톤 완전 달성** — 데이터 심화 화면 완성 — 2026-06-15

## 5. 알림 설정 UI (todo STEP 5) ✅

- [x] **알림 설정 화면** — `/projects/:id/alerts` (이슈 목록 헤더 "알림 설정" 링크). 활성화 토글 + 트리거 3종(새 이슈/재발/급증) on/off(비활성 시 disabled) + 채널(이메일·Slack webhook). 저장 시 빈 채널은 null로 전송, "저장됨" 피드백 (`pages/AlertSettingsPage.tsx`) — 2026-06-15 sunmin
- [x] **검증 에러 표시** — 백엔드 400을 메시지로 변환(Slack은 hooks.slack.com 안내, 이메일 형식 안내) — 2026-06-15 sunmin
- 검증(브라우저 e2e): 기본값 로드(활성/새이슈·재발 on/급증 off) → 잘못된 Slack URL(evil.example.com) 저장→SSRF 검증 에러 → 유효 저장(hooks.slack.com+이메일+급증 토글) → 새로고침 후 영속 확인. 워크스페이스 테스트 189개
- ✅ **Phase 5 알림 완성** — 2026-06-15

## 6. 소스맵 도구 (todo STEP 6) — M6 마일스톤 ✅

- [x] **업로드 CLI** — `packages/cli`: `errtrack-upload` bin(--dsn/--secret/--release/--dist 또는 ERRTRACK_* env). dist에서 .map 재귀 수집(`collect.ts`), basename으로 아티팩트명 도출, secret_key 헤더로 업로드(`upload.ts`) — 2026-06-15 sunmin
- [x] **vite 플러그인** — `errtrackSourcemaps({dsn,secretKey,release,dist})` closeBundle에서 자동 업로드. vite 직접 의존 없이 구조적 Plugin 타입 (`vite-plugin.ts`) — 2026-06-15 sunmin
- [x] **스택 뷰어 소스 컨텍스트** — in_app 프레임에 복원된 pre/context/post 5줄을 라인번호와 함께 표시, 에러 줄 빨강 강조 (`SourceContext`, `IssueDetailPage`) — 2026-06-15 sunmin
- [x] **테스트** — CLI 단위 6개(artifactName/uploadUrl/uploadSourceMaps 토큰·실패) → 워크스페이스 총 202개 — 2026-06-15 sunmin
- 검증(e2e): 픽스처 dist(.map) → CLI 업로드(잘못된 secret 401·유효 201) → 해당 release로 minify 이벤트 → 대시보드 이슈 상세에서 `widget.js:3:1` 복원 + 소스 컨텍스트 5줄(에러 줄 강조) 렌더 확인
- ✅ **M6 마일스톤 달성** — minify 에러 → 원본 코드 위치/소스 — 2026-06-15

## 7. 마무리 (todo STEP 7)

- [ ] SDK 번들 크기·초기화 시간 측정(KPI), SDK 사용 문서, 대시보드 Docker 이미지화

---

## 비고

- **SDK와 대시보드가 한 트랙**: 담당을 나누게 되면 §2·§4(SDK 부분)·§6을 SDK 트랙으로 분리
- 페이로드 계약은 `@errortracking/shared`가 단일 소스 — SDK가 보내는 형태와 대시보드가 그리는 형태가 같은 타입
