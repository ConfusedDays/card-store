import { NextResponse } from "next/server";
import { z } from "zod";
import { customerSessionCookieOptions, CUSTOMER_SESSION_COOKIE, verifyLoginCode } from "@/lib/customer-auth";

const schema = z.object({ email: z.email("请输入有效邮箱"), code: z.string().regex(/^\d{6}$/, "请输入 6 位验证码") });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const session = verifyLoginCode(input.email, input.code);
    const response = NextResponse.json({ email: session.email });
    response.cookies.set(CUSTOMER_SESSION_COOKIE, session.token, customerSessionCookieOptions(session.expiresAt));
    return response;
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "登录失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
