import { AlipaySdk } from "alipay-sdk";
import { centsToCny, cnyToCents } from "@/lib/payment-money";

export type PaymentMethod = "wechat" | "alipay" | "mock";

export type PaymentCheckout = {
  checkoutUrl: string;
  provider: "mock" | "wechat" | "alipay";
};

export type VerifiedAlipayTrade = {
  providerRef: string;
  amountCents: number;
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

export function parseAlipayTradeQuery(result: Record<string, unknown>, expectedOrderNo: string): VerifiedAlipayTrade | null {
  const subCode = String(result.subCode ?? result.sub_code ?? "");
  if (result.code !== "10000") {
    if (subCode === "ACQ.TRADE_NOT_EXIST") return null;
    throw new Error(`支付宝交易查询失败：${subCode || String(result.msg ?? "未知错误")}`);
  }

  const orderNo = String(result.outTradeNo ?? result.out_trade_no ?? "");
  if (orderNo !== expectedOrderNo) throw new Error("支付宝交易订单号不匹配");

  const tradeStatus = String(result.tradeStatus ?? result.trade_status ?? "");
  if (tradeStatus !== "TRADE_SUCCESS" && tradeStatus !== "TRADE_FINISHED") return null;

  const providerRef = String(result.tradeNo ?? result.trade_no ?? "");
  const totalAmount = String(result.totalAmount ?? result.total_amount ?? "");
  if (!providerRef || !totalAmount) throw new Error("支付宝交易查询结果缺少必要字段");
  return { providerRef, amountCents: cnyToCents(totalAmount) };
}

export async function queryAlipayTrade(orderNo: string): Promise<VerifiedAlipayTrade | null> {
  const { client } = getAlipayClient();
  const result = await client.exec("alipay.trade.query", {
    bizContent: { out_trade_no: orderNo },
  });
  return parseAlipayTradeQuery(result, orderNo);
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
