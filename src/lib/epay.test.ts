import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, sign, verify } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalEpayParameters, createEpayCheckoutToken, createEpayPagePayment, getEpayConfig, parseEpayNotification, parseEpayQuery, readEpayCheckoutToken, signEpayParameters, verifyEpayParameters } from "./epay";
import { createPaymentCheckout } from "./payment-provider";

const merchant = generateKeyPairSync("rsa", { modulusLength: 2048 });
const platform = generateKeyPairSync("rsa", { modulusLength: 2048 });
const directory = mkdtempSync(join(tmpdir(), "card-store-epay-"));
let db: typeof import("./db").db;
let createPendingOrder: typeof import("./order-service").createPendingOrder;
let completeMockPayment: typeof import("./order-service").completeMockPayment;
let notify: typeof import("@/app/api/payments/epay/notify/route");

type Fields = Record<string, string | number>;
// Independent fixture signer: never reads production configuration or secrets.
function platformSigned(fields: Fields) {
  const content = Object.entries(fields).filter(([key, value]) => !["sign", "sign_type"].includes(key) && value !== "")
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => `${key}=${value}`).join("&");
  return { ...fields, sign_type: "RSA", sign: sign("sha256", Buffer.from(content), platform.privateKey).toString("base64") };
}

function newOrder(method = "alipay", provider = "epay") {
  return createPendingOrder({ variantId: "variant-license-1d", email: "epay-test@example.com", paymentMethod: method, paymentProvider: provider });
}

function notification(order: ReturnType<typeof newOrder>, extra: Fields = {}) {
  return platformSigned({ pid: "1000", trade_no: `T${order.orderNo}`, out_trade_no: order.orderNo,
    type: "alipay", money: (order.amountCents / 100).toFixed(2), name: "测试商品 & 中文", trade_status: "TRADE_SUCCESS", ...extra });
}

function query(order: ReturnType<typeof newOrder>, extra: Fields = {}) {
  return platformSigned({ pid: "1000", code: 0, status: 2, trade_no: `T${order.orderNo}`, out_trade_no: order.orderNo,
    type: "alipay", money: (order.amountCents / 100).toFixed(2), timestamp: String(Math.floor(Date.now() / 1000)), ...extra });
}

function mockQuery(fields: Fields) {
  const fetchMock = vi.fn().mockImplementation(async () => Response.json(fields));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function request(fields: Fields, method = "POST") {
  const params = new URLSearchParams(Object.entries(fields).map(([key, value]) => [key, String(value)]));
  return new Request(`https://shop.example/api/payments/epay/notify${method === "GET" ? `?${params}` : ""}`, {
    method, ...(method === "POST" ? { headers: { "content-type": "application/x-www-form-urlencoded" }, body: params } : {}),
  });
}

function assertPending(orderNo: string) {
  expect(db.prepare("SELECT status FROM orders WHERE order_no = ?").get(orderNo)).toEqual({ status: "pending" });
  expect(db.prepare("SELECT count(*) as count FROM payments WHERE order_no = ?").get(orderNo)).toEqual({ count: 0 });
  expect(db.prepare("SELECT count(*) as count FROM deliveries WHERE order_no = ?").get(orderNo)).toEqual({ count: 0 });
}

beforeAll(async () => {
  vi.stubEnv("DATABASE_PATH", join(directory, "test.sqlite"));
  vi.stubEnv("LICENSE_KEY_SECRET", "test-only-epay-secret");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("EPAY_GATEWAY", "https://gateway.example/xpay/epayn/");
  vi.stubEnv("EPAY_PID", "1000");
  vi.stubEnv("EPAY_PRIVATE_KEY", merchant.privateKey.export({ type: "pkcs8", format: "pem" }).toString());
  vi.stubEnv("EPAY_PUBLIC_KEY", platform.publicKey.export({ type: "spki", format: "pem" }).toString());
  vi.stubEnv("PAYMENT_MODE", "epay");
  vi.stubEnv("APP_URL", "https://shop.example");
  ({ db } = await import("./db"));
  ({ createPendingOrder, completeMockPayment } = await import("./order-service"));
  notify = await import("@/app/api/payments/epay/notify/route");
});

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
afterAll(() => { db.close(); vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); });

describe("V2 RSA protocol", () => {
  it("sorts raw UTF-8 values, excludes only signature fields and empty values, and preserves zero", () => {
    expect(canonicalEpayParameters({ z: "中文 & a=b", a: 0, empty: "", absent: null, sign: "ignored", sign_type: "RSA" }))
      .toBe("a=0&z=中文 & a=b");
    const fields = signEpayParameters({ z: "中文 & a=b", a: "0", empty: "" });
    expect(verify("sha256", Buffer.from("a=0&z=中文 & a=b"), merchant.publicKey, Buffer.from(fields.sign, "base64"))).toBe(true);
    expect(fields.sign_type).toBe("RSA");
  });

  it("uses the platform public key and rejects tampering, downgrade, or missing signatures", () => {
    const fields = platformSigned({ code: 0, money: "1.00" });
    expect(verifyEpayParameters(fields)).toBe(true);
    expect(verifyEpayParameters({ ...fields, money: "0.01" })).toBe(false);
    expect(verifyEpayParameters({ ...fields, sign_type: "MD5" })).toBe(false);
    expect(verifyEpayParameters({ code: 0 })).toBe(false);
    expect(verifyEpayParameters(signEpayParameters({ money: "1.00" }))).toBe(false);
  });

  it("normalizes bare Base64 and escaped PEM keys", () => {
    const originalPrivate = process.env.EPAY_PRIVATE_KEY!;
    const originalPublic = process.env.EPAY_PUBLIC_KEY!;
    try {
      vi.stubEnv("EPAY_PRIVATE_KEY", merchant.privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"));
      vi.stubEnv("EPAY_PUBLIC_KEY", originalPublic.replace(/\n/g, "\\n"));
      expect(getEpayConfig().privateKey.asymmetricKeyType).toBe("rsa");
    } finally {
      vi.stubEnv("EPAY_PRIVATE_KEY", originalPrivate);
      vi.stubEnv("EPAY_PUBLIC_KEY", originalPublic);
    }
  });

  it("rejects expired and mismatched signed query responses", () => {
    const order = newOrder();
    expect(parseEpayQuery(query(order, { status: 1 }), order.orderNo)).toBeNull();
    expect(() => parseEpayQuery(query(order, { timestamp: "1700000000" }), order.orderNo)).toThrow("已过期");
    expect(() => parseEpayQuery(query(order, { pid: "9999" }), order.orderNo)).toThrow("不匹配");
    expect(() => parseEpayQuery(query(order, { out_trade_no: "OTHER" }), order.orderNo)).toThrow("不匹配");
    expect(() => parseEpayQuery(query(order, { status: 3 }), order.orderNo)).toThrow("状态无效");
    expect(() => parseEpayQuery(query(order, { money: "1e2" }), order.orderNo)).toThrow();
  });

  it("accepts the alternate platform trade number field", () => {
    const order = newOrder();
    const trade = parseEpayQuery(query(order, { trade_no: "", api_trade_no: `API${order.orderNo}` }), order.orderNo);
    expect(trade?.providerRef).toBe(`API${order.orderNo}`);
    const callback = parseEpayNotification(notification(order, { trade_no: "", api_trade_no: `API${order.orderNo}` }));
    expect(callback?.providerRef).toBe(`API${order.orderNo}`);
    const merchantRef = parseEpayQuery(query(order, { trade_no: "", api_trade_no: "" }), order.orderNo);
    expect(merchantRef?.providerRef).toBe(order.orderNo);
  });
});

describe("checkout handoff", () => {
  it("uses the configured HTTPS POST gateway and server order amount", async () => {
    const order = newOrder();
    const checkout = createPaymentCheckout({ ...order, paymentMethod: "alipay", subject: "测试" });
    expect(checkout.provider).toBe("epay");
    const { GET } = await import("@/app/api/payments/epay/checkout/route");
    const response = await GET(new Request(`https://shop.example${checkout.checkoutUrl}&money=0.01`));
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('method="post" action="https://gateway.example/xpay/epayn/api/pay/submit"');
    expect(html).toContain(`name="money" value="${(order.amountCents / 100).toFixed(2)}"`);
    expect(html).not.toContain(process.env.EPAY_PRIVATE_KEY);
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const fields = createEpayPagePayment({ ...order, paymentMethod: "wechat", subject: '<x>"&' }, "https://shop.example");
    expect(fields.fields.type).toBe("wxpay");
    expect(fields.fields.notify_url).toBe("https://shop.example/api/payments/epay/notify");
  });

  it("rejects forged/expired checkout capabilities and prevents simulated fulfillment", () => {
    const order = newOrder();
    const token = createEpayCheckoutToken(order.orderNo);
    expect(readEpayCheckoutToken(token)).toBe(order.orderNo);
    expect(() => readEpayCheckoutToken(token.replace(order.orderNo, "OTHER"))).toThrow();
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 1801_000);
    expect(() => readEpayCheckoutToken(token)).toThrow();
    expect(() => completeMockPayment(order.orderNo)).toThrow("禁止模拟支付");
    assertPending(order.orderNo);
  });
});

describe("verified callback + active query + transactional fulfillment", () => {
  it("delivers once across concurrent GET/POST retries and signs the query", async () => {
    const order = newOrder();
    const fetchMock = mockQuery(query(order));
    const responses = await Promise.all([notify.POST(request(notification(order))), notify.GET(request(notification(order), "GET"))]);
    expect(await Promise.all(responses.map((response) => response.text()))).toEqual(["success", "success"]);
    expect(db.prepare("SELECT count(*) as count FROM deliveries WHERE order_no = ?").get(order.orderNo)).toEqual({ count: 1 });
    expect(db.prepare("SELECT count(*) as count FROM payments WHERE order_no = ?").get(order.orderNo)).toEqual({ count: 1 });
    expect(db.prepare("SELECT count(*) as count FROM license_keys WHERE order_no = ?").get(order.orderNo)).toEqual({ count: 1 });
    const [url, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.href).toBe("https://gateway.example/xpay/epayn/api/pay/query");
    expect(options.redirect).toBe("error");
    const fields = Object.fromEntries(new URLSearchParams(String(options.body)));
    expect(fields.out_trade_no).toBe(order.orderNo);
    expect(verify("sha256", Buffer.from(canonicalEpayParameters(fields)), merchant.publicKey, Buffer.from(fields.sign, "base64"))).toBe(true);
  });

  it.each([
    ["bad signature", { sign: "invalid" }],
    ["wrong merchant", { pid: "9999" }],
    ["wrong amount", { money: "0.01" }],
    ["wrong channel", { type: "wxpay" }],
  ])("rejects %s before querying or issuing a key", async (_, fields) => {
    const order = newOrder();
    const fetchMock = mockQuery(query(order));
    const signed = notification(order, fields);
    if ("sign" in fields) signed.sign = "invalid";
    expect(await (await notify.POST(request(signed))).text()).toBe("failure");
    expect(fetchMock).not.toHaveBeenCalled();
    assertPending(order.orderNo);
  });

  it.each([
    ["unpaid", { status: 0 }], ["wrong order", { out_trade_no: "OTHER" }],
    ["wrong merchant", { pid: "9999" }], ["wrong amount", { money: "0.01" }],
    ["wrong reference", { trade_no: "OTHER" }], ["wrong channel", { type: "wxpay" }],
    ["provider error", { code: -1 }],
  ])("does not fulfill a signed notification when query reports %s", async (_, fields) => {
    const order = newOrder();
    mockQuery(query(order, fields));
    const response = await notify.POST(request(notification(order)));
    expect(await response.text()).toBe("failure");
    assertPending(order.orderNo);
  });

  it("rejects duplicate callback fields and unsigned query responses", async () => {
    const order = newOrder();
    const fields = query(order);
    mockQuery({ ...fields, sign: "invalid" });
    expect(await (await notify.POST(request(notification(order)))).text()).toBe("failure");
    const valid = request(notification(order), "GET");
    expect((await notify.GET(new Request(`${valid.url}&money=0.01`))).status).toBe(400);
    assertPending(order.orderNo);
  });

  it("fulfills from an authenticated callback when the query temporarily fails", async () => {
    const order = newOrder();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("test network timeout")));
    expect(await (await notify.POST(request(notification(order)))).text()).toBe("success");
    expect(db.prepare("SELECT status FROM orders WHERE order_no = ?").get(order.orderNo)).toEqual({ status: "delivered" });
    mockQuery(query(order));
    expect(await (await notify.POST(request(notification(order)))).text()).toBe("success");
  });

  it("rejects cross-provider callbacks even with valid platform signatures", async () => {
    const order = newOrder("alipay", "alipay");
    const fetchMock = mockQuery(query(order));
    expect(await (await notify.POST(request(notification(order)))).text()).toBe("failure");
    expect(fetchMock).not.toHaveBeenCalled();
    assertPending(order.orderNo);
  });

  it("reconciles a returned customer using active query and ignores browser payment assertions", async () => {
    const order = newOrder();
    const { GET } = await import("@/app/api/orders/[orderNo]/route");
    const context = { params: Promise.resolve({ orderNo: order.orderNo }) };
    const fetchMock = mockQuery(query(order));
    expect((await GET(new Request(`https://shop.example/api/orders/${order.orderNo}?email=wrong@example.com&reconcile=payment`), context)).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
    const browserOnly = await GET(new Request(`https://shop.example/api/orders/${order.orderNo}?email=epay-test@example.com&payment=returned&status=1`), context);
    expect((await browserOnly.json()).status).toBe("pending");
    expect(fetchMock).not.toHaveBeenCalled();
    const response = await GET(new Request(`https://shop.example/api/orders/${order.orderNo}?email=epay-test@example.com&reconcile=payment&status=1&money=0.01`), context);
    expect((await response.json()).status).toBe("delivered");
  });

  it("keeps a pending order viewable when the payment query is temporarily unavailable", async () => {
    const order = newOrder();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("temporary gateway timeout")));
    const { GET } = await import("@/app/api/orders/[orderNo]/route");
    const response = await GET(new Request(`https://shop.example/api/orders/${order.orderNo}?email=epay-test@example.com&reconcile=payment`), {
      params: Promise.resolve({ orderNo: order.orderNo }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("pending");
  });

  it("fulfills the wxpay channel as wechat", async () => {
    const order = newOrder("wechat");
    mockQuery(query(order, { type: "wxpay" }));
    expect(await (await notify.POST(request(notification(order, { type: "wxpay" })))).text()).toBe("success");
    expect(db.prepare("SELECT status FROM orders WHERE order_no = ?").get(order.orderNo)).toEqual({ status: "delivered" });
  });

  it("rejects reuse of a paid platform reference for another order", async () => {
    const first = newOrder();
    mockQuery(query(first));
    expect(await (await notify.POST(request(notification(first)))).text()).toBe("success");
    const second = newOrder();
    const trade = { trade_no: `T${first.orderNo}` };
    mockQuery(query(second, trade));
    expect(await (await notify.POST(request(notification(second, trade)))).text()).toBe("failure");
    assertPending(second.orderNo);
  });

  it("rejects cancelled orders and handoff for completed orders", async () => {
    const order = newOrder();
    db.prepare("UPDATE orders SET status = 'cancelled' WHERE order_no = ?").run(order.orderNo);
    const fetchMock = mockQuery(query(order));
    expect(await (await notify.POST(request(notification(order)))).text()).toBe("failure");
    expect(fetchMock).not.toHaveBeenCalled();
    const { GET } = await import("@/app/api/payments/epay/checkout/route");
    expect((await GET(new Request(`https://shop.example/api/payments/epay/checkout?token=${createEpayCheckoutToken(order.orderNo)}`))).status).toBe(409);
  });

  it("records a paid order without stock once and acknowledges retries", async () => {
    db.prepare("UPDATE license_keys SET status = 'disabled' WHERE variant_id = 'variant-license-1d' AND status = 'available'").run();
    const order = newOrder();
    mockQuery(query(order));
    for (let attempt = 0; attempt < 2; attempt++) {
      expect(await (await notify.POST(request(notification(order)))).text()).toBe("success");
    }
    expect(db.prepare("SELECT status FROM orders WHERE order_no = ?").get(order.orderNo)).toEqual({ status: "paid_no_stock" });
    expect(db.prepare("SELECT count(*) as count FROM payments WHERE order_no = ?").get(order.orderNo)).toEqual({ count: 1 });
    expect(db.prepare("SELECT count(*) as count FROM deliveries WHERE order_no = ?").get(order.orderNo)).toEqual({ count: 0 });
  });
});
