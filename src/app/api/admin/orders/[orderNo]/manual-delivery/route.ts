import { NextResponse } from "next/server";
import { trySendDeliveryEmail } from "@/lib/delivery-email";
import { isAdminRequest } from "@/lib/admin";
import { manuallyDeliverPendingOrder } from "@/lib/order-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ orderNo: string }> }) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });
  }

  try {
    const { orderNo } = await context.params;
    const order = manuallyDeliverPendingOrder(orderNo);
    const email = await trySendDeliveryEmail(order.orderNo);
    return NextResponse.json({
      orderNo: order.orderNo,
      status: order.status,
      emailStatus: email.status,
      ...(email.status === "failed" ? { emailError: email.error } : {}),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "手动发卡失败" }, { status: 400 });
  }
}
