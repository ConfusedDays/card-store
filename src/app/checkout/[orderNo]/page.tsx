import { notFound } from "next/navigation";
import { getCheckoutOrder } from "@/lib/checkout";
import { CheckoutClient } from "@/components/checkout-client";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ orderNo: string }> }) {
  const { orderNo } = await params;
  const order = getCheckoutOrder(orderNo);
  if (!order) notFound();
  const mockMode = process.env.NODE_ENV !== "production";
  return <CheckoutClient order={order} mockMode={mockMode} />;
}
