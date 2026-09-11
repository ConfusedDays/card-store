import { getCheckoutOrder } from "@/lib/checkout";
import { completePaidOrder } from "@/lib/order-service";
import { EpayQueryUnavailable, queryEpayTrade, type EpayTrade } from "@/lib/epay";

export async function reconcileEpayOrder(orderNo: string, notification?: EpayTrade) {
  const stored = getCheckoutOrder(orderNo);
  if (!stored || stored.paymentProvider !== "epay" || stored.status === "cancelled") throw new Error("订单不可支付");
  if (notification && (notification.amountCents !== stored.amountCents || notification.paymentMethod !== stored.paymentMethod)) {
    throw new Error("通知与订单不匹配");
  }
  let trade: EpayTrade | null;
  try {
    trade = await queryEpayTrade(orderNo);
  } catch (error) {
    if (!notification || !(error instanceof EpayQueryUnavailable)) throw error;
    // The callback itself is already authenticated with the platform public
    // key and has passed order, amount, channel and success-state checks.
    // A temporary query outage must not leave a paid order stuck in pending.
    trade = notification;
  }
  if (!trade) return null;
  if (notification) {
    const notificationRefs = notification.providerRefs?.length ? notification.providerRefs : [];
    const tradeRefs = trade.providerRefs?.length ? trade.providerRefs : [];
    const referenceMatches = notificationRefs.length > 0 && tradeRefs.length > 0
      ? tradeRefs.some((reference) => notificationRefs.includes(reference))
      : notification.merchantOrderNo === trade.merchantOrderNo;
    if (trade.amountCents !== notification.amountCents || trade.paymentMethod !== notification.paymentMethod
      || !referenceMatches) throw new Error("通知与查单结果不匹配");
  }
  return completePaidOrder({ orderNo, provider: "epay", ...trade });
}
