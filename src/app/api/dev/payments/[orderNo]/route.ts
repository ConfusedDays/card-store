import { NextResponse } from "next/server";
import { completeMockPayment } from "@/lib/order-service";
import { trySendDeliveryEmail } from "@/lib/delivery-email";
import { trySendPaymentEmails } from "@/lib/order-email";

export async function POST(_: Request, context: { params: Promise<{ orderNo: string }> }) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const { orderNo } = await context.params;
    const order = completeMockPayment(orderNo);
    await trySendPaymentEmails(order);
    if (order.status === "delivered") await trySendDeliveryEmail(order.orderNo);
    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "支付确认失败" }, { status: 400 });
  }
}
