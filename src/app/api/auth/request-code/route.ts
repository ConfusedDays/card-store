import { NextResponse } from "next/server";
import { z } from "zod";
import { createLoginCode, sendLoginCodeEmail } from "@/lib/customer-auth";

const schema = z.object({ email: z.email("请输入有效邮箱") });

export async function POST(request: Request) {
  try {
    const { email } = schema.parse(await request.json());
    const login = createLoginCode(email);
    const result = await sendLoginCodeEmail(login.email, login.code);
    if (result.status === "disabled" && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "邮件服务暂未配置，请联系管理员" }, { status: 503 });
    }
    return NextResponse.json({ sent: result.status === "sent", expiresIn: 600, ...(process.env.NODE_ENV !== "production" ? { devCode: login.code } : {}) });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "验证码发送失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
