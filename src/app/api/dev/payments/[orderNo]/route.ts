import { NextResponse } from "next/server";
import { completeMockPayment } from "@/lib/order-service";

export async function POST(_: Request, context: { params: Promise<{ orderNo: string }> }) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const { orderNo } = await context.params;
    return NextResponse.json(completeMockPayment(orderNo));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "支付确认失败" }, { status: 400 });
  }
}
