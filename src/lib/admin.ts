import { db } from "@/lib/db";
import { decryptLicenseKey, encryptLicenseKey, keyFingerprint, keyLast4 } from "@/lib/crypto";

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
      o.created_at as createdAt, v.label as variantLabel,
      de.status as emailStatus, de.attempts as emailAttempts, de.sent_at as emailSentAt,
      de.last_error as emailLastError
    FROM orders o JOIN variants v ON v.id = o.variant_id
    LEFT JOIN delivery_emails de ON de.order_no = o.order_no
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

export type AdminInventoryKey = {
  id: number;
  variantId: string;
  productName: string;
  variantLabel: string;
  last4: string;
  key: string;
  status: "available" | "reserved" | "sold" | "disabled";
  orderNo: string | null;
  createdAt: string;
  soldAt: string | null;
};

export function getAdminInventoryKeys(options: { variantId?: string; status?: string; search?: string; limit?: number } = {}) {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (options.variantId) { clauses.push("k.variant_id = ?"); values.push(options.variantId); }
  if (options.status && ["available", "reserved", "sold", "disabled"].includes(options.status)) { clauses.push("k.status = ?"); values.push(options.status); }
  if (options.search) { clauses.push("(k.key_last4 LIKE ? OR k.order_no LIKE ?)"); values.push(`%${options.search.trim()}%`, `%${options.search.trim()}%`); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  values.push(Math.min(Math.max(options.limit ?? 200, 1), 500));
  return db.prepare(`
    SELECT k.id, k.variant_id as variantId, p.name as productName, v.label as variantLabel,
      k.key_ciphertext as ciphertext, k.key_last4 as last4, k.status, k.order_no as orderNo, k.created_at as createdAt, k.sold_at as soldAt
    FROM license_keys k JOIN variants v ON v.id = k.variant_id JOIN products p ON p.id = v.product_id
    ${where} ORDER BY k.id DESC LIMIT ?
  `).all(...values).map((row) => {
    const item = row as Omit<AdminInventoryKey, "key"> & { ciphertext: string };
    const { ciphertext, ...key } = item;
    return { ...key, key: decryptLicenseKey(ciphertext) };
  });
}

export function updateInventoryKeys(ids: number[], status: "available" | "disabled") {
  if (!ids.length) throw new Error("请选择至少一条卡密");
  const placeholders = ids.map(() => "?").join(",");
  const result = db.prepare(`UPDATE license_keys SET status = ? WHERE id IN (${placeholders})`).run(status, ...ids);
  db.prepare("INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)")
    .run("inventory.status_updated", "license_key", ids.join(","), JSON.stringify({ status, updated: result.changes }));
  return { updated: result.changes };
}

export function deleteInventoryKeys(ids: number[]) {
  if (!ids.length) throw new Error("请选择至少一条卡密");
  const placeholders = ids.map(() => "?").join(",");
  const remove = db.transaction(() => {
    const detachedDeliveries = db.prepare(`DELETE FROM deliveries WHERE license_key_id IN (${placeholders})`).run(...ids).changes;
    const deleted = db.prepare(`DELETE FROM license_keys WHERE id IN (${placeholders})`).run(...ids).changes;
    db.prepare("INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)")
      .run("inventory.deleted", "license_key", ids.join(","), JSON.stringify({ deleted, detachedDeliveries }));
    return { deleted, detachedDeliveries };
  });
  return remove();
}
