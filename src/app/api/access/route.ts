import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyTurnstileToken } from "@/lib/turnstile";

const accessSchema = z.object({ token: z.string().min(1).max(2048) });

export async function POST(request: Request) {
  try {
    const input = accessSchema.parse(await request.json());
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const remoteIp = request.headers.get("cf-connecting-ip") ?? forwardedFor;
    await verifyTurnstileToken(input.token, remoteIp, "site_access");
    return NextResponse.json({ verified: true });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "验证失败，请重试";
    return NextResponse.json({ verified: false, error: message }, { status: 400 });
  }
}
