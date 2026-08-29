const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileResult = {
  success: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

export function isTurnstileConfigured() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstileToken(token: string | undefined, remoteIp?: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return;
  if (!token) throw new Error("请先完成人机验证");

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  let response: Response;
  try {
    response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    });
  } catch {
    throw new Error("人机验证服务暂时不可用，请稍后重试");
  }
  if (!response.ok) throw new Error("人机验证服务暂时不可用，请稍后重试");

  const result = await response.json() as TurnstileResult;
  if (!result.success || (result.action && result.action !== "create_order")) {
    throw new Error("人机验证失败或已过期，请重新验证");
  }

  const allowedHostnames = (process.env.TURNSTILE_ALLOWED_HOSTNAMES ?? "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
  if (allowedHostnames.length > 0 && (!result.hostname || !allowedHostnames.includes(result.hostname.toLowerCase()))) {
    throw new Error("人机验证来源无效");
  }
}
