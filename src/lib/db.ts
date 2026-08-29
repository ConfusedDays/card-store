import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { encryptLicenseKey, keyFingerprint, keyLast4 } from "@/lib/crypto";

const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(process.cwd(), "data", "card-store.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const globalForDb = globalThis as unknown as { cardStoreDb?: Database.Database };
export const db = globalForDb.cardStoreDb ?? new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
if (process.env.NODE_ENV !== "production") globalForDb.cardStoreDb = db;

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    accent TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    label TEXT NOT NULL,
    duration_label TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CNY',
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS license_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    variant_id TEXT NOT NULL REFERENCES variants(id),
    key_ciphertext TEXT NOT NULL,
    key_fingerprint TEXT NOT NULL,
    key_last4 TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','reserved','sold','disabled')),
    order_no TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sold_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_license_keys_stock ON license_keys(variant_id, status);
  CREATE TABLE IF NOT EXISTS orders (
    order_no TEXT PRIMARY KEY,
    variant_id TEXT NOT NULL REFERENCES variants(id),
    email TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CNY',
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','delivered','paid_no_stock','cancelled')),
    payment_ref TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT NOT NULL REFERENCES orders(order_no),
    provider TEXT NOT NULL,
    provider_ref TEXT NOT NULL UNIQUE,
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT NOT NULL UNIQUE REFERENCES orders(order_no),
    license_key_id INTEGER NOT NULL REFERENCES license_keys(id),
    key_ciphertext TEXT NOT NULL,
    delivered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS delivery_emails (
    order_no TEXT PRIMARY KEY REFERENCES orders(order_no),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    message_id TEXT,
    last_error TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TEXT
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
const licenseKeyColumns = db.prepare("PRAGMA table_info(license_keys)").all() as { name: string }[];
if (!licenseKeyColumns.some((column) => column.name === "key_fingerprint")) {
  db.exec("ALTER TABLE license_keys ADD COLUMN key_fingerprint TEXT");
  db.exec("UPDATE license_keys SET key_fingerprint = 'legacy-' || id WHERE key_fingerprint IS NULL");
}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_license_keys_fingerprint ON license_keys(variant_id, key_fingerprint)");

const productColumns = db.prepare("PRAGMA table_info(products)").all() as { name: string }[];
if (!productColumns.some((column) => column.name === "image_url")) {
  try {
    db.exec("ALTER TABLE products ADD COLUMN image_url TEXT");
  } catch (error) {
    const concurrentlyAdded = error instanceof Error && error.message.includes("duplicate column name: image_url");
    if (!concurrentlyAdded) throw error;
  }
}


export function seedCatalog() {
  const product = db.prepare("SELECT id FROM products WHERE slug = ?").get("authorized-software-license") as { id: string } | undefined;
  if (product) return;

  const insertProduct = db.prepare(`INSERT INTO products (id, slug, name, description, category, accent) VALUES (?, ?, ?, ?, ?, ?)`);
  const insertVariant = db.prepare(`INSERT INTO variants (id, product_id, label, duration_label, price_cents) VALUES (?, ?, ?, ?, ?)`);
  const insertKey = db.prepare(`INSERT INTO license_keys (variant_id, key_ciphertext, key_fingerprint, key_last4) VALUES (?, ?, ?, ?)`);
  const seed = db.transaction(() => {
    const productId = "prod-authorized-license";
    insertProduct.run(
      productId,
      "authorized-software-license",
      "Authorized Software License",
      "用于演示合法授权数字商品的自动交付流程。正式上线前请替换为已获得经销授权的商品。",
      "数字授权",
      "cyan",
    );
    const variants = [
      ["variant-license-1d", "日卡", "24 小时", 990],
      ["variant-license-7d", "周卡", "7 天", 3990],
      ["variant-license-30d", "月卡", "30 天", 8990],
    ] as const;
    for (const [id, label, duration, price] of variants) {
      insertVariant.run(id, productId, label, duration, price);
      for (let index = 1; index <= 5; index += 1) {
        const value = `DEMO-${label.replace("卡", "").toUpperCase()}-${String(index).padStart(3, "0")}-AUTHORIZED`;
        insertKey.run(id, encryptLicenseKey(value), keyFingerprint(value), keyLast4(value));
      }
    }
  });
  seed();
}

if (process.env.NODE_ENV !== "production" || process.env.SEED_DEMO_CATALOG === "true") {
  seedCatalog();
}
