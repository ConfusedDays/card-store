import { db } from "@/lib/db";
import type { OrderResult } from "@/lib/types";

export function getCheckoutOrder(orderNo: string) {
  return db.prepare(`
    SELECT o.order_no as orderNo, o.amount_cents as amountCents, o.currency,
      o.payment_method as paymentMethod, o.status, v.label as variantLabel,
      p.name as productName, substr(o.email, 1, 2) || '***@' || substr(o.email, instr(o.email, '@') + 1) as maskedEmail
    FROM orders o JOIN variants v ON v.id = o.variant_id JOIN products p ON p.id = v.product_id
    WHERE o.order_no = ?
  `).get(orderNo) as {
    orderNo: string; amountCents: number; currency: "CNY"; paymentMethod: string;
    status: OrderResult["status"]; variantLabel: string; productName: string; maskedEmail: string;
  } | undefined;
}
