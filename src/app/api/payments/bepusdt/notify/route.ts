import { parseBepusdtNotification } from "@/lib/bepusdt";
import { completePaidOrder } from "@/lib/order-service";
import { trySendDeliveryEmail } from "@/lib/delivery-email";
import { trySendPaymentEmails } from "@/lib/order-email";

export const runtime = "nodejs";

function reply(value: "success" | "failure", status = 200) {
  return new Response(value, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

async function readNotification(request: Request) {
  const raw = request.method === "GET" ? new URL(request.url).search.slice(1) : await request.text();
  if (raw.length > 32_768) throw new Error("通知内容过大");
  if (request.headers.get("content-type")?.includes("application/json")) {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("通知格式无效");
    return parsed as Record<string, string | number | boolean | null | undefined>;
  }
  const parameters: Record<string, string> = Object.create(null);
  for (const [key, value] of new URLSearchParams(raw)) {
    if (Object.hasOwn(parameters, key)) throw new Error("通知字段重复");
    parameters[key] = value;
  }
  return parameters;
}

async function handle(request: Request) {
  if (request.method !== "GET" && request.method !== "POST") return reply("failure", 405);
  try {
    const paid = parseBepusdtNotification(await readNotification(request));
    if (!paid) return reply("success");
    const order = completePaidOrder({
      orderNo: paid.orderNo,
      provider: "bepusdt",
      providerRef: paid.providerRef,
      amountCents: paid.amountCents,
    });
    await trySendPaymentEmails(order);
    if (order.status === "delivered") await trySendDeliveryEmail(order.orderNo);
    return reply("success");
  } catch (error) {
    const reason = error instanceof Error ? error.message.replace(/[\r\n]/g, " ").slice(0, 160) : "Unknown error";
    console.error("BEpusdt notification rejected", reason);
    return reply("failure", 503);
  }
}

export const GET = handle;
export const POST = handle;
