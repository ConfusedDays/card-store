import { NextResponse } from "next/server";
import { z } from "zod";
import { createPendingOrder } from "@/lib/order-service";
import { createPaymentCheckout } from "@/lib/payment-provider";

const orderSchema = z.object({
  variantId: z.string().min(1),
  email: z.email("请输入有效邮箱"),
  paymentMethod: z.enum(["wechat", "alipay", "mock"]),
});

export async function POST(request: Request) {
  try {
    const input = orderSchema.parse(await request.json());
    const order = createPendingOrder(input);
    const checkout = createPaymentCheckout({ orderNo: order.orderNo, paymentMethod: input.paymentMethod });
    return NextResponse.json({ ...order, ...checkout }, { status: 201 });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "创建订单失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
