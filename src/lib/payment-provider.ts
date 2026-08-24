import { AlipaySdk } from "alipay-sdk";
import { centsToCny } from "@/lib/payment-money";

export type PaymentMethod = "wechat" | "alipay" | "mock";

export type PaymentCheckout = {
  checkoutUrl: string;
  provider: "mock" | "wechat" | "alipay";
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`支付宝配置缺少 ${name}`);
  return value;
}

function normalizeKey(value: string) {
  return value.replace(/\\n/g, "\n");
}

function publicBaseUrl() {
  const configured = process.env.APP_URL?.trim()
    || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "");
  if (!configured) throw new Error("支付宝配置缺少 APP_URL");
  const url = new URL(configured);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("生产环境 APP_URL 必须使用 HTTPS");
  }
  return url.origin;
}

export function getAlipayClient() {
  const mode = process.env.ALIPAY_MODE === "production" ? "production" : "sandbox";
  const appId = required("ALIPAY_APP_ID");
  const sellerId = required("ALIPAY_SELLER_ID");
  const client = new AlipaySdk({
    appId,
    privateKey: normalizeKey(required("ALIPAY_PRIVATE_KEY")),
    alipayPublicKey: normalizeKey(required("ALIPAY_PUBLIC_KEY")),
    keyType: process.env.ALIPAY_KEY_TYPE === "PKCS1" ? "PKCS1" : "PKCS8",
    signType: "RSA2",
    gateway: process.env.ALIPAY_GATEWAY?.trim()
      || (mode === "sandbox"
        ? "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
        : "https://openapi.alipay.com/gateway.do"),
  });
  return { client, appId, sellerId };
}

export function assertPaymentConfigured(paymentMethod: PaymentMethod) {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.PAYMENT_MODE === "mock") throw new Error("生产环境禁止使用模拟支付");
  if (paymentMethod !== "alipay") throw new Error("微信支付商户接口尚未配置");
  getAlipayClient();
  publicBaseUrl();
}

export function createPaymentCheckout(input: {
  orderNo: string;
  paymentMethod: PaymentMethod;
  amountCents: number;
  subject: string;
}): PaymentCheckout {
  if (process.env.NODE_ENV !== "production") {
    return { checkoutUrl: `/checkout/${input.orderNo}`, provider: "mock" };
  }
  assertPaymentConfigured(input.paymentMethod);

  const { client } = getAlipayClient();
  const baseUrl = publicBaseUrl();
  const checkoutUrl = client.pageExecute("alipay.trade.page.pay", "GET", {
    bizContent: {
      out_trade_no: input.orderNo,
      product_code: "FAST_INSTANT_TRADE_PAY",
      subject: input.subject.slice(0, 256),
      total_amount: centsToCny(input.amountCents),
    },
    notifyUrl: `${baseUrl}/api/payments/alipay/notify`,
    returnUrl: `${baseUrl}/checkout/${encodeURIComponent(input.orderNo)}?payment=returned`,
  });
  return { checkoutUrl, provider: "alipay" };
}
