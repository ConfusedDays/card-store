import { db } from "@/lib/db";
import { decryptLicenseKey } from "@/lib/crypto";
import { getVariant } from "@/lib/catalog";
import type { DeliveredKey, OrderResult } from "@/lib/types";

type StoredOrder = {
  order_no: string;
  variant_id: string;
  email: string;
  amount_cents: number;
  currency: "CNY";
  payment_method: string;
  payment_provider: string | null;
  payment_ref: string | null;
  status: OrderResult["status"];
  variantLabel: string;
  giftVariantId: string | null;
  productName: string;
  created_at: string;
};

function makeOrderNo() {
  return `K${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export function createPendingOrder(input: { variantId: string; email: string; paymentMethod: string; paymentProvider?: string }) {
  const variant = getVariant(input.variantId);
  if (!variant) throw new Error("商品规格不存在或已下架");
  const orderNo = makeOrderNo();
  db.prepare(`
    INSERT INTO orders (
      order_no, variant_id, email, amount_cents, currency, payment_method,
      terms_accepted_at, terms_version, payment_provider
    )
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
  `).run(orderNo, input.variantId, input.email.toLowerCase(), variant.priceCents, variant.currency, input.paymentMethod, "2026-08-29", input.paymentProvider ?? input.paymentMethod);
  db.prepare(`INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)`)
    .run("order.created", "order", orderNo, JSON.stringify({ paymentMethod: input.paymentMethod, termsVersion: "2026-08-29" }));
  return {
    orderNo,
    amountCents: variant.priceCents,
    currency: variant.currency,
    variantLabel: variant.label,
    productName: variant.productName,
    giftVariantId: variant.giftVariantId,
    giftProductName: variant.giftProductName ?? null,
    giftVariantLabel: variant.giftVariantLabel ?? null,
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
  provider: "mock" | "alipay" | "wechat" | "epay";
  paymentMethod?: string;
  providerRef: string;
  amountCents: number;
}): OrderResult {
  const tx = db.transaction(() => {
    const order = db.prepare(`
      SELECT o.*, v.label as variantLabel, v.gift_variant_id as giftVariantId, p.name as productName
      FROM orders o JOIN variants v ON v.id = o.variant_id JOIN products p ON p.id = v.product_id
      WHERE o.order_no = ? AND o.deleted_at IS NULL
    `).get(input.orderNo) as StoredOrder | undefined;
    if (!order) throw new Error("订单不存在");
    if (input.provider === "mock" && (process.env.NODE_ENV === "production" || order.payment_provider === "epay")) {
      throw new Error("此订单禁止模拟支付");
    }
    if (input.provider !== "mock" && (order.payment_provider ?? order.payment_method) !== input.provider) {
      throw new Error("订单支付平台不匹配");
    }
    if (input.provider !== "mock" && order.payment_method !== (input.provider === "epay" ? input.paymentMethod : input.provider)) {
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

    if (order.status === "delivered") {
      if (!existingPayment || order.payment_ref !== input.providerRef) throw new Error("订单已由其他支付完成");
      return toOrderResult(order, getDeliveredLicenseKeys(input.orderNo));
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
    } else if ((order.status === "paid" || order.status === "paid_no_stock") && (!existingPayment || order.payment_ref !== input.providerRef)) {
      throw new Error("支付流水不匹配");
    }

    const delivered = fulfillOrder(order);
    if (!delivered) {
      db.prepare(`UPDATE orders SET status = 'paid_no_stock' WHERE order_no = ?`).run(input.orderNo);
      db.prepare(`INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)`)
        .run("order.paid_no_stock", "order", input.orderNo, "{}");
      return toOrderResult({ ...order, status: "paid_no_stock" });
    }
    return toOrderResult({ ...order, status: "delivered" }, delivered);
  });
  return tx() as OrderResult;
}

/** Issue the purchased key and any configured gift atomically. */
export function manuallyDeliverPendingOrder(orderNo: string): OrderResult {
  const tx = db.transaction(() => {
    const order = db.prepare(`
      SELECT o.*, v.label as variantLabel, v.gift_variant_id as giftVariantId, p.name as productName
      FROM orders o JOIN variants v ON v.id = o.variant_id JOIN products p ON p.id = v.product_id
      WHERE o.order_no = ? AND o.deleted_at IS NULL
    `).get(orderNo) as StoredOrder | undefined;
    if (!order) throw new Error("订单不存在");
    if (order.status !== "pending" && order.status !== "paid_no_stock") throw new Error(`订单当前状态为 ${order.status}，仅 pending 或等待补货订单可手动发卡`);

    const delivered = fulfillOrder(order);
    if (!delivered) throw new Error("该规格或赠送规格暂无可用卡密，无法手动发卡");
    db.prepare("INSERT OR IGNORE INTO delivery_emails (order_no) VALUES (?)").run(orderNo);
    db.prepare("INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)")
      .run("order.manually_delivered", "order", orderNo, JSON.stringify({ gift: delivered.length > 1 }));
    return toOrderResult({ ...order, status: "delivered" }, delivered);
  });
  return tx() as OrderResult;
}

type AvailableKey = {
  id: number;
  key_ciphertext: string;
  variant_id: string;
  productName: string;
  variantLabel: string;
};

function availableKey(variantId: string, excludedId?: number) {
  return db.prepare(`
    SELECT k.id, k.key_ciphertext, k.variant_id,
      p.name as productName, v.label as variantLabel
    FROM license_keys k JOIN variants v ON v.id = k.variant_id JOIN products p ON p.id = v.product_id
    WHERE k.variant_id = ? AND k.status = 'available' ${excludedId ? "AND k.id != ?" : ""}
    ORDER BY k.id LIMIT 1
  `).get(...(excludedId ? [variantId, excludedId] : [variantId])) as AvailableKey | undefined;
}

function fulfillOrder(order: StoredOrder): DeliveredKey[] | null {
  const primary = availableKey(order.variant_id);
  if (!primary) return null;
  const gift = order.giftVariantId ? availableKey(order.giftVariantId, primary.id) : undefined;
  if (order.giftVariantId && !gift) return null;

  const keys = gift ? [primary, gift] : [primary];
  for (const key of keys) {
    const claimed = db.prepare(`
      UPDATE license_keys SET status = 'sold', order_no = ?, sold_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'available'
    `).run(order.order_no, key.id);
    if (claimed.changes !== 1) throw new Error("库存分配冲突，请刷新后重试");
  }
  db.prepare("INSERT INTO deliveries (order_no, license_key_id, key_ciphertext) VALUES (?, ?, ?)")
    .run(order.order_no, primary.id, primary.key_ciphertext);
  if (gift) {
    db.prepare("INSERT INTO delivery_items (order_no, variant_id, license_key_id, key_ciphertext, item_type) VALUES (?, ?, ?, ?, 'gift')")
      .run(order.order_no, gift.variant_id, gift.id, gift.key_ciphertext);
  }
  db.prepare("UPDATE orders SET status = 'delivered' WHERE order_no = ?").run(order.order_no);
  db.prepare("INSERT OR IGNORE INTO delivery_emails (order_no) VALUES (?)").run(order.order_no);
  db.prepare("INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)")
    .run("order.delivered", "order", order.order_no, JSON.stringify({ keyIds: keys.map((key) => key.id), gift: Boolean(gift) }));
  return keys.map((key, index) => ({
    key: decryptLicenseKey(key.key_ciphertext),
    isGift: index > 0,
    productName: key.productName,
    variantLabel: key.variantLabel,
  }));
}

export function getDeliveredLicenseKeys(orderNo: string): DeliveredKey[] {
  const rows = db.prepare(`
    SELECT d.key_ciphertext AS keyCiphertext, 0 AS isGift,
      p.name AS productName, v.label AS variantLabel
    FROM deliveries d
    JOIN orders o ON o.order_no = d.order_no
    JOIN variants v ON v.id = o.variant_id
    JOIN products p ON p.id = v.product_id
    WHERE d.order_no = ?
    UNION ALL
    SELECT di.key_ciphertext AS keyCiphertext, 1 AS isGift,
      p.name AS productName, v.label AS variantLabel
    FROM delivery_items di
    JOIN variants v ON v.id = di.variant_id
    JOIN products p ON p.id = v.product_id
    WHERE di.order_no = ?
    ORDER BY isGift
  `).all(orderNo, orderNo) as { keyCiphertext: string; isGift: number; productName: string; variantLabel: string }[];
  return rows.map((row) => ({ key: decryptLicenseKey(row.keyCiphertext), isGift: Boolean(row.isGift), productName: row.productName, variantLabel: row.variantLabel }));
}

function toOrderResult(order: { order_no: string; status: OrderResult["status"]; amount_cents: number; currency: "CNY"; variantLabel: string; email: string; payment_method: string; created_at: string }, keys: DeliveredKey[] = []): OrderResult {
  return {
    orderNo: order.order_no,
    status: order.status,
    amountCents: order.amount_cents,
    currency: order.currency,
    variantLabel: order.variantLabel,
    email: order.email,
    paymentMethod: order.payment_method,
    licenseKey: keys[0]?.key,
    licenseKeys: keys.length ? keys : undefined,
    createdAt: order.created_at,
  };
}

export function getOrderForCustomer(orderNo: string, email: string) {
  const order = db.prepare(`
    SELECT o.*, v.label as variantLabel, v.gift_variant_id as giftVariantId, p.name as productName
    FROM orders o JOIN variants v ON v.id = o.variant_id JOIN products p ON p.id = v.product_id
    WHERE o.order_no = ? AND lower(o.email) = lower(?) AND o.deleted_at IS NULL
  `).get(orderNo, email.trim()) as StoredOrder | undefined;
  if (!order) return undefined;
  return toOrderResult(order, order.status === "delivered" ? getDeliveredLicenseKeys(orderNo) : []);
}
