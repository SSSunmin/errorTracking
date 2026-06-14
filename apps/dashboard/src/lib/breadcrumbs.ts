import type { Breadcrumb } from "@errortracking/shared";

/** breadcrumb 카테고리 → 짧은 라벨 + 색상 토큰 */
export function crumbStyle(crumb: Breadcrumb): { label: string; color: string } {
  const category = crumb.category ?? "default";
  if (category === "ui.click") return { label: "CLICK", color: "var(--level-info)" };
  if (category === "navigation") return { label: "NAV", color: "var(--level-info)" };
  if (category === "http") {
    const status = Number(crumb.data?.["status_code"]);
    const failed = status >= 400;
    return { label: "HTTP", color: failed ? "var(--level-error)" : "var(--text-dim)" };
  }
  if (category === "console") {
    if (crumb.level === "warning") return { label: "WARN", color: "var(--level-warning)" };
    if (crumb.level === "error") return { label: "ERROR", color: "var(--level-error)" };
    return { label: "LOG", color: "var(--text-dim)" };
  }
  return { label: category.toUpperCase(), color: "var(--text-dim)" };
}

/** breadcrumb 본문 텍스트 — message 우선, 없으면 data 요약 */
export function crumbText(crumb: Breadcrumb): string {
  if (crumb.message) return crumb.message;
  if (crumb.category === "http" && crumb.data) {
    const { method, url, status_code } = crumb.data as {
      method?: string;
      url?: string;
      status_code?: number;
    };
    return `${method ?? "GET"} ${url ?? ""}${status_code ? ` → ${status_code}` : ""}`;
  }
  if (crumb.category === "navigation" && crumb.data) {
    const { from, to } = crumb.data as { from?: string; to?: string };
    return `${from ?? "?"} → ${to ?? "?"}`;
  }
  return "";
}

/** epoch seconds → HH:MM:SS */
export function crumbTime(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
