import { NextResponse } from "next/server";
import { getOrderForCustomer } from "@/lib/order-service";

export async function GET(request: Request, context: { params: Promise<{ orderNo: string }> }) {
  const { orderNo } = await context.params;
  const email = new URL(request.url).searchParams.get("email") ?? "";
  if (!email) return NextResponse.json({ error: "请输入下单邮箱" }, { status: 400 });
  const order = getOrderForCustomer(orderNo, email);
  if (!order) return NextResponse.json({ error: "未找到匹配的订单" }, { status: 404 });
  return NextResponse.json(order);
}
