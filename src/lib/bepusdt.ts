import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { centsToCny, cnyToCents } from "@/lib/payment-money";

type ParameterValue = string | number | boolean | null | undefined;
type Parameters = Record<string, ParameterValue>;

export type BepusdtTrade = {
  orderNo: string;
  providerRef: string;
  amountCents: number;
};

type BepusdtConfig = {
  baseUrl: URL;
  token: string;
  currencies: string;
  timeout: number;
  reselect: boolean;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`BEpusdt 配置缺少 ${name}`);
  return value;
}

function appUrl() {
  const configured = process.env.APP_URL?.trim()
    || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "");
  if (!configured) throw new Error("支付配置缺少 APP_URL");
  const url = new URL(configured);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("生产环境 APP_URL 必须使用 HTTPS");
  }
  return url.origin;
}

export function getBepusdtConfig(): BepusdtConfig {
  const baseUrl = new URL(required("BEPUSDT_URL"));
  if ((process.env.NODE_ENV === "production" && baseUrl.protocol !== "https:")
    || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new Error("BEPUSDT_URL 必须为无凭据和查询参数的 HTTP(S) 网关地址，生产环境必须使用 HTTPS");
  }
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, "")}/`;
  const currencies = process.env.BEPUSDT_CURRENCIES?.trim() || "USDT";
  if (!/^-?[A-Za-z0-9]+(?:,-?[A-Za-z0-9]+)*$/.test(currencies)) {
    throw new Error("BEPUSDT_CURRENCIES 格式无效");
  }
  const timeout = Number(process.env.BEPUSDT_TIMEOUT?.trim() || "600");
  if (!Number.isInteger(timeout) || timeout < 180 || timeout > 86_400) {
    throw new Error("BEPUSDT_TIMEOUT 必须为 180 到 86400 秒之间的整数");
  }
  return {
    baseUrl,
    token: required("BEPUSDT_TOKEN"),
    currencies,
    timeout,
    reselect: process.env.BEPUSDT_RESELECT !== "false",
  };
}

export function canonicalBepusdtParameters(params: Parameters) {
  return Object.keys(params).sort()
    .filter((key) => key !== "signature" && params[key] !== "" && params[key] !== null && params[key] !== undefined)
    .map((key) => {
      const value = params[key];
      if (typeof value === "number" && !Number.isFinite(value)) throw new Error("BEpusdt 参数格式无效");
      if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
        throw new Error("BEpusdt 参数格式无效");
      }
      return `${key}=${String(value)}`;
    }).join("&");
}

export function signBepusdtParameters(params: Parameters) {
  const canonical = canonicalBepusdtParameters(params);
  const signature = createHash("md5").update(`${canonical}${getBepusdtConfig().token}`, "utf8").digest("hex");
  return { ...params, signature };
}

export function verifyBepusdtParameters(params: Parameters) {
  if (typeof params.signature !== "string" || !/^[a-f\d]{32}$/i.test(params.signature)) return false;
  try {
    const expected = createHash("md5")
      .update(`${canonicalBepusdtParameters(params)}${getBepusdtConfig().token}`, "utf8")
      .digest();
    const actual = Buffer.from(params.signature, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function checkoutMac(payload: string) {
  return createHmac("sha256", getBepusdtConfig().token)
    .update(`bepusdt-checkout:${payload}`)
    .digest();
}

export function createBepusdtCheckoutToken(orderNo: string) {
  if (!/^[A-Z0-9]+$/.test(orderNo)) throw new Error("订单号无效");
  const payload = `${orderNo}.${Math.floor(Date.now() / 1000) + 1800}`;
  return `${payload}.${checkoutMac(payload).toString("base64url")}`;
}

export function readBepusdtCheckoutToken(token: string) {
  const match = /^([A-Z0-9]+)\.(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match || Number(match[2]) <= Math.floor(Date.now() / 1000)) throw new Error("支付链接无效或已过期");
  const expected = checkoutMac(`${match[1]}.${match[2]}`);
  const actual = Buffer.from(match[3], "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("支付链接无效或已过期");
  return match[1];
}

export async function createBepusdtOrder(input: { orderNo: string; amountCents: number; subject: string }) {
  const config = getBepusdtConfig();
  const baseUrl = appUrl();
  const fields = signBepusdtParameters({
    order_id: input.orderNo,
    amount: Number(centsToCny(input.amountCents)),
    currencies: config.currencies,
    fiat: "CNY",
    name: input.subject.slice(0, 127),
    notify_url: `${baseUrl}/api/payments/bepusdt/notify`,
    redirect_url: `${baseUrl}/checkout/${encodeURIComponent(input.orderNo)}?payment=returned`,
    timeout: config.timeout,
    reselect: config.reselect,
  });
  let response: Response;
  try {
    response = await fetch(new URL("api/v1/order/create-order", config.baseUrl), {
      method: "POST",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(fields),
    });
  } catch {
    throw new Error("BEpusdt 创建支付订单暂时不可用");
  }
  if (!response.ok) throw new Error("BEpusdt 创建支付订单失败");
  let body: unknown;
  try {
    const text = await response.text();
    if (text.length > 65_536) throw new Error("响应过大");
    body = JSON.parse(text);
  } catch {
    throw new Error("BEpusdt 创建支付订单响应无效");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("BEpusdt 创建支付订单响应无效");
  const result = body as { status_code?: unknown; data?: { payment_url?: unknown } };
  if (result.status_code !== 200 || typeof result.data?.payment_url !== "string") {
    throw new Error("BEpusdt 创建支付订单失败");
  }
  const paymentUrl = new URL(result.data.payment_url);
  if ((paymentUrl.protocol !== "https:" && paymentUrl.protocol !== "http:")
    || (process.env.NODE_ENV === "production" && paymentUrl.protocol !== "https:")) {
    throw new Error("BEpusdt 支付链接无效");
  }
  return { paymentUrl: paymentUrl.href };
}

function stringValue(params: Parameters, key: string) {
  const value = params[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export function parseBepusdtNotification(params: Parameters): BepusdtTrade | null {
  if (!verifyBepusdtParameters(params)) throw new Error("BEpusdt 通知验签失败");
  const status = Number(stringValue(params, "status"));
  if (![1, 2, 3].includes(status)) throw new Error("BEpusdt 通知状态无效");
  if (status !== 2) return null;
  const orderNo = stringValue(params, "order_id");
  const providerRef = stringValue(params, "trade_id");
  const amount = stringValue(params, "amount");
  if (!orderNo || !providerRef || !amount) throw new Error("BEpusdt 通知字段缺失");
  return { orderNo, providerRef, amountCents: cnyToCents(amount) };
}
