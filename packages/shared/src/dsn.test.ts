import { describe, expect, it } from "vitest";
import { buildDsn, parseDsn, storeEndpoint } from "./dsn";

describe("parseDsn", () => {
  it("https DSN을 파싱한다", () => {
    expect(parseDsn("https://abc123@errors.example.com/42")).toEqual({
      protocol: "https",
      publicKey: "abc123",
      host: "errors.example.com",
      projectId: "42",
    });
  });

  it("포트가 포함된 http DSN을 파싱한다", () => {
    expect(parseDsn("http://key@localhost:4000/1")).toEqual({
      protocol: "http",
      publicKey: "key",
      host: "localhost:4000",
      projectId: "1",
    });
  });

  it("앞뒤 공백을 허용한다", () => {
    expect(parseDsn("  http://k@h/1  ").publicKey).toBe("k");
  });

  it.each([
    "ftp://key@host/1",
    "http://host/1",
    "http://key@host/abc",
    "http://key@host",
    "not-a-dsn",
    "",
  ])("잘못된 DSN은 throw한다: %s", (dsn) => {
    expect(() => parseDsn(dsn)).toThrow("Invalid DSN");
  });
});

describe("buildDsn / storeEndpoint", () => {
  const components = {
    protocol: "https" as const,
    publicKey: "pk",
    host: "errors.example.com",
    projectId: "7",
  };

  it("buildDsn은 parseDsn과 왕복 가능하다", () => {
    expect(parseDsn(buildDsn(components))).toEqual(components);
  });

  it("storeEndpoint는 수집 URL을 만든다 (public_key 미포함)", () => {
    expect(storeEndpoint(components)).toBe(
      "https://errors.example.com/api/7/store/",
    );
  });
});
