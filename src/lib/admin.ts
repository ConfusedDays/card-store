import { db } from "@/lib/db";
import { decryptLicenseKey, encryptLicenseKey, keyFingerprint, keyLast4 } from "@/lib/crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

const accessJwksByTeamDomain = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getAccessJwks(teamDomain: string) {
  const cached = accessJwksByTeamDomain.get(teamDomain);
  if (cached) return cached;
  const jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
  accessJwksByTeamDomain.set(teamDomain, jwks);
  return jwks;
}

async function hasValidCloudflareAccessToken(request: Request) {
  const teamDomain = process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN?.replace(/\/$/, "");
  const audience = process.env.CLOUDFLARE_ACCESS_AUD;
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!teamDomain || !audience || !token) return false;

  try {
    await jwtVerify(token, getAccessJwks(teamDomain), { issuer: teamDomain, audience });
    return true;
  } catch {
    return false;
  }
}

export async function isAdminRequest(request: Request) {
  const expected = process.env.ADMIN_TOKEN ?? (process.env.NODE_ENV === "production" ? "" : "dev-admin-token");
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!provided || provided !== expected) return false;
  if (process.env.NODE_ENV !== "production") return true;
  return hasValidCloudflareAccessToken(request);
}

export function getAdminOverview() {
  const totals = db.prepare(`
    SELECT
      COUNT(*) as orders,
      COALESCE(SUM(CASE WHEN status = 'delivered' THEN amount_cents ELSE 0 END), 0) as revenueCents,
      COALESCE(SUM(CASE WHEN status = 'paid_no_stock' THEN 1 ELSE 0 END), 0) as stockIssues
    FROM orders
    WHERE deleted_at IS NULL
  `).get() as { orders: number; revenueCents: number; stockIssues: number };
  const inventory = db.prepare(`
    SELECT v.id as variantId, p.id as productId, p.name as productName, v.label,
      SUM(CASE WHEN k.status = 'available' THEN 1 ELSE 0 END) as available,
      SUM(CASE WHEN k.status = 'sold' THEN 1 ELSE 0 END) as sold,
      v.active
    FROM variants v JOIN products p ON p.id = v.product_id
    LEFT JOIN license_keys k ON k.variant_id = v.id
    GROUP BY v.id ORDER BY v.price_cents
  `).all() as { variantId: string; productId: string; productName: string; label: string; available: number; sold: number; active: number }[];
  const inventoryWithStatus = inventory.map((item) => ({ ...item, active: Boolean(item.active) }));
  const recentOrders = db.prepare(`
    SELECT o.order_no as orderNo, o.email, o.amount_cents as amountCents, o.status,
      o.created_at as createdAt, v.label as variantLabel,
      de.status as emailStatus, de.attempts as emailAttempts, de.sent_at as emailSentAt,
      de.last_error as emailLastError
    FROM orders o JOIN variants v ON v.id = o.variant_id
    LEFT JOIN delivery_emails de ON de.order_no = o.order_no
    WHERE o.deleted_at IS NULL
    ORDER BY o.created_at DESC LIMIT 20
  `).all();
  return { totals, inventory: inventoryWithStatus, recentOrders };
}

export type AdminOrder = {
  orderNo: string;
  email: string;
  amountCents: number;
  status: string;
  createdAt: string;
  variantLabel: string;
  emailStatus: "pending" | "sending" | "sent" | "failed" | null;
  emailAttempts: number | null;
  emailSentAt: string | null;
  emailLastError: string | null;
};

export type RecycleOrder = AdminOrder & { deletedAt: string };

export function getRecycledOrders(): RecycleOrder[] {
  return db.prepare(`
    SELECT o.order_no as orderNo, o.email, o.amount_cents as amountCents, o.status,
      o.created_at as createdAt, o.deleted_at as deletedAt, v.label as variantLabel,
      de.status as emailStatus, de.attempts as emailAttempts, de.sent_at as emailSentAt,
      de.last_error as emailLastError
    FROM orders o JOIN variants v ON v.id = o.variant_id
    LEFT JOIN delivery_emails de ON de.order_no = o.order_no
    WHERE o.deleted_at IS NOT NULL
    ORDER BY o.deleted_at DESC
  `).all() as RecycleOrder[];
}

function orderPlaceholders(orderNos: string[]) {
  if (!orderNos.length) throw new Error("请选择至少一个订单");
  return orderNos.map(() => "?").join(",");
}

export function recycleOrders(orderNos: string[]) {
  const placeholders = orderPlaceholders(orderNos);
  const result = db.prepare(`UPDATE orders SET deleted_at = CURRENT_TIMESTAMP WHERE order_no IN (${placeholders}) AND deleted_at IS NULL`).run(...orderNos);
  if (result.changes) {
    db.prepare("INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)")
      .run("orders.recycled", "order", orderNos.join(","), JSON.stringify({ count: result.changes }));
  }
  return { recycled: result.changes };
}

export function restoreOrders(orderNos: string[]) {
  const placeholders = orderPlaceholders(orderNos);
  const result = db.prepare(`UPDATE orders SET deleted_at = NULL WHERE order_no IN (${placeholders}) AND deleted_at IS NOT NULL`).run(...orderNos);
  if (result.changes) {
    db.prepare("INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)")
      .run("orders.restored", "order", orderNos.join(","), JSON.stringify({ count: result.changes }));
  }
  return { restored: result.changes };
}

export function permanentlyDeleteOrders(orderNos: string[]) {
  const placeholders = orderPlaceholders(orderNos);
  const deleted = db.transaction(() => {
    const existing = db.prepare(`SELECT order_no as orderNo FROM orders WHERE order_no IN (${placeholders}) AND deleted_at IS NOT NULL`).all(...orderNos) as { orderNo: string }[];
    if (!existing.length) return 0;
    const existingNos = existing.map((order) => order.orderNo);
    const existingPlaceholders = orderPlaceholders(existingNos);
    db.prepare(`DELETE FROM order_email_events WHERE order_no IN (${existingPlaceholders})`).run(...existingNos);
    db.prepare(`DELETE FROM delivery_emails WHERE order_no IN (${existingPlaceholders})`).run(...existingNos);
    db.prepare(`DELETE FROM invoices WHERE order_no IN (${existingPlaceholders})`).run(...existingNos);
    db.prepare(`DELETE FROM payments WHERE order_no IN (${existingPlaceholders})`).run(...existingNos);
    db.prepare(`DELETE FROM deliveries WHERE order_no IN (${existingPlaceholders})`).run(...existingNos);
    db.prepare(`UPDATE license_keys SET order_no = NULL WHERE order_no IN (${existingPlaceholders})`).run(...existingNos);
    const result = db.prepare(`DELETE FROM orders WHERE order_no IN (${existingPlaceholders}) AND deleted_at IS NOT NULL`).run(...existingNos);
    db.prepare("INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)")
      .run("orders.permanently_deleted", "order", existingNos.join(","), JSON.stringify({ count: result.changes }));
    return result.changes;
  })();
  return { deleted };
}

export function importLicenseKeys(variantId: string, rawKeys: string[]) {
  const variant = db.prepare(`
    SELECT v.id as variantId, v.label, p.name as productName
    FROM variants v JOIN products p ON p.id = v.product_id
    WHERE v.id = ?
  `).get(variantId) as { variantId: string; label: string; productName: string } | undefined;
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
  return { imported, skipped: keys.length - imported, variant };
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

export function updateInventoryKeys(ids: number[], status: "available" | "disabled" | "sold") {
  if (!ids.length) throw new Error("请选择至少一条卡密");
  const placeholders = ids.map(() => "?").join(",");
  const result = status === "sold"
    ? db.prepare(`UPDATE license_keys SET status = 'sold', sold_at = COALESCE(sold_at, CURRENT_TIMESTAMP) WHERE id IN (${placeholders})`).run(...ids)
    : db.prepare(`UPDATE license_keys SET status = ? WHERE id IN (${placeholders})`).run(status, ...ids);
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
