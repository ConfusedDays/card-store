import { db } from "@/lib/db";

export type CustomerOrder = {
  orderNo: string;
  productName: string;
  variantLabel: string;
  amountCents: number;
  currency: "CNY";
  status: "pending" | "paid" | "delivered" | "paid_no_stock" | "cancelled";
  paymentMethod: string;
  createdAt: string;
  paidAt: string | null;
  invoiceId: number | null;
  invoiceStatus: "pending" | "issued" | "rejected" | null;
};

export type CustomerDashboard = {
  email: string;
  totals: { totalSpendCents: number; orderCount: number; deliveredCount: number; invoiceCount: number };
  orders: CustomerOrder[];
};

export function getCustomerDashboard(email: string): CustomerDashboard {
  const normalized = email.trim().toLowerCase();
  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN o.status IN ('paid', 'delivered', 'paid_no_stock') THEN o.amount_cents ELSE 0 END), 0) AS totalSpendCents,
      COUNT(*) AS orderCount,
      COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END), 0) AS deliveredCount,
      (SELECT COUNT(*) FROM invoices i WHERE lower(i.email) = lower(?) AND i.status != 'rejected') AS invoiceCount
    FROM orders o
    WHERE lower(o.email) = lower(?) AND o.deleted_at IS NULL
  `).get(normalized, normalized) as { totalSpendCents: number; orderCount: number; deliveredCount: number; invoiceCount: number };
  const orders = db.prepare(`
    SELECT o.order_no AS orderNo, p.name AS productName, v.label AS variantLabel,
      o.amount_cents AS amountCents, o.currency, o.status, o.payment_method AS paymentMethod,
      o.created_at AS createdAt, o.paid_at AS paidAt,
      i.id AS invoiceId, i.status AS invoiceStatus
    FROM orders o
    JOIN variants v ON v.id = o.variant_id
    JOIN products p ON p.id = v.product_id
    LEFT JOIN invoices i ON i.order_no = o.order_no
    WHERE lower(o.email) = lower(?) AND o.deleted_at IS NULL
    ORDER BY o.created_at DESC
    LIMIT 100
  `).all(normalized) as CustomerOrder[];
  return { email: normalized, totals, orders };
}

export function requestInvoice(input: { email: string; orderNo: string; title: string; taxNo?: string }) {
  const email = input.email.trim().toLowerCase();
  const orderNo = input.orderNo.trim();
  const title = input.title.trim();
  const taxNo = input.taxNo?.trim() || null;
  const order = db.prepare(`
    SELECT order_no AS orderNo, email, amount_cents AS amountCents, status
    FROM orders WHERE order_no = ? AND lower(email) = lower(?) AND deleted_at IS NULL
  `).get(orderNo, email) as { orderNo: string; email: string; amountCents: number; status: string } | undefined;
  if (!order) throw new Error("未找到属于当前账号的订单");
  if (!["paid", "delivered", "paid_no_stock"].includes(order.status)) throw new Error("订单付款确认后才可以申请开票");
  const existing = db.prepare("SELECT id, status FROM invoices WHERE order_no = ?").get(orderNo) as { id: number; status: string } | undefined;
  if (existing) throw new Error(existing.status === "rejected" ? "该订单的开票申请已被驳回，请联系客服" : "该订单已提交开票申请");
  const now = Date.now();
  const result = db.prepare(`
    INSERT INTO invoices (order_no, email, invoice_type, title, tax_no, status, created_at, updated_at)
    VALUES (?, ?, '电子普通发票', ?, ?, 'pending', ?, ?)
  `).run(orderNo, email, title, taxNo, now, now);
  db.prepare("INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)")
    .run("invoice.requested", "invoice", String(result.lastInsertRowid), JSON.stringify({ orderNo, email }));
  return { id: Number(result.lastInsertRowid), orderNo, status: "pending" as const };
}
