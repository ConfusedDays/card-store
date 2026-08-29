import { db } from "@/lib/db";
import { decryptLicenseKey } from "@/lib/crypto";
import { getVariant } from "@/lib/catalog";
import type { OrderResult } from "@/lib/types";

type StoredOrder = {
  order_no: string;
  variant_id: string;
  email: string;
  amount_cents: number;
  currency: "CNY";
  payment_method: string;
  payment_ref: string | null;
  status: OrderResult["status"];
  variantLabel: string;
  created_at: string;
};

function makeOrderNo() {
  return `K${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export function createPendingOrder(input: { variantId: string; email: string; paymentMethod: string }) {
  const variant = getVariant(input.variantId);
  if (!variant) throw new Error("商品规格不存在或已下架");
  const orderNo = makeOrderNo();
  db.prepare(`
    INSERT INTO orders (order_no, variant_id, email, amount_cents, currency, payment_method)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(orderNo, input.variantId, input.email.toLowerCase(), variant.priceCents, variant.currency, input.paymentMethod);
  db.prepare(`INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)`)
    .run("order.created", "order", orderNo, JSON.stringify({ paymentMethod: input.paymentMethod }));
  return {
    orderNo,
    amountCents: variant.priceCents,
    currency: variant.currency,
    variantLabel: variant.label,
    productName: variant.productName,
  };
}

export function completeMockPayment(orderNo: string): OrderResult {
  const order = db.prepare("SELECT amount_cents as amountCents FROM orders WHERE order_no = ?")
    .get(orderNo) as { amountCents: number } | undefined;
  if (!order) throw new Error("订单不存在");
  return completePaidOrder({
    orderNo,
    provider: "mock",
    providerRef: `mock_${orderNo}`,
    amountCents: order.amountCents,
  });
}

export function completePaidOrder(input: {
  orderNo: string;
  provider: "mock" | "alipay" | "wechat";
  providerRef: string;
  amountCents: number;
}): OrderResult {
  const tx = db.transaction(() => {
    const order = db.prepare(`
      SELECT o.*, v.label as variantLabel
      FROM orders o JOIN variants v ON v.id = o.variant_id
      WHERE o.order_no = ?
    `).get(input.orderNo) as StoredOrder | undefined;
    if (!order) throw new Error("订单不存在");
    if (input.provider !== "mock" && order.payment_method !== input.provider) {
      throw new Error("订单支付方式不匹配");
    }
    if (order.amount_cents !== input.amountCents) throw new Error("支付金额与订单不一致");

    const existingPayment = db.prepare(`
      SELECT order_no as orderNo, provider, amount_cents as amountCents
      FROM payments WHERE provider_ref = ?
    `).get(input.providerRef) as { orderNo: string; provider: string; amountCents: number } | undefined;
    if (existingPayment && (
      existingPayment.orderNo !== input.orderNo
      || existingPayment.provider !== input.provider
      || existingPayment.amountCents !== input.amountCents
    )) throw new Error("支付流水号已被其他订单使用");

    if (order.status === "delivered" || order.status === "paid_no_stock") {
      if (!existingPayment || order.payment_ref !== input.providerRef) {
        throw new Error("订单已由其他支付完成");
      }
      return toOrderResult(order, order.status === "delivered" ? getDeliveryKey(input.orderNo) : undefined);
    }
    if (order.status === "cancelled") throw new Error("订单已取消");

    if (order.status === "pending") {
      if (existingPayment) throw new Error("支付流水状态异常");
      db.prepare(`
        INSERT INTO payments (order_no, provider, provider_ref, amount_cents, status)
        VALUES (?, ?, ?, ?, 'succeeded')
      `).run(input.orderNo, input.provider, input.providerRef, input.amountCents);
      db.prepare(`
        UPDATE orders SET status = 'paid', payment_ref = ?, paid_at = CURRENT_TIMESTAMP
        WHERE order_no = ? AND status = 'pending'
      `).run(input.providerRef, input.orderNo);
      db.prepare(`INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)`).run(
        "payment.succeeded",
        "order",
        input.orderNo,
        JSON.stringify({ provider: input.provider, providerRef: input.providerRef }),
      );
    } else if (order.status === "paid" && (!existingPayment || order.payment_ref !== input.providerRef)) {
      throw new Error("订单支付流水不匹配");
    }

    const key = db.prepare(`
      SELECT id, key_ciphertext FROM license_keys
      WHERE variant_id = ? AND status = 'available' ORDER BY id LIMIT 1
    `).get(order.variant_id) as { id: number; key_ciphertext: string } | undefined;
    if (!key) {
      db.prepare(`UPDATE orders SET status = 'paid_no_stock' WHERE order_no = ?`).run(input.orderNo);
      db.prepare(`INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)`)
        .run("order.paid_no_stock", "order", input.orderNo, "{}");
      return toOrderResult({ ...order, status: "paid_no_stock" });
    }

    const claimed = db.prepare(`
      UPDATE license_keys SET status = 'sold', order_no = ?, sold_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'available'
    `).run(input.orderNo, key.id);
    if (claimed.changes !== 1) throw new Error("库存分配冲突");
    db.prepare(`INSERT INTO deliveries (order_no, license_key_id, key_ciphertext) VALUES (?, ?, ?)`)
      .run(input.orderNo, key.id, key.key_ciphertext);
    db.prepare(`UPDATE orders SET status = 'delivered' WHERE order_no = ?`).run(input.orderNo);
    db.prepare("INSERT OR IGNORE INTO delivery_emails (order_no) VALUES (?)").run(input.orderNo);
    db.prepare(`INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)`)
      .run("order.delivered", "order", input.orderNo, JSON.stringify({ keyId: key.id }));
    return toOrderResult({ ...order, status: "delivered" }, decryptLicenseKey(key.key_ciphertext));
  });
  return tx() as OrderResult;
}

function getDeliveryKey(orderNo: string) {
  const delivery = db.prepare(`SELECT key_ciphertext FROM deliveries WHERE order_no = ?`).get(orderNo) as { key_ciphertext: string } | undefined;
  return delivery ? decryptLicenseKey(delivery.key_ciphertext) : undefined;
}

function toOrderResult(order: { order_no: string; status: OrderResult["status"]; amount_cents: number; currency: "CNY"; variantLabel: string; email: string; payment_method: string; created_at: string }, key?: string): OrderResult {
  return {
    orderNo: order.order_no,
    status: order.status,
    amountCents: order.amount_cents,
    currency: order.currency,
    variantLabel: order.variantLabel,
    email: order.email,
    paymentMethod: order.payment_method,
    licenseKey: key,
    createdAt: order.created_at,
  };
}

export function getOrderForCustomer(orderNo: string, email: string) {
  const order = db.prepare(`
    SELECT o.*, v.label as variantLabel FROM orders o JOIN variants v ON v.id = o.variant_id
    WHERE o.order_no = ? AND lower(o.email) = lower(?)
  `).get(orderNo, email.trim()) as StoredOrder | undefined;
  if (!order) return undefined;
  return toOrderResult(order, order.status === "delivered" ? getDeliveryKey(orderNo) : undefined);
}
