import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSign, generateKeyPairSync } from "node:crypto";

const testDirectory = mkdtempSync(join(tmpdir(), "card-store-payment-"));
let database: typeof import("./db").db;
let createPendingOrder: typeof import("./order-service").createPendingOrder;
let completePaidOrder: typeof import("./order-service").completePaidOrder;
let trySendDeliveryEmail: typeof import("./delivery-email").trySendDeliveryEmail;
let alipaySigningKey = "";

beforeAll(async () => {
  vi.stubEnv("DATABASE_PATH", join(testDirectory, "test.sqlite"));
  vi.stubEnv("LICENSE_KEY_SECRET", "test-payment-secret");
  const keyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  alipaySigningKey = keyPair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  vi.stubEnv("ALIPAY_PRIVATE_KEY", alipaySigningKey);
  vi.stubEnv("ALIPAY_PUBLIC_KEY", keyPair.publicKey.export({ type: "spki", format: "pem" }).toString());
  vi.stubEnv("ALIPAY_APP_ID", "2026000000000001");
  vi.stubEnv("ALIPAY_SELLER_ID", "2088000000000001");
  vi.stubEnv("ALIPAY_KEY_TYPE", "PKCS8");
  ({ db: database } = await import("./db"));
  ({ createPendingOrder, completePaidOrder } = await import("./order-service"));
  ({ trySendDeliveryEmail } = await import("./delivery-email"));
});

afterAll(() => {
  database.close();
  vi.unstubAllEnvs();
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("paid order fulfillment", () => {
  it("delivers exactly one key when a payment notification is repeated", () => {
    const order = createPendingOrder({
      variantId: "variant-license-1d",
      email: "buyer@example.com",
      paymentMethod: "alipay",
    });
    const input = {
      orderNo: order.orderNo,
      provider: "alipay" as const,
      providerRef: "2026082400000001",
      amountCents: order.amountCents,
    };

    const first = completePaidOrder(input);
    const repeated = completePaidOrder(input);

    expect(first.status).toBe("delivered");
    expect(repeated.licenseKey).toBe(first.licenseKey);
    expect(database.prepare("SELECT count(*) as count FROM payments WHERE order_no = ?").get(order.orderNo))
      .toEqual({ count: 1 });
    expect(database.prepare("SELECT count(*) as count FROM license_keys WHERE order_no = ?").get(order.orderNo))
      .toEqual({ count: 1 });
  });

  it("rejects a payment amount that differs from the order", () => {
    const order = createPendingOrder({
      variantId: "variant-license-7d",
      email: "buyer2@example.com",
      paymentMethod: "alipay",
    });
    expect(() => completePaidOrder({
      orderNo: order.orderNo,
      provider: "alipay",
      providerRef: "2026082400000002",
      amountCents: order.amountCents + 1,
    })).toThrow("支付金额与订单不一致");
    expect(database.prepare("SELECT status FROM orders WHERE order_no = ?").get(order.orderNo))
      .toEqual({ status: "pending" });
  });
  it("accepts a valid RSA2 Alipay notification and delivers the order", async () => {
    const order = createPendingOrder({
      variantId: "variant-license-30d",
      email: "signed@example.com",
      paymentMethod: "alipay",
    });
    const notification: Record<string, string> = {
      app_id: "2026000000000001",
      seller_id: "2088000000000001",
      out_trade_no: order.orderNo,
      trade_no: "2026082400000003",
      trade_status: "TRADE_SUCCESS",
      total_amount: (order.amountCents / 100).toFixed(2),
      sign_type: "RSA2",
    };
    const signContent = Object.keys(notification).sort()
      .map((key) => `${key}=${notification[key]}`)
      .join("&");
    const signer = createSign("RSA-SHA256");
    signer.update(signContent, "utf8");
    notification.sign = signer.sign(alipaySigningKey, "base64");

    const { POST } = await import("@/app/api/payments/alipay/notify/route");
    const response = await POST(new Request("http://localhost/api/payments/alipay/notify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(notification),
    }));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("success");
    expect(database.prepare("SELECT status FROM orders WHERE order_no = ?").get(order.orderNo))
      .toEqual({ status: "delivered" });
  });

  it("emails a delivered key exactly once", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_delivery_key");
    vi.stubEnv("MAIL_FROM", "Reii Shop <delivery@mail.reiishop.cn>");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email_delivery_1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const order = createPendingOrder({
      variantId: "variant-license-7d",
      email: "mail-buyer@example.com",
      paymentMethod: "alipay",
    });
    const delivered = completePaidOrder({
      orderNo: order.orderNo,
      provider: "alipay",
      providerRef: "2026082400000004",
      amountCents: order.amountCents,
    });

    expect(await trySendDeliveryEmail(order.orderNo)).toEqual({ status: "sent" });
    expect(await trySendDeliveryEmail(order.orderNo)).toEqual({ status: "sent" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(new Headers(request.headers).get("idempotency-key")).toBe(`delivery_${order.orderNo}`);
    expect(String(request.body)).toContain(delivered.licenseKey);
    expect(database.prepare("SELECT status, message_id as messageId FROM delivery_emails WHERE order_no = ?").get(order.orderNo))
      .toEqual({ status: "sent", messageId: "email_delivery_1" });
    vi.unstubAllGlobals();
  });
});
