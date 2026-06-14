import type { UserContext } from "@errortracking/shared";

/**
 * Scope — 한 번 설정하면 이후 모든 이벤트에 자동 첨부되는 컨텍스트(user/tags/extra).
 * SDK 싱글턴이 전역 scope 하나를 들고 간다.
 */
export class Scope {
  private user?: UserContext;
  private tags: Record<string, string> = {};
  private extra: Record<string, unknown> = {};

  /** null/undefined를 주면 user 해제 */
  setUser(user: UserContext | null): void {
    this.user = user ?? undefined;
  }

  setTag(key: string, value: string): void {
    this.tags[key] = value;
  }

  setExtra(key: string, value: unknown): void {
    this.extra[key] = value;
  }

  clear(): void {
    this.user = undefined;
    this.tags = {};
    this.extra = {};
  }

  snapshot(): {
    user?: UserContext;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  } {
    return {
      ...(this.user ? { user: { ...this.user } } : {}),
      ...(Object.keys(this.tags).length ? { tags: { ...this.tags } } : {}),
      ...(Object.keys(this.extra).length ? { extra: { ...this.extra } } : {}),
    };
  }
}
