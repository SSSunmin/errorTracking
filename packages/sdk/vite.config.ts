import { resolve } from "node:path";
import { defineConfig } from "vite";

// 브라우저 배포용 라이브러리 빌드 — shared까지 포함해 단일 파일로 번들.
// 산출물: dist/errtrack.es.js(번들러 import), dist/errtrack.iife.js(<script> 태그, 전역 `errtrack`)
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "errtrack",
      formats: ["es", "iife"],
      fileName: (format) => `errtrack.${format}.js`,
    },
    // 의존성(@errortracking/shared)도 전부 번들 — 브라우저에 그대로 올릴 수 있도록
    rollupOptions: { external: [] },
    sourcemap: true,
    emptyOutDir: true,
  },
});
