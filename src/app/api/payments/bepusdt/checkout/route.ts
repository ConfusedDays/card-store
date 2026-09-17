import { NextResponse } from "next/server";
import { getCheckoutOrder } from "@/lib/checkout";
import { createBepusdtOrder, readBepusdtCheckoutToken } from "@/lib/bepusdt";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    const orderNo = readBepusdtCheckoutToken(token);
    const order = getCheckoutOrder(orderNo);
    if (!order || order.paymentProvider !== "bepusdt") return NextResponse.json({ error: "订单不可支付" }, { status: 409 });
    if (order.status !== "pending") return NextResponse.json({ error: "订单已处理或已取消" }, { status: 409 });
    const payment = await createBepusdtOrder({
      orderNo,
      amountCents: order.amountCents,
      subject: `${order.productName} - ${order.variantLabel}`,
    });
    return NextResponse.redirect(payment.paymentUrl, { status: 303 });
  } catch (error) {
    const reason = error instanceof Error ? error.message.replace(/[\r\n]/g, " ").slice(0, 160) : "Unknown error";
    console.error("BEpusdt checkout failed", reason);
    return NextResponse.json({ error: "加密货币支付暂时不可用，请稍后重试" }, { status: 502 });
  }
}
