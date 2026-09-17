import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  canonicalBepusdtParameters,
  createBepusdtCheckoutToken,
  createBepusdtOrder,
  parseBepusdtNotification,
  readBepusdtCheckoutToken,
  signBepusdtParameters,
  verifyBepusdtParameters,
} from "./bepusdt";

const directory = mkdtempSync(join(tmpdir(), "card-store-bepusdt-"));
let db: typeof import("./db").db;
let createPendingOrder: typeof import("./order-service").createPendingOrder;
let notify: typeof import("@/app/api/payments/bepusdt/notify/route");

beforeAll(async () => {
  vi.stubEnv("DATABASE_PATH", join(directory, "test.sqlite"));
  vi.stubEnv("LICENSE_KEY_SECRET", "test-only-bepusdt-secret");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("BEPUSDT_URL", "https://gateway.example/");
  vi.stubEnv("BEPUSDT_TOKEN", "test-bepusdt-token");
  vi.stubEnv("APP_URL", "https://shop.example");
  vi.stubEnv("PAYMENT_MODE", "bepusdt");
  ({ db } = await import("./db"));
  ({ createPendingOrder } = await import("./order-service"));
  notify = await import("@/app/api/payments/bepusdt/notify/route");
});

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
afterAll(() => { db.close(); vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); });

function newOrder() {
  return createPendingOrder({ variantId: "variant-license-1d", email: "bepusdt@example.com", paymentMethod: "bepusdt", paymentProvider: "bepusdt" });
}

function notification(order: ReturnType<typeof newOrder>, extra: Record<string, string | number> = {}) {
  return signBepusdtParameters({
    trade_id: `trade-${order.orderNo}`,
    order_id: order.orderNo,
    amount: Number((order.amountCents / 100).toFixed(2)),
    actual_amount: 1.23,
    token: "T-address",
    block_transaction_id: `block-${order.orderNo}`,
    status: 2,
    ...extra,
  });
}

describe("BEpusdt protocol", () => {
  it("sorts and signs JSON values, preserving zero and false", () => {
    expect(canonicalBepusdtParameters({ z: "中文", a: 0, enabled: false, empty: "", signature: "ignored" }))
      .toBe("a=0&enabled=false&z=中文");
    const fields = signBepusdtParameters({ order_id: "KTEST001", amount: 39.9, reselect: true });
    expect(verifyBepusdtParameters(fields)).toBe(true);
    expect(verifyBepusdtParameters({ ...fields, amount: 0.01 })).toBe(false);
  });

  it("creates a server-side cashier order with the configured amount", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status_code: 200, data: { payment_url: "https://gateway.example/pay/cashier/1" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(createBepusdtOrder({ orderNo: "KTEST001", amountCents: 3990, subject: "测试商品" }))
      .resolves.toEqual({ paymentUrl: "https://gateway.example/pay/cashier/1" });
    const [url, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.href).toBe("https://gateway.example/api/v1/order/create-order");
    const fields = JSON.parse(String(options.body)) as Record<string, string | number | boolean>;
    expect(fields.amount).toBe(39.9);
    expect(fields.order_id).toBe("KTEST001");
    expect(verifyBepusdtParameters(fields)).toBe(true);
  });

  it("verifies paid callbacks and ignores signed non-paid states", () => {
    const order = newOrder();
    expect(parseBepusdtNotification(notification(order, { status: 1 }))).toBeNull();
    expect(parseBepusdtNotification(notification(order))).toEqual({
      orderNo: order.orderNo,
      providerRef: `trade-${order.orderNo}`,
      amountCents: order.amountCents,
    });
    expect(() => parseBepusdtNotification({ ...notification(order), amount: 0.01 })).toThrow("验签失败");
  });
});

describe("BEpusdt callback fulfillment", () => {
  it("fulfills a paid order once and acknowledges retries", async () => {
    const order = newOrder();
    const fields = notification(order);
    const request = new Request("https://shop.example/api/payments/bepusdt/notify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fields),
    });
    expect(await (await notify.POST(request)).text()).toBe("success");
    expect(await (await notify.POST(new Request(request.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fields),
    }))).text()).toBe("success");
    expect(db.prepare("SELECT status FROM orders WHERE order_no = ?").get(order.orderNo)).toEqual({ status: "delivered" });
    expect(db.prepare("SELECT count(*) as count FROM payments WHERE order_no = ?").get(order.orderNo)).toEqual({ count: 1 });
    expect(db.prepare("SELECT count(*) as count FROM deliveries WHERE order_no = ?").get(order.orderNo)).toEqual({ count: 1 });
  });

  it("protects the short-lived checkout capability", () => {
    const token = createBepusdtCheckoutToken("KTEST001");
    expect(readBepusdtCheckoutToken(token)).toBe("KTEST001");
    expect(() => readBepusdtCheckoutToken(token.replace("KTEST001", "KOTHER01"))).toThrow();
  });
});
