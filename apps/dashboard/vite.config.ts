import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * 프로덕션 빌드 산출 HTML에 CSP meta 태그 주입 (XSS 1차 방어).
 * dev에는 적용하지 않는다 — vite HMR이 인라인 스크립트/eval/ws를 쓰기 때문.
 * 참고: frame-ancestors/X-Frame-Options 등 헤더 전용 지시어는 리버스 프록시(인프라 §2)에서 설정.
 */
function cspMeta(): Plugin {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return {
    name: "csp-meta",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        "</head>",
        `  <meta http-equiv="Content-Security-Policy" content="${csp}" />\n  </head>`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), cspMeta()],
  server: {
    port: Number(process.env.PORT ?? 5173),
    // API를 same-origin으로 프록시 — 세션 쿠키가 cross-origin 없이 동작
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: false,
      },
    },
  },
});
