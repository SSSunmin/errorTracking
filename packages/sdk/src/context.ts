import type { BrowserContext, OsContext } from "@errortracking/shared";

/** UA 문자열에서 브라우저 이름/버전 추출 (주요 브라우저만, 정밀 파싱은 비범위) */
export function browserFromUa(ua: string): BrowserContext | undefined {
  let m = /Edg(?:e|A|iOS)?\/([\d.]+)/.exec(ua);
  if (m) return { name: "Edge", version: m[1] };
  m = /Firefox\/([\d.]+)/.exec(ua);
  if (m) return { name: "Firefox", version: m[1] };
  m = /Chrome\/([\d.]+)/.exec(ua);
  if (m) return { name: "Chrome", version: m[1] };
  m = /Version\/([\d.]+).*Safari\//.exec(ua);
  if (m) return { name: "Safari", version: m[1] };
  return undefined;
}

const WINDOWS_VERSIONS: Record<string, string> = {
  "10.0": "10",
  "6.3": "8.1",
  "6.2": "8",
  "6.1": "7",
};

/** UA 문자열에서 OS 이름/버전 추출 */
export function osFromUa(ua: string): OsContext | undefined {
  let m = /Windows NT ([\d.]+)/.exec(ua);
  if (m) return { name: "Windows", version: WINDOWS_VERSIONS[m[1]!] ?? m[1] };
  m = /iPhone OS ([\d_]+)/.exec(ua);
  if (m) return { name: "iOS", version: m[1]!.replace(/_/g, ".") };
  m = /Mac OS X ([\d_.]+)/.exec(ua);
  if (m) return { name: "macOS", version: m[1]!.replace(/_/g, ".") };
  m = /Android ([\d.]+)/.exec(ua);
  if (m) return { name: "Android", version: m[1] };
  if (/Linux/.test(ua)) return { name: "Linux" };
  return undefined;
}
