# 내 웹 프로젝트에 errtrack 붙이기

브라우저(웹)용 에러 추적을 실제 프로젝트에 적용하는 방법. 서버 배포는 [DEPLOY.md](DEPLOY.md), 동작 예시는 [examples/demo-shop](../examples/demo-shop/) 참고.

전체 흐름: **① 서버 배포 → ② 프로젝트 생성(DSN) → ③ SDK 연동 → ④ (선택) 소스맵 → ⑤ (선택) 알림**.

---

## ① 추적 서버 배포 (한 번만)

외부에서 접근 가능한 서버에 올린다. 상세는 [DEPLOY.md](DEPLOY.md).

```sh
cp infra/.env.prod.example infra/.env       # 비밀번호·SESSION_SECRET 변경 필수
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
docker compose -f infra/docker-compose.yml exec api pnpm seed   # admin + 예시 프로젝트
```

> **HTTPS 필수**: DSN과 세션 쿠키가 https 전제다. 앞단에 TLS 프록시(Caddy/Traefik/nginx 등)를 둔다.

## ② 프로젝트 생성 → DSN 발급

대시보드(`https://errors.example.com`) 로그인 → **프로젝트 생성**. DSN이 나온다:

```
https://{public_key}@errors.example.com/{projectId}
```

`public_key`는 공개되어도 되는 값(브라우저에 노출됨). 소스맵 업로드용 `secret_key`는 프로젝트 단건 화면 / `seed` 출력에서 확인하며 **비공개**로 관리한다.

## ③ SDK 연동

먼저 배포용 번들을 빌드한다(한 번):

```sh
pnpm --filter @errortracking/sdk build
# dist/errtrack.es.js   — 번들러(import)용
# dist/errtrack.iife.js — <script> 태그용 (전역 errtrack), gzip ~4KB
```

### A. 일반 웹페이지 (`<script>`)

`errtrack.iife.js`를 호스팅하고, **다른 스크립트보다 먼저** 로드·init:

```html
<script src="/errtrack.iife.js"></script>
<script>
  errtrack.init({
    dsn: "https://{public_key}@errors.example.com/1",
    release: "mysite@1.0.0",       // 배포 버전 (소스맵 매칭 키)
    environment: "production",
  });
</script>
```

### B. 번들러 앱 (Vite / React / Next 등)

`errtrack.es.js`를 프로젝트에 두고 앱 진입점 최상단에서 init:

```js
import { init, captureException, setUser } from "./errtrack.es.js";

init({
  dsn: "https://{public_key}@errors.example.com/1",
  release: "myapp@1.0.0",
  environment: import.meta.env.MODE,
});
```

### init 이후 — 자동 + 수동

- **자동**: `window.onerror`(런타임 에러), `unhandledrejection`(Promise 거부), 그리고 클릭·라우팅·fetch/XHR·console이 Breadcrumbs로 기록됨.
- **수동 캡처**: `captureException(err)`, `captureMessage("결제 실패", "warning")`
- **컨텍스트**: `setUser({ id, email })`, `setTag("plan", "pro")`, `setExtra("cartSize", 3)` — 이후 모든 이벤트에 자동 첨부.
- **옵션**: `init({ ..., sampleRate: 0.5, beforeSend: (ev) => ev /* null 반환 시 전송 취소 */ })`

> 민감정보(비밀번호·토큰·카드번호)는 SDK(전송 전) + 서버 양쪽에서 자동 마스킹된다. 추가로 가릴 값은 `beforeSend`에서 제거.

## ④ (선택) 소스맵 — minify된 에러를 원본 코드로

빌드 파이프라인에서 `.map`을 업로드한다. `secret_key`와 `release`(init과 동일!)가 필요.

### Vite 플러그인

```js
// vite.config.js
import { errtrackSourcemaps } from "@errortracking/cli";

export default {
  build: { sourcemap: true },
  plugins: [
    errtrackSourcemaps({
      dsn: "https://{public_key}@errors.example.com/1",
      secretKey: process.env.ERRTRACK_SECRET,   // 비공개
      release: "myapp@1.0.0",
    }),
  ],
};
```

### CLI (CI 등)

```sh
errtrack-upload \
  --dsn "https://{public_key}@errors.example.com/1" \
  --secret "$ERRTRACK_SECRET" \
  --release "myapp@1.0.0" \
  --dist dist
```

업로드 후 같은 release의 에러는 상세 화면에서 원본 파일·라인 + 주변 소스 5줄로 표시된다.

## ⑤ (선택) 알림

대시보드 → 프로젝트 → **알림 설정**:

- 트리거: 새 이슈 / 재발 / 급증
- 채널: **Slack** webhook(`https://hooks.slack.com/...`만 허용) 또는 **이메일**(서버 `.env`에 `SMTP_*` 설정 시)
- 동일 이슈 알림은 1시간 1회로 디바운스됨.

---

## 빠른 체크리스트

- [ ] 서버 배포 + HTTPS
- [ ] 프로젝트 생성 → DSN 확보
- [ ] `pnpm --filter @errortracking/sdk build` → 번들을 앱에 포함
- [ ] 앱 진입점에서 `errtrack.init({ dsn, release, environment })`
- [ ] (선택) 빌드에 소스맵 업로드 추가 (release 일치)
- [ ] (선택) 알림 채널 설정

동작하는 전체 예시는 [examples/demo-shop](../examples/demo-shop/)에서 바로 실행해볼 수 있다.
