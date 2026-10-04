import { describe, expect, it } from "vitest";
import {
  decryptShareToken,
  encryptShareToken,
  generateShareToken,
  hashShareToken,
  isPlausibleShareToken,
  shareUrl,
} from "./tokens";

describe("share tokens", () => {
  it("are 256-bit, URL-safe and unique", () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateShareToken));
    expect(tokens.size).toBe(1000);
    for (const t of tokens) {
      expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(isPlausibleShareToken(t)).toBe(true);
    }
  });

  it("reject malformed or predictable values before any lookup", () => {
    expect(isPlausibleShareToken("october-2026")).toBe(false);
    expect(isPlausibleShareToken("")).toBe(false);
    expect(isPlausibleShareToken("a".repeat(44))).toBe(false);
    expect(isPlausibleShareToken("../../etc/passwd" + "a".repeat(27))).toBe(false);
  });

  it("hash deterministically to hex SHA-256", () => {
    const t = generateShareToken();
    expect(hashShareToken(t)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashShareToken(t)).toBe(hashShareToken(t));
    expect(hashShareToken(t)).not.toBe(hashShareToken(generateShareToken()));
  });

  it("encrypt with a fresh IV and decrypt back", () => {
    const t = generateShareToken();
    const a = encryptShareToken(t);
    const b = encryptShareToken(t);
    expect(a).not.toBe(b);
    expect(a).not.toContain(t);
    expect(decryptShareToken(a)).toBe(t);
    expect(decryptShareToken(b)).toBe(t);
  });

  it("detect tampering", () => {
    const enc = encryptShareToken(generateShareToken());
    const [iv, ct, tag] = enc.split(".");
    const flipped = ct.slice(0, -2) + (ct.at(-2) === "A" ? "B" : "A") + ct.at(-1);
    expect(decryptShareToken([iv, flipped, tag].join("."))).toBeNull();
    expect(decryptShareToken("garbage")).toBeNull();
  });

  it("build links on the configured app URL", () => {
    expect(shareUrl("abc")).toBe("https://memories.example.com/m/abc");
  });
});
