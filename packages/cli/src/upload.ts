import { parseDsn } from "@errortracking/shared";

export interface SourceMapFile {
  /** 스택 프레임 filename의 basename과 매칭될 이름 (예: bundle.min.js) */
  name: string;
  /** 소스맵(.map) JSON 텍스트 */
  content: string;
}

export interface UploadOptions {
  /** DSN 전체 (host/projectId 추출) */
  dsn: string;
  /** 프로젝트 secret_key (업로드 인증) */
  secretKey: string;
  /** 릴리즈 버전 */
  release: string;
  files: SourceMapFile[];
  fetchImpl?: typeof fetch;
}

export interface UploadResult {
  name: string;
  ok: boolean;
  status: number;
}

/** .map 파일명 → 아티팩트 이름 (끝의 .map 제거) */
export function artifactName(mapFilename: string): string {
  return mapFilename.replace(/\.map$/, "");
}

/** 릴리즈 파일 업로드 엔드포인트 URL */
export function uploadUrl(dsn: string, release: string): string {
  const c = parseDsn(dsn);
  return `${c.protocol}://${c.host}/api/${c.projectId}/releases/${encodeURIComponent(
    release,
  )}/files/`;
}

/** 소스맵들을 업로드 — 파일별 결과 배열 반환 */
export async function uploadSourceMaps(
  opts: UploadOptions,
): Promise<UploadResult[]> {
  const doFetch = opts.fetchImpl ?? globalThis.fetch;
  const url = uploadUrl(opts.dsn, opts.release);
  const results: UploadResult[] = [];
  for (const file of opts.files) {
    try {
      const res = await doFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Upload-Token": opts.secretKey,
        },
        body: JSON.stringify({ name: file.name, content: file.content }),
      });
      results.push({ name: file.name, ok: res.ok, status: res.status });
    } catch {
      results.push({ name: file.name, ok: false, status: 0 });
    }
  }
  return results;
}
