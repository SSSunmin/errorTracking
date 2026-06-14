import { MAX_BREADCRUMBS, type Breadcrumb } from "@errortracking/shared";

/** 최근 N개만 유지하는 링 버퍼 (오래된 것부터 밀려남) */
export class BreadcrumbBuffer {
  private items: Breadcrumb[] = [];

  constructor(private readonly max: number = MAX_BREADCRUMBS) {}

  add(crumb: Breadcrumb): void {
    this.items.push(crumb);
    if (this.items.length > this.max) {
      this.items.splice(0, this.items.length - this.max);
    }
  }

  getAll(): Breadcrumb[] {
    return [...this.items];
  }

  clear(): void {
    this.items = [];
  }
}

/** epoch seconds (Breadcrumb.timestamp 규약) */
function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/** DOM 요소 → 간결한 CSS 셀렉터 (tag#id.class[0]) */
export function elementSelector(el: Element | null): string {
  if (!el || !el.tagName) return "<unknown>";
  let sel = el.tagName.toLowerCase();
  if (el.id) sel += `#${el.id}`;
  else if (typeof el.className === "string" && el.className.trim()) {
    const first = el.className.trim().split(/\s+/)[0];
    if (first) sel += `.${first}`;
  }
  return sel;
}

export function domBreadcrumb(selector: string): Breadcrumb {
  return {
    timestamp: nowSec(),
    type: "default",
    category: "ui.click",
    message: selector,
  };
}

export function navigationBreadcrumb(from: string, to: string): Breadcrumb {
  return {
    timestamp: nowSec(),
    type: "navigation",
    category: "navigation",
    data: { from, to },
  };
}

export function httpBreadcrumb(
  method: string,
  url: string,
  status?: number,
): Breadcrumb {
  return {
    timestamp: nowSec(),
    type: status && status >= 400 ? "error" : "default",
    category: "http",
    data: { method: method.toUpperCase(), url, status_code: status },
  };
}

export function consoleBreadcrumb(level: string, message: string): Breadcrumb {
  return {
    timestamp: nowSec(),
    type: level === "error" || level === "warn" ? level : "default",
    category: "console",
    level: level === "warn" ? "warning" : (level as Breadcrumb["level"]),
    message,
  };
}
