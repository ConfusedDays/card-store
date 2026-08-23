import crypto from "node:crypto";

const algorithm = "aes-256-gcm";

function secretKey() {
  const raw = process.env.LICENSE_KEY_SECRET
    ?? (process.env.NODE_ENV === "production" ? "" : "dev-only-card-store-secret-change-me");
  if (!raw) throw new Error("LICENSE_KEY_SECRET is required in production");
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptLicenseKey(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptLicenseKey(value: string) {
  const [ivPart, tagPart, encryptedPart] = value.split(".");
  if (!ivPart || !tagPart || !encryptedPart) throw new Error("Invalid encrypted key");
  const decipher = crypto.createDecipheriv(algorithm, secretKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function keyLast4(value: string) {
  return value.slice(-4).padStart(4, "*");
}

export function keyFingerprint(value: string) {
  return crypto.createHmac("sha256", secretKey()).update(value).digest("hex");
}
