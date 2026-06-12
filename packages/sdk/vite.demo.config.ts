import { defineConfig } from "vite";

// SDK 수동 테스트용 데모 페이지 서버 (pnpm --filter @errortracking/sdk demo)
export default defineConfig({
  root: "demo",
  server: {
    port: Number(process.env.PORT ?? 5180),
  },
});
