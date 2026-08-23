import { describe, expect, it } from "vitest";
import { decryptLicenseKey, encryptLicenseKey, keyFingerprint, keyLast4 } from "./crypto";

describe("license key protection", () => {
  it("encrypts and decrypts without storing plaintext", () => {
    const value = "TEST-KEY-1234";
    const encrypted = encryptLicenseKey(value);
    expect(encrypted).not.toContain(value);
    expect(decryptLicenseKey(encrypted)).toBe(value);
  });

  it("creates stable fingerprints and safe previews", () => {
    expect(keyFingerprint("TEST-KEY-1234")).toBe(keyFingerprint("TEST-KEY-1234"));
    expect(keyFingerprint("TEST-KEY-1234")).not.toBe(keyFingerprint("TEST-KEY-5678"));
    expect(keyLast4("TEST-KEY-1234")).toBe("1234");
  });
});
