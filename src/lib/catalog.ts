import { db } from "@/lib/db";
import type { Product, Variant } from "@/lib/types";

export function getStorefrontProducts(): Product[] {
  const products = db.prepare(`
    SELECT id, slug, name, description, category, accent, image_url as imageUrl
    FROM products WHERE active = 1 ORDER BY sort_order, name
  `).all() as Omit<Product, "variants">[];
  const variants = db.prepare(`
    SELECT v.id, v.product_id as productId, v.label, v.duration_label as durationLabel,
      v.price_cents as priceCents, v.currency,
      COALESCE(SUM(CASE WHEN k.status = 'available' THEN 1 ELSE 0 END), 0) as availableCount
    FROM variants v LEFT JOIN license_keys k ON k.variant_id = v.id
    WHERE v.active = 1 GROUP BY v.id ORDER BY v.price_cents
  `).all() as (Variant & { productId: string })[];
  return products.map((product) => ({
    ...product,
    variants: variants.filter((variant) => variant.productId === product.id),
  }));
}

export function getVariant(variantId: string) {
  return db.prepare(`
    SELECT v.id, v.product_id as productId, v.label, v.duration_label as durationLabel,
      v.price_cents as priceCents, v.currency, p.name as productName
    FROM variants v JOIN products p ON p.id = v.product_id
    WHERE v.id = ? AND v.active = 1 AND p.active = 1
  `).get(variantId) as (Variant & { productId: string; productName: string }) | undefined;
}
