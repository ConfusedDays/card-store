import { getCheckoutOrder } from "@/lib/checkout";
import { completePaidOrder } from "@/lib/order-service";
import { queryEpayTrade, type EpayTrade } from "@/lib/epay";

export async function reconcileEpayOrder(orderNo: string, notification?: EpayTrade) {
  const stored = getCheckoutOrder(orderNo);
  if (!stored || stored.paymentProvider !== "epay" || stored.status === "cancelled") throw new Error("订单不可支付");
  if (notification && (notification.amountCents !== stored.amountCents || notification.paymentMethod !== stored.paymentMethod)) {
    throw new Error("通知与订单不匹配");
  }
  const trade = await queryEpayTrade(orderNo);
  if (!trade) return null;
  if (notification) {
    const notificationRefs = notification.providerRefs ?? [notification.providerRef];
    const tradeRefs = trade.providerRefs ?? [trade.providerRef];
    if (trade.amountCents !== notification.amountCents || trade.paymentMethod !== notification.paymentMethod
      || !tradeRefs.some((reference) => notificationRefs.includes(reference))) throw new Error("通知与查单结果不匹配");
  }
  return completePaidOrder({ orderNo, provider: "epay", ...trade });
}
