import { describe, expect, it } from "vitest";
import { Scope } from "./scope";

describe("Scope", () => {
  it("빈 scope의 snapshot은 빈 객체", () => {
    expect(new Scope().snapshot()).toEqual({});
  });

  it("user/tags/extra를 누적해 snapshot에 담는다", () => {
    const s = new Scope();
    s.setUser({ id: "u1", email: "a@b.c" });
    s.setTag("page", "checkout");
    s.setExtra("cartSize", 3);
    expect(s.snapshot()).toEqual({
      user: { id: "u1", email: "a@b.c" },
      tags: { page: "checkout" },
      extra: { cartSize: 3 },
    });
  });

  it("setUser(null)로 user를 해제한다", () => {
    const s = new Scope();
    s.setUser({ id: "u1" });
    s.setUser(null);
    expect(s.snapshot().user).toBeUndefined();
  });

  it("같은 키 setTag는 덮어쓴다", () => {
    const s = new Scope();
    s.setTag("k", "v1");
    s.setTag("k", "v2");
    expect(s.snapshot().tags).toEqual({ k: "v2" });
  });

  it("snapshot은 내부 상태의 복사본 (외부 변경 격리)", () => {
    const s = new Scope();
    s.setTag("k", "v");
    const snap = s.snapshot();
    snap.tags!["k"] = "mutated";
    expect(s.snapshot().tags).toEqual({ k: "v" });
  });

  it("clear는 전부 비운다", () => {
    const s = new Scope();
    s.setUser({ id: "u1" });
    s.setTag("k", "v");
    s.clear();
    expect(s.snapshot()).toEqual({});
  });
});
