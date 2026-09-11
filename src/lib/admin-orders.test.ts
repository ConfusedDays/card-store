import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const testDirectory = mkdtempSync(join(tmpdir(), "card-store-orders-"));
let database: typeof import("./db").db;
let createPendingOrder: typeof import("./order-service").createPendingOrder;
let completePaidOrder: typeof import("./order-service").completePaidOrder;
let manuallyDeliverPendingOrder: typeof import("./order-service").manuallyDeliverPendingOrder;
let getOrderForCustomer: typeof import("./order-service").getOrderForCustomer;
let getAdminOverview: typeof import("./admin").getAdminOverview;
let getRecycledOrders: typeof import("./admin").getRecycledOrders;
let recycleOrders: typeof import("./admin").recycleOrders;
let restoreOrders: typeof import("./admin").restoreOrders;
let permanentlyDeleteOrders: typeof import("./admin").permanentlyDeleteOrders;
let seed: () => void;

beforeAll(async () => {
  vi.stubEnv("DATABASE_PATH", join(testDirectory, "test.sqlite"));
  vi.stubEnv("LICENSE_KEY_SECRET", "test-order-recycle-secret");
  ({ db: database, seedCatalog: seed } = await import("./db"));
  seed();
  ({ createPendingOrder, completePaidOrder, manuallyDeliverPendingOrder, getOrderForCustomer } = await import("./order-service"));
  ({ getAdminOverview, getRecycledOrders, recycleOrders, restoreOrders, permanentlyDeleteOrders } = await import("./admin"));
});

afterAll(() => {
  database.close();
  vi.unstubAllEnvs();
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("admin order recycle bin", () => {
  it("manually delivers a pending order without creating a payment", () => {
    const order = createPendingOrder({ variantId: "variant-license-30d", email: "manual@example.com", paymentMethod: "alipay" });
    const delivered = manuallyDeliverPendingOrder(order.orderNo);

    expect(delivered.status).toBe("delivered");
    expect(database.prepare("SELECT status FROM orders WHERE order_no = ?").get(order.orderNo)).toEqual({ status: "delivered" });
    expect(database.prepare("SELECT count(*) as count FROM payments WHERE order_no = ?").get(order.orderNo)).toEqual({ count: 0 });
    expect(database.prepare("SELECT count(*) as count FROM deliveries WHERE order_no = ?").get(order.orderNo)).toEqual({ count: 1 });
    expect(() => manuallyDeliverPendingOrder(order.orderNo)).toThrow("仅 pending 订单可手动发卡");
    recycleOrders([order.orderNo]);
    permanentlyDeleteOrders([order.orderNo]);
  });

  it("hides recycled orders from overview and restores them", () => {
    const order = createPendingOrder({ variantId: "variant-license-1d", email: "recycle@example.com", paymentMethod: "alipay" });
    expect(recycleOrders([order.orderNo])).toEqual({ recycled: 1 });
    expect(getAdminOverview().totals.orders).toBe(0);
    expect(getRecycledOrders().some((item) => item.orderNo === order.orderNo)).toBe(true);
    expect(getOrderForCustomer(order.orderNo, "recycle@example.com")).toBeUndefined();
    expect(restoreOrders([order.orderNo])).toEqual({ restored: 1 });
    expect(getAdminOverview().totals.orders).toBe(1);
    expect(getOrderForCustomer(order.orderNo, "recycle@example.com")?.orderNo).toBe(order.orderNo);
  });

  it("permanently deletes only orders already in the recycle bin", () => {
    const order = createPendingOrder({ variantId: "variant-license-7d", email: "purge@example.com", paymentMethod: "alipay" });
    completePaidOrder({ orderNo: order.orderNo, provider: "mock", providerRef: `mock_${order.orderNo}`, amountCents: order.amountCents });
    expect(permanentlyDeleteOrders([order.orderNo])).toEqual({ deleted: 0 });
    expect(recycleOrders([order.orderNo])).toEqual({ recycled: 1 });
    expect(permanentlyDeleteOrders([order.orderNo])).toEqual({ deleted: 1 });
    expect(database.prepare("SELECT order_no FROM orders WHERE order_no = ?").get(order.orderNo)).toBeUndefined();
    expect(database.prepare("SELECT order_no FROM payments WHERE order_no = ?").get(order.orderNo)).toBeUndefined();
    expect(database.prepare("SELECT order_no FROM deliveries WHERE order_no = ?").get(order.orderNo)).toBeUndefined();
    expect(database.prepare("SELECT order_no FROM license_keys WHERE order_no = ?").get(order.orderNo)).toBeUndefined();
  });
});
