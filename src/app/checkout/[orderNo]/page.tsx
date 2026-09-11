import { notFound } from "next/navigation";
import { getCheckoutOrder } from "@/lib/checkout";
import { CheckoutClient } from "@/components/checkout-client";
import { createPaymentCheckout } from "@/lib/payment-provider";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ orderNo: string }>; searchParams?: Promise<{ payment?: string }> }) {
  const { orderNo } = await params;
  const query = searchParams ? await searchParams : {};
  const order = getCheckoutOrder(orderNo);
  if (!order) notFound();
  const mockMode = process.env.NODE_ENV !== "production" && order.paymentProvider !== "epay";
  const awaitingPayment = !mockMode && order.status === "pending" && query.payment !== "returned";
  const paymentUrl = awaitingPayment
    ? createPaymentCheckout({ orderNo: order.orderNo, paymentMethod: order.paymentMethod as "wechat" | "alipay", amountCents: order.amountCents, subject: `${order.productName} - ${order.variantLabel}` }).checkoutUrl
    : null;
  return <CheckoutClient order={order} mockMode={mockMode} paymentUrl={paymentUrl} />;
}
