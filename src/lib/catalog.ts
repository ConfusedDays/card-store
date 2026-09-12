import { db } from "@/lib/db";
import type { Product, Variant } from "@/lib/types";

export function getStorefrontProducts(): Product[] {
  const products = db.prepare(`
    SELECT id, slug, name, description, category, accent, image_url as imageUrl,
      contact_enabled as contactEnabled
    FROM products WHERE active = 1 ORDER BY sort_order, name
  `).all() as Omit<Product, "variants">[];
  const variants = db.prepare(`
    SELECT v.id, v.product_id as productId, v.label, v.duration_label as durationLabel,
      v.price_cents as priceCents, v.currency, v.gift_variant_id as giftVariantId,
      gp.name as giftProductName, gv.label as giftVariantLabel,
      CASE WHEN v.gift_variant_id IS NULL THEN
        (SELECT COUNT(*) FROM license_keys k WHERE k.variant_id = v.id AND k.status = 'available')
      ELSE MIN(
        (SELECT COUNT(*) FROM license_keys k WHERE k.variant_id = v.id AND k.status = 'available'),
        (SELECT COUNT(*) FROM license_keys k WHERE k.variant_id = v.gift_variant_id AND k.status = 'available')
      ) END as availableCount
    FROM variants v
      LEFT JOIN variants gv ON gv.id = v.gift_variant_id
      LEFT JOIN products gp ON gp.id = gv.product_id
    WHERE v.active = 1 ORDER BY v.price_cents
  `).all() as (Variant & { productId: string })[];
  return products.map((product) => ({
    ...product,
    contactEnabled: Boolean(product.contactEnabled),
    variants: variants.filter((variant) => variant.productId === product.id),
  }));
}

export function getVariant(variantId: string) {
  return db.prepare(`
    SELECT v.id, v.product_id as productId, v.label, v.duration_label as durationLabel,
      v.price_cents as priceCents, v.currency, p.name as productName,
      v.gift_variant_id as giftVariantId, gp.name as giftProductName, gv.label as giftVariantLabel
    FROM variants v JOIN products p ON p.id = v.product_id
      LEFT JOIN variants gv ON gv.id = v.gift_variant_id
      LEFT JOIN products gp ON gp.id = gv.product_id
    WHERE v.id = ? AND v.active = 1 AND p.active = 1
  `).get(variantId) as (Variant & { productId: string; productName: string }) | undefined;
}
