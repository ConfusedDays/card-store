import { NextResponse } from "next/server";
import { queryAlipayTrade } from "@/lib/payment-provider";
import { completePaidOrder, getOrderForCustomer } from "@/lib/order-service";
import { trySendDeliveryEmail } from "@/lib/delivery-email";

export async function GET(request: Request, context: { params: Promise<{ orderNo: string }> }) {
  const { orderNo } = await context.params;
  const url = new URL(request.url);
  const email = url.searchParams.get("email") ?? "";
  if (!email) return NextResponse.json({ error: "请输入下单邮箱" }, { status: 400 });
  let order = getOrderForCustomer(orderNo, email);
  if (!order) return NextResponse.json({ error: "未找到匹配的订单" }, { status: 404 });

  if (url.searchParams.get("reconcile") === "alipay" && order.status === "pending" && order.paymentMethod === "alipay") {
    const trade = await queryAlipayTrade(orderNo);
    if (trade) {
      order = completePaidOrder({
        orderNo,
        provider: "alipay",
        providerRef: trade.providerRef,
        amountCents: trade.amountCents,
      });
    }
  }

  if (order.status === "delivered") await trySendDeliveryEmail(order.orderNo);

  return NextResponse.json(order);
}
