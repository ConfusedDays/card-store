import { NextResponse } from "next/server";
import { z } from "zod";
import { createPendingOrder } from "@/lib/order-service";
import { assertPaymentConfigured, createPaymentCheckout } from "@/lib/payment-provider";
import { verifyTurnstileToken } from "@/lib/turnstile";

const orderSchema = z.object({
  variantId: z.string().min(1),
  email: z.email("请输入有效邮箱"),
  paymentMethod: z.enum(["wechat", "alipay"]),
  digitalTermsAccepted: z.literal(true, "请先确认数字商品交付与退款规则"),
  turnstileToken: z.string().max(2048).optional(),
});

export async function POST(request: Request) {
  try {
    const input = orderSchema.parse(await request.json());
    assertPaymentConfigured(input.paymentMethod);
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const remoteIp = request.headers.get("cf-connecting-ip") ?? forwardedFor;
    await verifyTurnstileToken(input.turnstileToken, remoteIp);
    const order = createPendingOrder(input);
    const checkout = createPaymentCheckout({
      orderNo: order.orderNo,
      paymentMethod: input.paymentMethod,
      amountCents: order.amountCents,
      subject: `${order.productName} - ${order.variantLabel}`,
    });
    return NextResponse.json({ ...order, ...checkout }, { status: 201 });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "创建订单失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
