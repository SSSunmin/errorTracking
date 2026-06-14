import type { Breadcrumb } from "@errortracking/shared";
import {
  consoleBreadcrumb,
  domBreadcrumb,
  elementSelector,
  httpBreadcrumb,
  navigationBreadcrumb,
} from "./breadcrumbs";

type AddCrumb = (crumb: Breadcrumb) => void;

let installed = false;

/**
 * 전역 자동 수집 설치 — DOM 클릭, 라우팅(pushState/popstate), fetch/XHR, console.
 * 각 패치는 try/catch로 감싸 SDK가 앱을 깨지 않도록 한다. 한 번만 설치.
 */
export function installInstrumentation(add: AddCrumb): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  instrumentDomClicks(add);
  instrumentNavigation(add);
  instrumentFetch(add);
  instrumentXhr(add);
  instrumentConsole(add);
}

function instrumentDomClicks(add: AddCrumb): void {
  window.addEventListener(
    "click",
    (event) => {
      try {
        const target = event.target as Element | null;
        add(domBreadcrumb(elementSelector(target)));
      } catch {
        /* 무시 */
      }
    },
    { capture: true },
  );
}

function instrumentNavigation(add: AddCrumb): void {
  const record = (to: string) => {
    try {
      add(navigationBreadcrumb(location.href, to));
    } catch {
      /* 무시 */
    }
  };
  const origPush = history.pushState;
  history.pushState = function (this: History, ...args) {
    const url = args[2];
    if (url != null) record(String(url));
    return origPush.apply(this, args);
  };
  window.addEventListener("popstate", () => record(location.href));
}

function instrumentFetch(add: AddCrumb): void {
  if (typeof fetch !== "function") return;
  const orig = fetch;
  window.fetch = function (
    this: typeof globalThis,
    input: RequestInfo | URL,
    init?: RequestInit,
  ) {
    const method = init?.method ?? "GET";
    const url = typeof input === "string" ? input : input.toString();
    return orig.apply(this, [input, init]).then(
      (res) => {
        try {
          add(httpBreadcrumb(method, url, res.status));
        } catch {
          /* 무시 */
        }
        return res;
      },
      (err: unknown) => {
        try {
          add(httpBreadcrumb(method, url));
        } catch {
          /* 무시 */
        }
        throw err;
      },
    );
  } as typeof fetch;
}

interface TrackedXhr extends XMLHttpRequest {
  __et?: { method: string; url: string };
}

function instrumentXhr(add: AddCrumb): void {
  if (typeof XMLHttpRequest === "undefined") return;
  const proto = XMLHttpRequest.prototype;
  const origOpen = proto.open;
  const origSend = proto.send;

  proto.open = function (this: TrackedXhr, method: string, url: string | URL) {
    this.__et = { method, url: url.toString() };
    // eslint-disable-next-line prefer-rest-params
    return origOpen.apply(this, arguments as unknown as Parameters<typeof origOpen>);
  };

  proto.send = function (this: TrackedXhr, ...args) {
    this.addEventListener("loadend", () => {
      try {
        if (this.__et) {
          add(httpBreadcrumb(this.__et.method, this.__et.url, this.status));
        }
      } catch {
        /* 무시 */
      }
    });
    return origSend.apply(this, args);
  };
}

const CONSOLE_LEVELS = ["log", "info", "warn", "error"] as const;

function instrumentConsole(add: AddCrumb): void {
  if (typeof console === "undefined") return;
  for (const level of CONSOLE_LEVELS) {
    const orig = console[level];
    if (typeof orig !== "function") continue;
    console[level] = function (this: Console, ...args: unknown[]) {
      try {
        add(consoleBreadcrumb(level, args.map(safeStringify).join(" ")));
      } catch {
        /* 무시 */
      }
      return orig.apply(this, args);
    };
  }
}

function safeStringify(v: unknown): string {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
}
