import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstileToken } from "./turnstile";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Turnstile verification", () => {
  it("is optional until production keys are configured", async () => {
    await expect(verifyTurnstileToken(undefined)).resolves.toBeUndefined();
  });

  it("requires a token when the secret is configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    await expect(verifyTurnstileToken(undefined)).rejects.toThrow("请先完成人机验证");
  });

  it("accepts a valid token from an allowed hostname", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubEnv("TURNSTILE_ALLOWED_HOSTNAMES", "reiishop.cn");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      action: "create_order",
      hostname: "reiishop.cn",
    }), { status: 200 })));

    await expect(verifyTurnstileToken("valid-token", "203.0.113.10")).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("siteverify"), expect.objectContaining({ method: "POST" }));
  });

  it("rejects tokens issued for another action", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      action: "admin_login",
      hostname: "reiishop.cn",
    }), { status: 200 })));

    await expect(verifyTurnstileToken("wrong-action")).rejects.toThrow("人机验证失败");
  });
});
