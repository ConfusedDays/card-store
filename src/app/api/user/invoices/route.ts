import { NextResponse } from "next/server";
import { z } from "zod";
import { getCustomerFromRequest } from "@/lib/customer-auth";
import { requestInvoice } from "@/lib/customer";
import { sendInvoiceRequestNotification } from "@/lib/invoice-email";

const schema = z.object({
  orderNo: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1, "请输入发票抬头").max(120, "发票抬头不能超过 120 个字符"),
  taxNo: z.string().trim().max(40, "税号不能超过 40 个字符").optional(),
});

export async function POST(request: Request) {
  const customer = getCustomerFromRequest(request);
  if (!customer) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const input = schema.parse(await request.json());
    const invoice = requestInvoice({ ...input, email: customer.email });
    try {
      await sendInvoiceRequestNotification({ ...input, email: customer.email });
    } catch (error) {
      console.error("Invoice notification failed", error instanceof Error ? error.message : error);
    }
    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "提交开票申请失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
