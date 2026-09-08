import { NextResponse } from "next/server";
import { queryAlipayTrade } from "@/lib/payment-provider";
import { completePaidOrder, getOrderForCustomer } from "@/lib/order-service";
import { trySendDeliveryEmail } from "@/lib/delivery-email";
import { trySendPaymentEmails } from "@/lib/order-email";
import { getCheckoutOrder } from "@/lib/checkout";
import { reconcileEpayOrder } from "@/lib/epay-fulfillment";

export async function GET(request: Request, context: { params: Promise<{ orderNo: string }> }) {
  const { orderNo } = await context.params;
  const url = new URL(request.url);
  const email = url.searchParams.get("email") ?? "";
  if (!email) return NextResponse.json({ error: "请输入下单邮箱" }, { status: 400 });
  let order = getOrderForCustomer(orderNo, email);
  if (!order) return NextResponse.json({ error: "未找到匹配的订单" }, { status: 404 });

  const reconcile = url.searchParams.get("reconcile");
  const provider = getCheckoutOrder(orderNo)?.paymentProvider;
  if ((reconcile === "payment" || reconcile === "alipay") && order.status === "pending") {
    try {
      if (provider === "epay") {
        const completed = await reconcileEpayOrder(orderNo);
        if (completed) {
          order = completed;
          await trySendPaymentEmails(order);
        }
      } else if (provider === "alipay" && order.paymentMethod === "alipay") {
        const trade = await queryAlipayTrade(orderNo);
        if (trade) {
          order = completePaidOrder({
            orderNo,
            provider: "alipay",
            providerRef: trade.providerRef,
            amountCents: trade.amountCents,
          });
          await trySendPaymentEmails(order);
        }
      }
    } catch {
      return NextResponse.json({ error: "支付结果暂未确认，请稍后重试" }, { status: 503 });
    }
  }

  if (order.status === "delivered") await trySendDeliveryEmail(order.orderNo);

  return NextResponse.json(order);
}
