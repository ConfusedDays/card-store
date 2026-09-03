import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { trySendDeliveryEmail } from "@/lib/delivery-email";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ orderNo: string }> }) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });
  }

  const { orderNo } = await context.params;
  const result = await trySendDeliveryEmail(orderNo, { force: true });
  if (result.status === "disabled") {
    return NextResponse.json({ error: "邮件服务尚未配置" }, { status: 503 });
  }
  if (result.status === "busy") {
    return NextResponse.json({ error: "订单尚未发卡，或邮件正在发送中" }, { status: 409 });
  }
  if (result.status === "failed") {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ status: "sent" });
}
