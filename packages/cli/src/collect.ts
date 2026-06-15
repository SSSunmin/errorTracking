import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { artifactName, type SourceMapFile } from "./upload";

/** dist 디렉터리에서 *.map 파일을 재귀 수집 → 아티팩트 목록 */
export function collectSourceMaps(dir: string): SourceMapFile[] {
  const out: SourceMapFile[] = [];
  walk(dir, out);
  return out;
}

function walk(dir: string, out: SourceMapFile[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith(".map")) {
      out.push({
        name: artifactName(entry),
        content: readFileSync(full, "utf8"),
      });
    }
  }
}
