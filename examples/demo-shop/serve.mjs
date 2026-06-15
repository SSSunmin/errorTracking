import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, normalize } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 5200);

// SDK 번들은 빌드 산출물에서 직접 서빙 (예제에 사본을 두지 않고 단일 소스 유지).
// 먼저 빌드 필요: pnpm --filter @errortracking/sdk build
const SDK_BUNDLE = join(ROOT, "..", "..", "packages", "sdk", "dist", "errtrack.iife.js");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

createServer(async (req, res) => {
  let path = decodeURIComponent((req.url ?? "/").split("?")[0]);
  if (path === "/") path = "/index.html";

  // SDK 번들 요청은 dist에서 읽어 응답
  if (path === "/errtrack.iife.js") {
    try {
      res.writeHead(200, { "Content-Type": TYPES[".js"] });
      res.end(await readFile(SDK_BUNDLE));
    } catch {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("SDK 번들이 없습니다. 먼저 빌드하세요:\n  pnpm --filter @errortracking/sdk build");
    }
    return;
  }

  // 경로 탈출 방지 — ROOT 밖 접근 차단
  const filePath = normalize(join(ROOT, path));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  try {
    res.writeHead(200, {
      "Content-Type": TYPES[extname(filePath)] ?? "application/octet-stream",
    });
    res.end(await readFile(filePath));
  } catch {
    // /api/checkout 등 없는 경로는 404 (데모의 의도된 결제 실패 시나리오)
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end('{"error":"not found"}');
  }
}).listen(PORT, "127.0.0.1", () =>
  console.log(`demo-shop on http://127.0.0.1:${PORT}`),
);
