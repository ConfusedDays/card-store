import { randomBytes } from "node:crypto";
import { getCheckoutOrder } from "@/lib/checkout";
import { createEpayPagePayment, readEpayCheckoutToken } from "@/lib/epay";
import { publicBaseUrl } from "@/lib/payment-provider";

export const runtime = "nodejs";

function escape(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export async function GET(request: Request) {
  try {
    const orderNo = readEpayCheckoutToken(new URL(request.url).searchParams.get("token") ?? "");
    const order = getCheckoutOrder(orderNo);
    if (!order || order.paymentProvider !== "epay" || order.status !== "pending") {
      return new Response("订单不存在或已不需要付款，请返回订单查询。", { status: 409 });
    }
    const { action, fields } = createEpayPagePayment({ ...order, subject: `${order.productName} - ${order.variantLabel}` }, publicBaseUrl());
    const nonce = randomBytes(18).toString("base64");
    const inputs = Object.entries(fields).map(([name, value]) => `<input type="hidden" name="${escape(name)}" value="${escape(value)}">`).join("");
    return new Response(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>前往支付</title></head><body><p>正在前往支付平台…</p><form id="payment" method="post" action="${escape(action)}">${inputs}<button type="submit">继续付款</button></form><script nonce="${nonce}">document.getElementById('payment').submit();</script></body></html>`, {
      headers: {
        "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer",
        "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; form-action ${new URL(action).origin}; base-uri 'none'; frame-ancestors 'none'`,
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("支付链接无效、已过期或支付配置不可用，请返回商店重试。", { status: 400, headers: { "cache-control": "no-store" } });
  }
}
