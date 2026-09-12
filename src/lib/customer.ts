import { db } from "@/lib/db";
import { getCustomerTickets, type CustomerTicket } from "@/lib/support-tickets";

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
};

export type CustomerDashboard = {
  email: string;
  totals: { totalSpendCents: number; orderCount: number; deliveredCount: number; ticketCount: number };
  orders: CustomerOrder[];
  tickets: CustomerTicket[];
};

export function getCustomerDashboard(email: string): CustomerDashboard {
  const normalized = email.trim().toLowerCase();
  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN o.status IN ('paid', 'delivered', 'paid_no_stock') THEN o.amount_cents ELSE 0 END), 0) AS totalSpendCents,
      COUNT(*) AS orderCount,
      COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END), 0) AS deliveredCount,
      (SELECT COUNT(*) FROM support_tickets t WHERE lower(t.email) = lower(?)) AS ticketCount
    FROM orders o
    WHERE lower(o.email) = lower(?) AND o.deleted_at IS NULL
  `).get(normalized, normalized) as { totalSpendCents: number; orderCount: number; deliveredCount: number; ticketCount: number };
  const orders = db.prepare(`
    SELECT o.order_no AS orderNo, p.name AS productName, v.label AS variantLabel,
      o.amount_cents AS amountCents, o.currency, o.status, o.payment_method AS paymentMethod,
      o.created_at AS createdAt, o.paid_at AS paidAt
    FROM orders o
    JOIN variants v ON v.id = o.variant_id
    JOIN products p ON p.id = v.product_id
    WHERE lower(o.email) = lower(?) AND o.deleted_at IS NULL
    ORDER BY o.created_at DESC
    LIMIT 100
  `).all(normalized) as CustomerOrder[];
  return { email: normalized, totals, orders, tickets: getCustomerTickets(normalized) };
}
