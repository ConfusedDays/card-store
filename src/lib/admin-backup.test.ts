import { describe, expect, it } from "vitest";
import { decryptBackupPayload, encryptBackupPayload } from "@/lib/admin-backup";

describe("encrypted admin backups", () => {
  it("encrypts and decrypts backup data", () => {
    const payload = { format: "test", inventory: ["SECRET-CARD-KEY"] };
    const encrypted = encryptBackupPayload(payload, "a-strong-backup-password");
    expect(encrypted.toString("utf8")).not.toContain("SECRET-CARD-KEY");
    expect(decryptBackupPayload(encrypted, "a-strong-backup-password")).toEqual(payload);
  });

  it("rejects an incorrect password", () => {
    const encrypted = encryptBackupPayload({ ok: true }, "correct-password");
    expect(() => decryptBackupPayload(encrypted, "wrong-password")).toThrow("备份密码错误或文件已损坏");
  });
});
