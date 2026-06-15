# 데모: VOLT 전자상가 (errtrack 연동 예제)

의도적으로 다양한 에러를 심은 가짜 쇼핑몰 — `<script>` 한 줄로 SDK를 붙여 에러가 대시보드로 수집되는 것을 보여주는 살아있는 레퍼런스.

## 무엇을 보여주나

`index.html`의 버튼/동작이 5종 에러를 일으키고, 모두 자동 수집됩니다:

| 동작 | 심은 버그 | 잡히는 에러 |
|---|---|---|
| 페이지 로드 | 애널리틱스 객체 undefined | `TypeError` (onerror 자동 캡처) |
| 품절 상품 "담기" | 정의 안 된 함수 호출 | `ReferenceError` |
| "쿠폰 적용" | 잘못된 `JSON.parse` | `SyntaxError` |
| "리뷰 불러오기" | `cause`로 감싼 래퍼 에러 | `Error` (원인 체인 2단) |
| "결제하기" | `fetch` 404 후 null 접근 | `TypeError` |

수집되는 데이터: 스택 트레이스, **Breadcrumbs**(클릭·console·fetch 404), 컨텍스트(user/browser/os/release), 태그 분포, 발생 추이.

## 실행

```sh
# 1) SDK 번들 빌드 (serve.mjs가 dist에서 직접 서빙)
pnpm --filter @errortracking/sdk build

# 2) 추적 서버 기동 (db + api) + 데모 프로젝트
pnpm db:up
pnpm --filter @errortracking/api dev          # 다른 터미널
pnpm --filter @errortracking/api seed          # admin 계정 + 프로젝트

# 3) 데모 쇼핑몰 서빙
node examples/demo-shop/serve.mjs              # http://127.0.0.1:5200
```

> `index.html`의 DSN은 데모용(로컬 project 4)입니다. 본인 환경에선 대시보드에서 프로젝트를 만들어 발급된 DSN으로 교체하세요.

## 연동 핵심 (실제 웹사이트도 동일)

```html
<script src="/errtrack.iife.js"></script>
<script>
  errtrack.init({
    dsn: "http://{public_key}@{host}/{projectId}",
    release: "volt-shop@1.4.2",
    environment: "production",
  });
  errtrack.setUser({ id: "u-8842" });   // 선택
</script>
```

이후 별도 처리 없이 런타임 에러·Promise 거부가 자동 전송됩니다.
일반적인 웹 프로젝트 연동 방법은 [docs/USAGE.md](../../docs/USAGE.md) 참고.
