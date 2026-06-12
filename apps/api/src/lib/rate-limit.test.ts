import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimits } from "./rate-limit";

const T0 = 1_000_000_000_000;

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("limit까지 허용하고 그 다음부터 차단한다", () => {
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit("k", { now: T0 + i, limit: 3 }).allowed).toBe(true);
    }
    expect(checkRateLimit("k", { now: T0 + 3, limit: 3 }).allowed).toBe(false);
  });

  it("차단 시 윈도우 잔여 시간을 Retry-After로 준다", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("k", { now: T0, limit: 3 });
    const r = checkRateLimit("k", { now: T0 + 30_000, limit: 3 });
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSec).toBe(30);
  });

  it("윈도우(60초)가 지나면 카운터가 초기화된다", () => {
    for (let i = 0; i < 4; i++) checkRateLimit("k", { now: T0, limit: 3 });
    expect(checkRateLimit("k", { now: T0 + 60_000, limit: 3 }).allowed).toBe(
      true,
    );
  });

  it("키별로 독립 카운트한다", () => {
    for (let i = 0; i < 4; i++) checkRateLimit("project:1", { now: T0, limit: 3 });
    expect(
      checkRateLimit("project:2", { now: T0, limit: 3 }).allowed,
    ).toBe(true);
    expect(checkRateLimit("login:1.2.3.4", { now: T0, limit: 3 }).allowed).toBe(
      true,
    );
  });
});
