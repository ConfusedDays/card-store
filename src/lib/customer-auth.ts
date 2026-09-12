import crypto from "node:crypto";
import { db } from "@/lib/db";

export const CUSTOMER_SESSION_COOKIE = "reii_customer_session";
const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function authSecret() {
  const value = process.env.AUTH_SESSION_SECRET?.trim() || process.env.LICENSE_KEY_SECRET?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SESSION_SECRET is required in production");
  return "dev-only-customer-auth-secret-change-me";
}

export function normalizeCustomerEmail(email: string) {
  return email.trim().toLowerCase();
}

function hash(value: string) {
  return crypto.createHmac("sha256", authSecret()).update(value).digest("hex");
}

function makeCodeHash(email: string, code: string) {
  return hash(`login-code:${email}:${code}`);
}

export function createLoginCode(emailInput: string) {
  const email = normalizeCustomerEmail(emailInput);
  const now = Date.now();
  const recent = db.prepare("SELECT created_at as createdAt FROM customer_login_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1")
    .get(email) as { createdAt: number } | undefined;
  if (recent && now - recent.createdAt < 60_000) throw new Error("验证码发送过于频繁，请稍后再试");

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = now + CODE_TTL_MS;
  db.prepare("UPDATE customer_login_codes SET consumed_at = ? WHERE email = ? AND consumed_at IS NULL").run(now, email);
  db.prepare("INSERT INTO customer_login_codes (email, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(email, makeCodeHash(email, code), expiresAt, now);
  return { email, code, expiresAt };
}

export function verifyLoginCode(emailInput: string, codeInput: string) {
  const email = normalizeCustomerEmail(emailInput);
  const code = codeInput.trim();
  const now = Date.now();
  const entry = db.prepare(`
    SELECT id, code_hash as codeHash, attempts, expires_at as expiresAt
    FROM customer_login_codes
    WHERE email = ? AND consumed_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `).get(email) as { id: number; codeHash: string; attempts: number; expiresAt: number } | undefined;
  if (!entry || entry.expiresAt <= now) throw new Error("验证码已过期，请重新获取");
  if (entry.attempts >= 5) throw new Error("验证码尝试次数过多，请重新获取");

  const expected = makeCodeHash(email, code);
  const matches = /^[a-f0-9]{64}$/i.test(expected) && /^[a-f0-9]{64}$/i.test(entry.codeHash)
    && crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(entry.codeHash, "hex"));
  if (!matches) {
    db.prepare("UPDATE customer_login_codes SET attempts = attempts + 1 WHERE id = ?").run(entry.id);
    throw new Error("验证码错误，请检查后重试");
  }

  db.prepare("UPDATE customer_login_codes SET consumed_at = ? WHERE id = ?").run(now, entry.id);
  db.prepare("DELETE FROM customer_sessions WHERE email = ? OR expires_at <= ?").run(email, now);
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = now + SESSION_TTL_MS;
  db.prepare("INSERT INTO customer_sessions (token_hash, email, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)")
    .run(hash(`session:${token}`), email, expiresAt, now, now);
  return { email, token, expiresAt };
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  const value = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getCustomerFromRequest(request: Request) {
  const token = readCookie(request, CUSTOMER_SESSION_COOKIE);
  if (!token) return null;
  const now = Date.now();
  const session = db.prepare("SELECT email, expires_at as expiresAt FROM customer_sessions WHERE token_hash = ?")
    .get(hash(`session:${token}`)) as { email: string; expiresAt: number } | undefined;
  if (!session || session.expiresAt <= now) return null;
  db.prepare("UPDATE customer_sessions SET last_seen_at = ? WHERE token_hash = ?").run(now, hash(`session:${token}`));
  return { email: session.email };
}

export function revokeCustomerSession(request: Request) {
  const token = readCookie(request, CUSTOMER_SESSION_COOKIE);
  if (token) db.prepare("DELETE FROM customer_sessions WHERE token_hash = ?").run(hash(`session:${token}`));
}

export function customerSessionCookieOptions(expiresAt: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    expires: new Date(expiresAt),
    maxAge: Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
    path: "/",
  };
}

export function expiredCustomerSessionCookieOptions() {
  return { ...customerSessionCookieOptions(0), expires: new Date(0), maxAge: 0 };
}

export async function sendLoginCodeEmail(email: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  if (!apiKey || !from) return { status: "disabled" as const };
  const safeCode = code.replace(/[^0-9]/g, "");
  const text = [`Reii小店登录验证码：${safeCode}`, "验证码 10 分钟内有效。如非本人操作，请忽略此邮件。"].join("\n\n");
  const html = `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#0b0d12;color:#e9eef8;font-family:Arial,'Microsoft YaHei',sans-serif"><div style="max-width:560px;margin:0 auto;padding:32px 20px"><div style="background:#141823;border:1px solid #273044;border-radius:16px;padding:28px"><div style="color:#62d8ff;font-size:13px;letter-spacing:.12em">REII SHOP</div><h1 style="font-size:24px;margin:12px 0 8px">登录验证码</h1><p style="color:#b6c4d2;line-height:1.7">请使用以下验证码登录用户中心，验证码 10 分钟内有效。</p><div style="margin:22px 0;padding:18px;border-radius:12px;background:#0b0d12;text-align:center;font-family:Consolas,monospace;font-size:34px;letter-spacing:.24em;color:#74d7c4">${safeCode}</div><p style="color:#8996aa;font-size:13px;line-height:1.7">如非本人操作，请忽略此邮件。请勿将验证码告知他人。</p></div></div></body></html>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [email], subject: "Reii小店登录验证码", html, text }),
    signal: AbortSignal.timeout(12_000),
  });
  const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok || !payload.id) throw new Error(payload.message || `验证码邮件发送失败（${response.status}）`);
  return { status: "sent" as const };
}
