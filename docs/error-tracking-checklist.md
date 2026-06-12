# 오류 추적 시스템 개발 체크리스트

> 규모 전제: 프로젝트 ~10개, 낮은 트래픽 → 단일 서버 + PostgreSQL 구성
> 추적 데이터 수준: Sentry 이벤트 스키마와 동등한 레벨

---

## 0. 사전 설계 결정

- [ ] 지원 플랫폼 범위 확정 (1차: JavaScript / 2차: Python, 기타)
- [ ] 이벤트 보관 기간 정책 (예: 원본 이벤트 90일, 이슈 요약 영구)
- [ ] DSN 발급 규칙 정의 (`https://{public_key}@{host}/{project_id}` 형식)
- [ ] 이벤트 페이로드 스키마 확정 — Sentry Event Payload 포맷 차용
- [ ] 이벤트 1건 최대 크기 제한 (예: 200KB~1MB)

---

## 1. 데이터 모델 (DB 스키마)

### 핵심 테이블
- [ ] `projects` — 이름, 플랫폼, public_key(DSN), 생성일
- [ ] `issues` — fingerprint, 제목(culprit), 상태(unresolved/resolved/ignored),
      level, first_seen, last_seen, times_seen, 영향 유저 수
- [ ] `events` — event_id(UUID), issue_id(FK), 원본 페이로드(JSONB), timestamp, release, environment
- [ ] `releases` — 버전 문자열, 프로젝트별, 배포 시각
- [ ] `sourcemaps` / `artifacts` — 릴리즈별 업로드된 소스맵 파일
- [ ] `users_affected` — 이슈별 영향받은 유저 식별자 (distinct 집계용)
- [ ] `comments` / `activity` — 이슈에 대한 메모, 상태 변경 이력 (선택)

### 인덱스 / 제약
- [ ] `issues(project_id, fingerprint)` UNIQUE
- [ ] `events(issue_id, timestamp)` 인덱스
- [ ] `events(project_id, timestamp)` 인덱스 (보관 기간 삭제용)
- [ ] JSONB GIN 인덱스 — 태그 검색용 (선택)

---

## 2. SDK — 이벤트 캡처 (Sentry 동등 레벨)

### 2-1. 에러 자동 캡처
- [ ] `window.onerror` 후킹 (런타임 에러)
- [ ] `window.onunhandledrejection` 후킹 (Promise 거부)
- [ ] `console.error` 후킹 (선택)
- [ ] 수동 캡처 API — `captureException(err)`, `captureMessage(msg, level)`
- [ ] try/catch 래핑 헬퍼 — 이벤트 핸들러/타이머 콜백 자동 래핑 (선택)

### 2-2. Exception 데이터 (이벤트 본문)
- [ ] `type` — 예외 타입 (예: `TypeError`)
- [ ] `value` — 예외 메시지
- [ ] `stacktrace.frames[]` — 프레임 배열, 각 프레임에:
  - [ ] `filename` (파일 경로/URL)
  - [ ] `function` (함수명)
  - [ ] `lineno`, `colno`
  - [ ] `in_app` 여부 (내 코드 vs 라이브러리/node_modules 구분)
  - [ ] (서버 SDK) `pre_context` / `context_line` / `post_context` — 주변 소스 5줄
- [ ] `mechanism` — 캡처 경로 (onerror / unhandledrejection / 수동)
- [ ] 체이닝된 예외 지원 — `cause` 따라가며 다중 exception 기록

### 2-3. Breadcrumbs (에러 직전 행적)
- [ ] 링 버퍼 구현 (최근 N개, 기본 100개 유지)
- [ ] 각 breadcrumb: `timestamp`, `type`, `category`, `message`, `level`, `data`
- [ ] 자동 수집 항목:
  - [ ] 클릭/입력 등 DOM 이벤트 (요소 셀렉터 기록)
  - [ ] 페이지 이동 (history pushState/popstate)
  - [ ] `fetch` / `XHR` 요청 (URL, 메서드, 상태코드)
  - [ ] `console.log/warn/error` 호출
- [ ] 수동 추가 API — `addBreadcrumb({...})`

### 2-4. 컨텍스트 (Contexts)
- [ ] `user` — id, username, email, ip_address / `setUser()` API
- [ ] `tags` — 키-값 쌍 (검색/필터용) / `setTag()` API
- [ ] `extra` — 임의 추가 데이터 / `setExtra()` API
- [ ] `browser` — 이름, 버전 (UA 파싱)
- [ ] `os` — 이름, 버전
- [ ] `device` — 기종, 화면 해상도, 메모리 (가능한 범위)
- [ ] `runtime` — (서버 SDK) node/python 버전
- [ ] `request` — URL, 메서드, 헤더, 쿼리스트링 (서버 SDK는 body 일부 포함)
- [ ] `release` — 앱 버전 (빌드 시 주입)
- [ ] `environment` — production / staging / development
- [ ] `sdk` — SDK 이름/버전
- [ ] `level` — fatal / error / warning / info / debug
- [ ] `scope` 개념 — 컨텍스트를 쌓아두면 이후 모든 이벤트에 자동 첨부

### 2-5. 전송 (Transport)
- [ ] DSN 파싱 → 수집 엔드포인트로 POST
- [ ] `event_id` UUID를 클라이언트에서 생성 (중복 제거 기준)
- [ ] 전송 실패 시 재시도 (지수 백오프)
- [ ] 페이지 이탈 시 잔여 이벤트 전송 (`navigator.sendBeacon`)
- [ ] 클라이언트 측 rate limit 준수 (서버가 429 + Retry-After 주면 멈춤)
- [ ] `beforeSend` 훅 — 전송 전 이벤트 수정/필러링 (민감정보 제거용)
- [ ] 민감정보 자동 스크러빙 — 비밀번호/토큰/카드번호 패턴 마스킹
- [ ] `sampleRate` 옵션 — 이벤트 샘플링 (선택)

### 2-6. 빌드 도구
- [ ] 소스맵 업로드 CLI 또는 webpack/vite 플러그인
  (릴리즈 버전과 함께 `.map` 파일을 서버에 업로드)

---

## 3. 수집 API (Ingestion)

- [ ] `POST /api/{project_id}/store/` 엔드포인트
- [ ] DSN public_key 인증 (헤더 `X-Sentry-Auth` 또는 쿼리 파라미터)
- [ ] CORS 설정 (브라우저 SDK는 cross-origin 전송)
- [ ] 페이로드 검증 — 필수 필드, 크기 제한, JSON 파싱 실패 처리
- [ ] `event_id` 기준 중복 수신 제거
- [ ] 프로젝트별 rate limit (예: 분당 300건) → 초과 시 429 + `Retry-After`
- [ ] 즉시 200/202 응답 후 비동기 처리로 넘기기
- [ ] 소스맵 업로드 엔드포인트 — `POST /api/{project_id}/releases/{version}/files/`

---

## 4. 처리 파이프라인 (핵심)

### 4-1. 정규화
- [ ] 페이로드 정규화 — 누락 필드 기본값, 타임스탬프 보정, 크기 초과 필드 트리밍
- [ ] 서버 측 민감정보 스크러빙 (2차 방어)
- [ ] IP 주소 기록 여부 정책 적용

### 4-2. 심볼리케이션 (소스맵 적용)
- [ ] 이벤트의 release + 파일명으로 업로드된 소스맵 조회
- [ ] 압축된 (line, col) → 원본 파일/함수/라인으로 복원
- [ ] 복원된 위치 기준 주변 소스 코드 5줄 추출해 프레임에 첨부
- [ ] 소스맵 없을 때 원본 그대로 처리하는 폴백

### 4-3. 그룹핑 (핑거프린팅)
- [ ] 스택 트레이스 정규화:
  - [ ] `in_app` 프레임만 추출
  - [ ] 파일 경로에서 해시/빌드ID 등 가변 부분 제거
  - [ ] 함수명 정규화 (익명 함수, minify된 이름 처리)
- [ ] 지문 생성 — 정규화된 상위 N개 프레임 + 예외 타입 해싱
- [ ] 스택 없는 이벤트 폴백 — 예외 타입 + 메시지 템플릿화(숫자/ID 치환) 후 해싱
- [ ] SDK가 보낸 커스텀 `fingerprint` 필드 우선 적용
- [ ] 이슈 upsert (트랜잭션):
  - [ ] 동일 지문 존재 → `times_seen` +1, `last_seen` 갱신
  - [ ] 없으면 새 이슈 생성 (제목 = 예외타입: 메시지, culprit = 최상위 in_app 프레임)
- [ ] **재발 감지** — resolved 상태 이슈에 새 이벤트 → unresolved로 전환 + regression 플래그

### 4-4. 집계
- [ ] 이슈별 시간대별 발생 횟수 (시간 단위 버킷 — 그래프용)
- [ ] 이슈별 영향 유저 수 (distinct user.id)
- [ ] 태그별 분포 집계 (browser별, OS별, release별 발생 비율)

---

## 5. 대시보드 (웹 UI)

### 5-1. 기반
- [ ] 로그인/세션 인증
- [ ] 프로젝트 생성/목록/설정, DSN 표시 화면

### 5-2. 이슈 목록
- [ ] 정렬: 최근 발생순 / 발생 빈도순 / 첫 발생순
- [ ] 필터: 상태(unresolved/resolved/ignored), level, environment, release
- [ ] 검색: 메시지/예외타입 텍스트, 태그 검색 (`browser:Chrome` 식)
- [ ] 이슈 행에 미니 추이 그래프(스파크라인) + 발생 수 + 유저 수 표시
- [ ] 일괄 작업 — 여러 이슈 선택 후 해결/무시

### 5-3. 이슈 상세
- [ ] 스택 트레이스 뷰어 — in_app 프레임 강조, 프레임 접기/펼치기, 소스 컨텍스트 표시
- [ ] Breadcrumbs 타임라인 표시
- [ ] 컨텍스트 패널 — user, browser, os, device, request
- [ ] 태그 분포 (browser별 %, release별 % 등)
- [ ] 발생 추이 그래프 (24시간 / 14일)
- [ ] 이벤트 페이지네이션 — 같은 이슈의 개별 이벤트 넘겨보기
- [ ] 상태 변경 버튼 — Resolve / Ignore / Reopen
- [ ] "특정 릴리즈에서 해결됨" 표시 (선택)
- [ ] 원본 JSON 보기

---

## 6. 알림

- [ ] 알림 트리거: ① 새 이슈 ② 재발(regression) ③ 급증 감지
- [ ] 채널: 이메일 발송, Slack incoming webhook
- [ ] 프로젝트별 알림 규칙 설정 UI
- [ ] 디바운싱 — 동일 이슈 알림은 시간당 1회 제한
- [ ] 알림 메시지에 이슈 제목/링크/발생 수/환경 포함

---

## 7. 운영 / 배포

- [ ] 보관 기간 경과 이벤트 삭제 스케줄러 (cron) — **필수, 없으면 DB 무한 증가**
- [ ] 소스맵 아티팩트도 오래된 릴리즈는 정리
- [ ] Docker Compose 구성 (API + Worker + DB + Front)
- [ ] DB 정기 백업
- [ ] 수집 서버 헬스체크 엔드포인트
- [ ] 자기 자신의 에러 로깅 (무한 루프 안 되게 주의)

---

## 권장 개발 순서

1. **1 → 3 → 4-3(기본 핑거프린팅) → 5-2** : 에러가 들어와서 이슈로 묶여 목록에 보이는 최소 루프
2. **2-1 ~ 2-2** : JS SDK 기본 (에러 캡처 + 스택 트레이스)
3. **5-3** : 이슈 상세 화면
4. **2-3 ~ 2-4** : Breadcrumbs + 컨텍스트 (Sentry급 데이터의 핵심)
5. **6** : 알림
6. **2-6 + 4-2** : 소스맵 업로드 + 심볼리케이션 (난이도 높음, 마지막에)
7. **7** : 운영 정리

---

## 이 규모에서 만들지 않는 것

- Kafka 등 메시지 큐 분리 (DB 트랜잭션 + 백그라운드 작업으로 충분)
- ClickHouse 등 전용 이벤트 저장소 (PostgreSQL JSONB로 충분)
- 다중 워커 수평 확장
- Sentry의 Performance/Tracing, Session Replay, Profiling (오류 추적과 별개 제품 영역)
