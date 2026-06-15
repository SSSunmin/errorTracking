import { describe, expect, it, vi } from "vitest";
import { artifactName, uploadSourceMaps, uploadUrl } from "./upload";

const DSN = "https://pubkey@errors.example.com/7";

describe("artifactName", () => {
  it(".map 확장자 제거", () => {
    expect(artifactName("bundle.8a1b.js.map")).toBe("bundle.8a1b.js");
    expect(artifactName("app.css.map")).toBe("app.css");
  });

  it(".map 없으면 그대로", () => {
    expect(artifactName("bundle.js")).toBe("bundle.js");
  });
});

describe("uploadUrl", () => {
  it("DSN에서 host/projectId로 업로드 URL 구성", () => {
    expect(uploadUrl(DSN, "1.0.0")).toBe(
      "https://errors.example.com/api/7/releases/1.0.0/files/",
    );
  });

  it("release의 특수문자는 인코딩", () => {
    expect(uploadUrl(DSN, "app@1.0.0")).toBe(
      "https://errors.example.com/api/7/releases/app%401.0.0/files/",
    );
  });
});

describe("uploadSourceMaps", () => {
  it("파일별로 토큰 헤더와 함께 POST", async () => {
    const fetchImpl = vi.fn(
      async (_url: string, _opts?: RequestInit) =>
        ({ ok: true, status: 201 }) as Response,
    );
    const results = await uploadSourceMaps({
      dsn: DSN,
      secretKey: "sk",
      release: "1.0.0",
      files: [
        { name: "a.js", content: "{}" },
        { name: "b.js", content: "{}" },
      ],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [, opts] = fetchImpl.mock.calls[0]!;
    const init = opts as RequestInit;
    expect((init.headers as Record<string, string>)["X-Upload-Token"]).toBe("sk");
    expect(init.method).toBe("POST");
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("네트워크 실패는 ok:false로 수집 (throw 안 함)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network");
    });
    const results = await uploadSourceMaps({
      dsn: DSN,
      secretKey: "sk",
      release: "1.0.0",
      files: [{ name: "a.js", content: "{}" }],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(results[0]).toEqual({ name: "a.js", ok: false, status: 0 });
  });
});
