# @errortracking/sdk

브라우저(웹)용 JavaScript 에러 추적 SDK — `window.onerror`/`unhandledrejection` 자동 캡처, Breadcrumbs, 컨텍스트, 소스맵 연동.

## 빌드 (배포용 번들)

```sh
pnpm --filter @errortracking/sdk build
# dist/errtrack.es.js   — 번들러(import)용 ES 모듈
# dist/errtrack.iife.js — <script> 태그용 (전역 errtrack), gzip ~4KB
```

## 사용

**A. 번들러 앱(Vite/webpack/Next 등)** — `errtrack.es.js`를 프로젝트에 두고:

```js
import { init, captureException } from "./errtrack.es.js";
init({
  dsn: "https://{public_key}@errors.example.com/1",
  release: "myapp@1.0.0",
  environment: "production",
});
```

**B. 일반 웹페이지** — `<script>` 태그 (전역 `errtrack`):

```html
<script src="/errtrack.iife.js"></script>
<script>
  errtrack.init({
    dsn: "https://{public_key}@errors.example.com/1",
    release: "myapp@1.0.0",
    environment: "production",
  });
</script>
```

init 이후 런타임 에러·Promise 거부가 자동 전송됩니다.

## API

- `init(options)` — `{ dsn, release?, environment?, sampleRate?, beforeSend? }`
- `captureException(err, level?)` / `captureMessage(msg, level?)` — 수동 캡처
- `setUser({ id, email })` / `setTag(key, value)` / `setExtra(key, value)` — 이후 이벤트에 자동 첨부
- `addBreadcrumb({ ... })` — 수동 행적 추가

## 데모

```sh
pnpm --filter @errortracking/sdk demo   # ?dsn= 쿼리로 DSN 주입
```
