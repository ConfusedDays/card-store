import { cnyToCents } from "@/lib/payment-money";
import { getAlipayClient } from "@/lib/payment-provider";
import { completePaidOrder } from "@/lib/order-service";
import { trySendDeliveryEmail } from "@/lib/delivery-email";
import { trySendPaymentEmails } from "@/lib/order-email";

export const runtime = "nodejs";

function reply(value: "success" | "failure", status = 200) {
  return new Response(value, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const notification = Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    );
    const { client, appId, sellerId } = getAlipayClient();
    if (!client.checkNotifySignV2(notification)) return reply("failure", 400);
    if (notification.app_id !== appId || notification.seller_id !== sellerId) {
      return reply("failure", 400);
    }
    if (notification.trade_status !== "TRADE_SUCCESS" && notification.trade_status !== "TRADE_FINISHED") {
      return reply("success");
    }
    if (!notification.out_trade_no || !notification.trade_no || !notification.total_amount) {
      return reply("failure", 400);
    }

    const order = completePaidOrder({
      orderNo: notification.out_trade_no,
      provider: "alipay",
      providerRef: notification.trade_no,
      amountCents: cnyToCents(notification.total_amount),
    });
    await trySendPaymentEmails(order);
    if (order.status === "delivered") await trySendDeliveryEmail(order.orderNo);
    return reply("success");
  } catch (error) {
    console.error("Alipay notification rejected", error);
    return reply("failure", 400);
  }
}
