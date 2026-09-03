import { NextResponse } from "next/server";
import { z } from "zod";
import { sendContactNotification } from "@/lib/contact-email";

export const runtime = "nodejs";

const contactSchema = z.object({
  name: z.string().trim().min(1, "请填写称呼").max(80, "称呼不能超过 80 个字符"),
  email: z.email("请输入有效邮箱"),
  orderNo: z.string().trim().max(80, "订单号不能超过 80 个字符").optional(),
  message: z.string().trim().min(10, "请至少填写 10 个字符，便于客服处理").max(3000, "问题说明不能超过 3000 个字符"),
});

export async function POST(request: Request) {
  try {
    const input = contactSchema.parse(await request.json());
    const result = await sendContactNotification(input);
    if (result.status === "disabled") return NextResponse.json({ error: "客服邮件尚未配置，请使用页面中的其他联系方式" }, { status: 503 });
    return NextResponse.json({ status: "sent" });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? "暂时无法提交，请稍后重试或使用其他联系方式" : "提交失败，请稍后重试";
    return NextResponse.json({ error: message }, { status: error instanceof z.ZodError ? 400 : 502 });
  }
}
