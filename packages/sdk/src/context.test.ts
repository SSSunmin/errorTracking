import { describe, expect, it } from "vitest";
import { browserFromUa, osFromUa } from "./context";

const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const EDGE_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.87";
const FIREFOX_LINUX =
  "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0";
const SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

describe("browserFromUa", () => {
  it("Chrome", () => {
    expect(browserFromUa(CHROME_WIN)).toEqual({ name: "Chrome", version: "126.0.0.0" });
  });
  it("Edge는 Chrome 토큰보다 우선", () => {
    expect(browserFromUa(EDGE_WIN)).toEqual({ name: "Edge", version: "126.0.2592.87" });
  });
  it("Firefox", () => {
    expect(browserFromUa(FIREFOX_LINUX)).toEqual({ name: "Firefox", version: "127.0" });
  });
  it("Safari", () => {
    expect(browserFromUa(SAFARI_MAC)).toEqual({ name: "Safari", version: "17.5" });
  });
  it("알 수 없으면 undefined", () => {
    expect(browserFromUa("curl/8.0")).toBeUndefined();
  });
});

describe("osFromUa", () => {
  it("Windows NT 10.0 → Windows 10", () => {
    expect(osFromUa(CHROME_WIN)).toEqual({ name: "Windows", version: "10" });
  });
  it("macOS 버전 언더스코어 변환", () => {
    expect(osFromUa(SAFARI_MAC)).toEqual({ name: "macOS", version: "10.15.7" });
  });
  it("Android (Linux 토큰보다 우선)", () => {
    expect(osFromUa(CHROME_ANDROID)).toEqual({ name: "Android", version: "14" });
  });
  it("Linux", () => {
    expect(osFromUa(FIREFOX_LINUX)).toEqual({ name: "Linux" });
  });
});
