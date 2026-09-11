import { createHmac, createPrivateKey, createPublicKey, sign, timingSafeEqual, verify } from "node:crypto";
import { centsToCny, cnyToCents } from "@/lib/payment-money";

type Parameters = Record<string, string | number | null>;
export type EpayMethod = "alipay" | "wechat";
export type EpayTrade = { providerRef: string; providerRefs?: string[]; amountCents: number; paymentMethod: EpayMethod };

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`聚合支付配置缺少 ${name}`);
  return value;
}

function pem(value: string, label: string) {
  const normalized = value.replace(/\\n/g, "\n");
  return normalized.includes("-----BEGIN") ? normalized
    : `-----BEGIN ${label}-----\n${normalized.replace(/\s/g, "").match(/.{1,64}/g)?.join("\n")}\n-----END ${label}-----`;
}

export function getEpayConfig() {
  const gateway = new URL(required("EPAY_GATEWAY"));
  if (gateway.protocol !== "https:" || gateway.username || gateway.password || gateway.search || gateway.hash) {
    throw new Error("EPAY_GATEWAY 必须为无凭据和查询参数的 HTTPS 网关地址");
  }
  gateway.pathname = `${gateway.pathname.replace(/\/$/, "")}/`;
  const pid = required("EPAY_PID");
  if (!/^\d+$/.test(pid)) throw new Error("EPAY_PID 格式无效");
  try {
    const privateKey = createPrivateKey(pem(required("EPAY_PRIVATE_KEY"), "PRIVATE KEY"));
    const publicKey = createPublicKey(pem(required("EPAY_PUBLIC_KEY"), "PUBLIC KEY"));
    for (const key of [privateKey, publicKey]) {
      if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
        throw new Error("Invalid RSA key");
      }
    }
    return { gateway, pid, privateKey, publicKey };
  } catch {
    // Never include OpenSSL errors, key material, or upstream response bodies.
    throw new Error("聚合支付 RSA 密钥配置无效，请检查商户私钥和平台公钥");
  }
}

export function canonicalEpayParameters(params: Parameters) {
  return Object.keys(params).sort()
    .filter((key) => key !== "sign" && key !== "sign_type" && params[key] !== "" && params[key] !== null)
    .map((key) => {
      const value = params[key];
      if (typeof value !== "string" && (typeof value !== "number" || !Number.isFinite(value))) {
        throw new Error("聚合支付参数格式无效");
      }
      return `${key}=${value}`;
    }).join("&");
}

export function signEpayParameters(params: Record<string, string>): Record<string, string> {
  const { privateKey } = getEpayConfig();
  return { ...params, sign_type: "RSA", sign: sign("RSA-SHA256", Buffer.from(canonicalEpayParameters(params)), privateKey).toString("base64") };
}

export function verifyEpayParameters(params: Parameters) {
  if ((params.sign_type !== "RSA" && params.sign_type !== "RSA2") || typeof params.sign !== "string"
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(params.sign)) return false;
  try {
    return verify("RSA-SHA256", Buffer.from(canonicalEpayParameters(params)), getEpayConfig().publicKey, Buffer.from(params.sign, "base64"));
  } catch {
    return false;
  }
}

export function epayType(method: string) {
  if (method === "alipay") return "alipay";
  if (method === "wechat") return "wxpay";
  throw new Error("聚合支付方式无效");
}

function paymentMethod(type: unknown): EpayMethod {
  if (type === "alipay") return "alipay";
  if (type === "wxpay") return "wechat";
  throw new Error("聚合支付方式无效");
}

export function createEpayPagePayment(input: { orderNo: string; amountCents: number; paymentMethod: string; subject: string }, baseUrl: string) {
  const config = getEpayConfig();
  return {
    action: new URL("api/pay/submit", config.gateway).href,
    fields: signEpayParameters({
      pid: config.pid, type: epayType(input.paymentMethod), out_trade_no: input.orderNo,
      name: input.subject.slice(0, 127), money: centsToCny(input.amountCents),
      notify_url: `${baseUrl}/api/payments/epay/notify`,
      return_url: `${baseUrl}/checkout/${encodeURIComponent(input.orderNo)}?payment=returned`,
      timestamp: String(Math.floor(Date.now() / 1000)),
    }),
  };
}

// A short-lived capability authorizes checkout without putting email or private keys in URLs.
function checkoutMac(payload: string) {
  return createHmac("sha256", getEpayConfig().privateKey.export({ type: "pkcs8", format: "der" }))
    .update(`epay-checkout:${payload}`).digest();
}

export function createEpayCheckoutToken(orderNo: string) {
  if (!/^[A-Z0-9]+$/.test(orderNo)) throw new Error("订单号无效");
  const payload = `${orderNo}.${Math.floor(Date.now() / 1000) + 1800}`;
  return `${payload}.${checkoutMac(payload).toString("base64url")}`;
}

export function readEpayCheckoutToken(token: string) {
  const match = /^([A-Z0-9]+)\.(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match || Number(match[2]) <= Math.floor(Date.now() / 1000)) throw new Error("支付链接无效或已过期");
  const expected = checkoutMac(`${match[1]}.${match[2]}`);
  const actual = Buffer.from(match[3], "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("支付链接无效或已过期");
  return match[1];
}

export function parseEpayNotification(params: Record<string, string>) {
  if (!verifyEpayParameters(params)) throw new Error("聚合支付通知验签失败");
  if (params.pid !== getEpayConfig().pid) throw new Error("聚合支付商户不匹配");
  if (params.trade_status !== "TRADE_SUCCESS") return null;
  const providerRef = params.trade_no || params.api_trade_no;
  if (!params.out_trade_no || !providerRef) throw new Error("聚合支付通知字段缺失");
  return { orderNo: params.out_trade_no, providerRef, providerRefs: [params.trade_no, params.api_trade_no].filter(Boolean),
    amountCents: cnyToCents(params.money), paymentMethod: paymentMethod(params.type) };
}

export function parseEpayQuery(result: Parameters, expectedOrderNo: string): EpayTrade | null {
  if (!verifyEpayParameters(result)) throw new Error("聚合支付查单验签失败");
  if (String(result.code) !== "0") throw new Error("聚合支付查单失败");
  if (String(result.pid) !== getEpayConfig().pid || result.out_trade_no !== expectedOrderNo) {
    throw new Error("聚合支付查单商户或订单号不匹配");
  }
  const timestamp = String(result.timestamp ?? "");
  if (!/^\d{10}$/.test(timestamp) || Math.abs(Number(timestamp) - Math.floor(Date.now() / 1000)) > 300) {
    throw new Error("聚合支付查单响应已过期");
  }
  // Epay V2 uses 1 for pending and 2 for paid. Do not fulfill while pending.
  if (String(result.status) === "1") return null;
  if (String(result.status) !== "2") throw new Error("聚合支付查单状态无效");
  const providerRef = typeof result.trade_no === "string" && result.trade_no
    ? result.trade_no
    : typeof result.api_trade_no === "string" && result.api_trade_no
      ? result.api_trade_no
      : "";
  if (!providerRef) throw new Error("聚合支付查单流水缺失");
  return { providerRef, providerRefs: [result.trade_no, result.api_trade_no].filter((value): value is string => typeof value === "string" && value.length > 0), amountCents: cnyToCents(String(result.money)), paymentMethod: paymentMethod(result.type) };
}

export async function queryEpayTrade(orderNo: string) {
  const { gateway, pid } = getEpayConfig();
  try {
    const response = await fetch(new URL("api/pay/query", gateway), {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(signEpayParameters({ pid, out_trade_no: orderNo, timestamp: String(Math.floor(Date.now() / 1000)) })),
    });
    if (!response.ok) throw new Error("HTTP error");
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Invalid response");
    return parseEpayQuery(result as Parameters, orderNo);
  } catch (error) {
    // Keep enough observability for live integration issues without logging credentials or response payloads.
    console.error("Epay V2 order query failed", error instanceof Error ? error.message : "Unknown error");
    throw new Error("聚合支付查单未通过，请稍后重试");
  }
}
