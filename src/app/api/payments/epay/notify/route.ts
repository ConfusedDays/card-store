import { parseEpayNotification } from "@/lib/epay";
import { reconcileEpayOrder } from "@/lib/epay-fulfillment";
import { trySendDeliveryEmail } from "@/lib/delivery-email";
import { trySendPaymentEmails } from "@/lib/order-email";

export const runtime = "nodejs";

function reply(text: string, status = 200) {
  return new Response(text, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}

async function handle(request: Request) {
  try {
    const text = request.method === "GET" ? new URL(request.url).search.slice(1) : await request.text();
    if (text.length > 32_768) return reply("failure", 413);
    const parameters = new URLSearchParams(text);
    const notification: Record<string, string> = Object.create(null);
    for (const [key, value] of parameters) {
      if (Object.hasOwn(notification, key)) return reply("failure", 400);
      notification[key] = value;
    }
    const paid = parseEpayNotification(notification);
    if (!paid) return reply("success");
    const order = await reconcileEpayOrder(paid.orderNo, paid);
    // Unpaid/query failures must be retried by the platform, never acknowledged as fulfilled.
    if (!order) return reply("failure", 503);
    await trySendPaymentEmails(order);
    if (order.status === "delivered") await trySendDeliveryEmail(order.orderNo);
    return reply("success");
  } catch {
    // Do not log raw callbacks, upstream errors or configuration secrets.
    return reply("failure", 503);
  }
}

export const GET = handle;
export const POST = handle;
