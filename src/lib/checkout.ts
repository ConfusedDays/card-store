import { db } from "@/lib/db";
import type { OrderResult } from "@/lib/types";

export function getCheckoutOrder(orderNo: string) {
  return db.prepare(`
    SELECT o.order_no as orderNo, o.amount_cents as amountCents, o.currency,
      o.payment_method as paymentMethod, COALESCE(o.payment_provider, o.payment_method) as paymentProvider, o.status, v.label as variantLabel,
      p.name as productName, v.gift_variant_id as giftVariantId,
      gp.name as giftProductName, gv.label as giftVariantLabel,
      substr(o.email, 1, 2) || '***@' || substr(o.email, instr(o.email, '@') + 1) as maskedEmail
    FROM orders o JOIN variants v ON v.id = o.variant_id JOIN products p ON p.id = v.product_id
      LEFT JOIN variants gv ON gv.id = v.gift_variant_id
      LEFT JOIN products gp ON gp.id = gv.product_id
    WHERE o.order_no = ? AND o.deleted_at IS NULL
  `).get(orderNo) as {
    orderNo: string; amountCents: number; currency: "CNY"; paymentMethod: string;
    status: OrderResult["status"]; variantLabel: string; productName: string; maskedEmail: string; paymentProvider: string;
    giftVariantId: string | null; giftProductName: string | null; giftVariantLabel: string | null;
  } | undefined;
}
