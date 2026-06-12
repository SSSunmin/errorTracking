import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("해시 후 올바른 비밀번호를 검증한다", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", stored)).toBe(
      true,
    );
  });

  it("틀린 비밀번호는 거부한다", async () => {
    const stored = await hashPassword("password1");
    expect(await verifyPassword("password2", stored)).toBe(false);
  });

  it("같은 비밀번호도 매번 다른 해시(salt)를 생성한다", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
  });

  it("저장 형식은 salt:hash hex", async () => {
    const stored = await hashPassword("pw");
    expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });

  it("손상된 저장값은 false를 반환한다 (throw 없음)", async () => {
    expect(await verifyPassword("pw", "garbage")).toBe(false);
    expect(await verifyPassword("pw", "")).toBe(false);
    expect(await verifyPassword("pw", ":")).toBe(false);
  });
});
