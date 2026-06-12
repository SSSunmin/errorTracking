# @errortracking/dashboard

웹 UI — 로그인, 프로젝트 관리(DSN), 이슈 목록.

```sh
pnpm --filter @errortracking/api dev    # API (포트 4000) 먼저
pnpm --filter @errortracking/dashboard dev   # 대시보드 (포트 5173)
```

- `/api`는 vite dev 프록시로 API에 same-origin 연결 (세션 쿠키 동작)
- 로그인 계정은 `pnpm --filter @errortracking/api seed` 출력 참고
- 디자인: IBM Plex Sans KR + IBM Plex Mono, 다크 터미널 콘솔 테마 (`src/styles.css`)
