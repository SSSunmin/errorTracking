import { collectSourceMaps } from "./collect";
import { uploadSourceMaps } from "./upload";

export interface ErrtrackPluginOptions {
  dsn: string;
  secretKey: string;
  release: string;
  /** 빌드 산출 디렉터리 (기본 dist) */
  dist?: string;
}

/** vite의 Plugin과 구조적으로 호환되는 최소 타입 (vite 직접 의존 회피) */
interface MinimalVitePlugin {
  name: string;
  apply: "build";
  closeBundle: () => Promise<void>;
}

/**
 * vite 빌드 후 소스맵 자동 업로드 플러그인.
 * vite.config.ts: plugins: [errtrackSourcemaps({ dsn, secretKey, release })]
 * 빌드 시 `build.sourcemap: true` 필요.
 */
export function errtrackSourcemaps(
  opts: ErrtrackPluginOptions,
): MinimalVitePlugin {
  return {
    name: "errtrack-sourcemaps",
    apply: "build",
    async closeBundle() {
      const files = collectSourceMaps(opts.dist ?? "dist");
      if (files.length === 0) {
        console.warn("[errtrack] 업로드할 소스맵 없음");
        return;
      }
      const results = await uploadSourceMaps({
        dsn: opts.dsn,
        secretKey: opts.secretKey,
        release: opts.release,
        files,
      });
      const ok = results.filter((r) => r.ok).length;
      console.log(
        `[errtrack] 소스맵 업로드 ${ok}/${results.length} (release ${opts.release})`,
      );
    },
  };
}
