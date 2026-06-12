import type {
  IssueListResponse,
  IssueSort,
  Project,
  User,
} from "./types";
import type { IssueStatus } from "@errortracking/shared";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // JSON이 아닌 에러 응답은 statusText 유지
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<User>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  me: () => request<User>("/api/auth/me"),

  listProjects: () => request<Project[]>("/api/projects"),
  getProject: (id: number | string) => request<Project>(`/api/projects/${id}`),
  createProject: (name: string, platform = "javascript") =>
    request<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, platform }),
    }),

  listIssues: (
    projectId: number | string,
    opts: {
      status?: IssueStatus;
      sort?: IssueSort;
      page?: number;
      limit?: number;
    } = {},
  ) => {
    const params = new URLSearchParams();
    if (opts.status) params.set("status", opts.status);
    if (opts.sort) params.set("sort", opts.sort);
    if (opts.page) params.set("page", String(opts.page));
    if (opts.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return request<IssueListResponse>(
      `/api/projects/${projectId}/issues${qs ? `?${qs}` : ""}`,
    );
  },
};
