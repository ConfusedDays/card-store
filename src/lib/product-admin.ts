import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

export type AdminProductVariant = {
  id: string;
  label: string;
  durationLabel: string;
  priceCents: number;
  currency: "CNY";
  active: boolean;
};

export type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  accent: string;
  imageUrl: string | null;
  active: boolean;
  sortOrder: number;
  variants: AdminProductVariant[];
};

export type ProductInput = Omit<AdminProduct, "id" | "variants"> & {
  id?: string;
  variants: Array<Omit<AdminProductVariant, "id" | "currency"> & { id?: string }>;
};

type ProductRow = Omit<AdminProduct, "active" | "variants"> & { active: number };
type VariantRow = Omit<AdminProductVariant, "active"> & { productId: string; active: number };

export function getAdminProducts(): AdminProduct[] {
  const products = db.prepare(`
    SELECT id, slug, name, description, category, accent, image_url as imageUrl, active, sort_order as sortOrder
    FROM products ORDER BY sort_order, name
  `).all() as ProductRow[];
  const variants = db.prepare(`
    SELECT id, product_id as productId, label, duration_label as durationLabel,
      price_cents as priceCents, currency, active
    FROM variants ORDER BY product_id, price_cents
  `).all() as VariantRow[];

  return products.map((product) => ({
    ...product,
    active: Boolean(product.active),
    variants: variants
      .filter((variant) => variant.productId === product.id)
      .map((variant) => ({ id: variant.id, label: variant.label, durationLabel: variant.durationLabel, priceCents: variant.priceCents, currency: variant.currency, active: Boolean(variant.active) })),
  }));
}

export function saveProduct(input: ProductInput) {
  const existingSlug = db.prepare("SELECT id FROM products WHERE slug = ?").get(input.slug) as { id: string } | undefined;
  if (existingSlug && existingSlug.id !== input.id) throw new Error("商品链接标识已存在");

  const productId = input.id ?? `prod-${randomUUID()}`;
  const transaction = db.transaction(() => {
    if (input.id) {
      const existing = db.prepare("SELECT id FROM products WHERE id = ?").get(input.id);
      if (!existing) throw new Error("商品不存在");
      db.prepare(`
        UPDATE products SET slug = ?, name = ?, description = ?, category = ?, accent = ?, image_url = ?, active = ?, sort_order = ?
        WHERE id = ?
      `).run(input.slug, input.name, input.description, input.category, input.accent, input.imageUrl, Number(input.active), input.sortOrder, productId);
    } else {
      db.prepare(`
        INSERT INTO products (id, slug, name, description, category, accent, image_url, active, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(productId, input.slug, input.name, input.description, input.category, input.accent, input.imageUrl, Number(input.active), input.sortOrder);
    }

    const submittedVariantIds: string[] = [];
    for (const variant of input.variants) {
      const variantId = variant.id ?? `variant-${randomUUID()}`;
      if (variant.id) {
        const existingVariant = db.prepare("SELECT id FROM variants WHERE id = ? AND product_id = ?").get(variant.id, productId);
        if (!existingVariant) throw new Error("商品规格不存在");
        db.prepare(`
          UPDATE variants SET label = ?, duration_label = ?, price_cents = ?, active = ? WHERE id = ?
        `).run(variant.label, variant.durationLabel, variant.priceCents, Number(variant.active), variantId);
      } else {
        db.prepare(`
          INSERT INTO variants (id, product_id, label, duration_label, price_cents, currency, active)
          VALUES (?, ?, ?, ?, ?, 'CNY', ?)
        `).run(variantId, productId, variant.label, variant.durationLabel, variant.priceCents, Number(variant.active));
      }
      submittedVariantIds.push(variantId);
    }

    const existingVariants = db.prepare("SELECT id FROM variants WHERE product_id = ?").all(productId) as { id: string }[];
    for (const variant of existingVariants) {
      if (!submittedVariantIds.includes(variant.id)) db.prepare("UPDATE variants SET active = 0 WHERE id = ?").run(variant.id);
    }

    db.prepare("INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)")
      .run(input.id ? "product.updated" : "product.created", "product", productId, JSON.stringify({ variants: input.variants.length }));
  });

  transaction();
  return getAdminProducts().find((product) => product.id === productId);
}

export function deleteProduct(productId: string) {
  const product = db.prepare("SELECT id, name FROM products WHERE id = ?").get(productId) as { id: string; name: string } | undefined;
  if (!product) throw new Error("商品不存在");

  const usage = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM license_keys keys INNER JOIN variants ON variants.id = keys.variant_id WHERE variants.product_id = ?) AS keyCount,
      (SELECT COUNT(*) FROM orders INNER JOIN variants ON variants.id = orders.variant_id WHERE variants.product_id = ?) AS orderCount
  `).get(productId, productId) as { keyCount: number; orderCount: number };

  if (usage.orderCount > 0) throw new Error("该商品已有订单记录，不能删除；请改为下架销售");
  if (usage.keyCount > 0) throw new Error("该商品仍有关联卡密，不能删除；请先在卡密管理中清空库存");

  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM variants WHERE product_id = ?").run(productId);
    db.prepare("DELETE FROM products WHERE id = ?").run(productId);
    db.prepare("INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)")
      .run("product.deleted", "product", productId, JSON.stringify({ name: product.name }));
  });
  transaction();
  return { id: productId, name: product.name };
}


export function reorderProducts(productIds: string[]) {
  const existing = db.prepare("SELECT id FROM products").all() as { id: string }[];
  const existingIds = new Set(existing.map((product) => product.id));
  if (productIds.length !== existingIds.size || new Set(productIds).size !== productIds.length || productIds.some((id) => !existingIds.has(id))) {
    throw new Error("商品排序列表无效，请刷新后重试");
  }

  const update = db.prepare("UPDATE products SET sort_order = ? WHERE id = ?");
  const transaction = db.transaction(() => {
    productIds.forEach((id, index) => update.run(index, id));
    db.prepare("INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)")
      .run("products.reordered", "product", "catalog", JSON.stringify({ productIds }));
  });
  transaction();
  return getAdminProducts();
}
