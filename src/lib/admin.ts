import { db } from "@/lib/db";
import { encryptLicenseKey, keyFingerprint, keyLast4 } from "@/lib/crypto";

export function isAdminRequest(request: Request) {
  const expected = process.env.ADMIN_TOKEN ?? (process.env.NODE_ENV === "production" ? "" : "dev-admin-token");
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(provided && provided === expected);
}

export function getAdminOverview() {
  const totals = db.prepare(`
    SELECT
      COUNT(*) as orders,
      COALESCE(SUM(CASE WHEN status = 'delivered' THEN amount_cents ELSE 0 END), 0) as revenueCents,
      SUM(CASE WHEN status = 'paid_no_stock' THEN 1 ELSE 0 END) as stockIssues
    FROM orders
  `).get() as { orders: number; revenueCents: number; stockIssues: number };
  const inventory = db.prepare(`
    SELECT v.id as variantId, p.name as productName, v.label,
      SUM(CASE WHEN k.status = 'available' THEN 1 ELSE 0 END) as available,
      SUM(CASE WHEN k.status = 'sold' THEN 1 ELSE 0 END) as sold
    FROM variants v JOIN products p ON p.id = v.product_id
    LEFT JOIN license_keys k ON k.variant_id = v.id
    GROUP BY v.id ORDER BY v.price_cents
  `).all();
  const recentOrders = db.prepare(`
    SELECT o.order_no as orderNo, o.email, o.amount_cents as amountCents, o.status,
      o.created_at as createdAt, v.label as variantLabel
    FROM orders o JOIN variants v ON v.id = o.variant_id
    ORDER BY o.created_at DESC LIMIT 20
  `).all();
  return { totals, inventory, recentOrders };
}

export function importLicenseKeys(variantId: string, rawKeys: string[]) {
  const variant = db.prepare("SELECT id FROM variants WHERE id = ?").get(variantId);
  if (!variant) throw new Error("商品规格不存在");
  const keys = [...new Set(rawKeys.map((key) => key.trim()).filter(Boolean))];
  if (keys.length === 0) throw new Error("没有可导入的卡密");
  if (keys.length > 5000) throw new Error("单次最多导入 5000 条卡密");
  const existingFingerprint = db.prepare("SELECT 1 FROM license_keys WHERE variant_id = ? AND key_fingerprint = ? LIMIT 1");
  const insert = db.prepare("INSERT INTO license_keys (variant_id, key_ciphertext, key_fingerprint, key_last4) VALUES (?, ?, ?, ?)");
  let imported = 0;
  const tx = db.transaction(() => {
    for (const value of keys) {
      const fingerprint = keyFingerprint(value);
      if (existingFingerprint.get(variantId, fingerprint)) continue;
      insert.run(variantId, encryptLicenseKey(value), fingerprint, keyLast4(value));
      imported += 1;
    }
    db.prepare(`INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)`)
      .run("inventory.imported", "variant", variantId, JSON.stringify({ imported, submitted: keys.length }));
  });
  tx();
  return { imported, skipped: keys.length - imported };
}
