export type PaymentMethod = "wechat" | "alipay" | "mock";

export type PaymentCheckout = {
  checkoutUrl: string;
  provider: "mock" | "wechat" | "alipay";
};

export function createPaymentCheckout(input: { orderNo: string; paymentMethod: PaymentMethod }): PaymentCheckout {
  const mockEnabled = process.env.PAYMENT_MODE === "mock" || process.env.NODE_ENV !== "production";
  if (mockEnabled) {
    return { checkoutUrl: `/checkout/${input.orderNo}`, provider: "mock" };
  }
  throw new Error(`${input.paymentMethod === "wechat" ? "微信支付" : "支付宝"}商户接口尚未配置`);
}
