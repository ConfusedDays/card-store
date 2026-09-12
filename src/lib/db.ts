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
try {
  db.pragma("journal_mode = WAL");
} catch (error) {
  // During a concurrent production build another worker may already be changing
  // the journal mode. The existing mode remains safe to use, so avoid failing
  // the build solely because that one-time optimization is temporarily locked.
  if ((error as { code?: string }).code !== "SQLITE_BUSY") throw error;
}
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
    contact_enabled INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    label TEXT NOT NULL,
    duration_label TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CNY',
    active INTEGER NOT NULL DEFAULT 1,
    gift_variant_id TEXT REFERENCES variants(id)
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
    paid_at TEXT,
    terms_accepted_at TEXT,
    terms_version TEXT,
    deleted_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
  CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON orders(deleted_at);
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
  CREATE TABLE IF NOT EXISTS delivery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT NOT NULL REFERENCES orders(order_no),
    variant_id TEXT NOT NULL REFERENCES variants(id),
    license_key_id INTEGER NOT NULL REFERENCES license_keys(id),
    key_ciphertext TEXT NOT NULL,
    item_type TEXT NOT NULL DEFAULT 'gift' CHECK(item_type IN ('gift')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_delivery_items_order ON delivery_items(order_no);
  CREATE TABLE IF NOT EXISTS delivery_emails (
    order_no TEXT PRIMARY KEY REFERENCES orders(order_no),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    message_id TEXT,
    last_error TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TEXT
  );
  CREATE TABLE IF NOT EXISTS order_email_events (
    order_no TEXT NOT NULL REFERENCES orders(order_no),
    event_type TEXT NOT NULL CHECK(event_type IN ('order_created','payment_succeeded','status_paid_no_stock')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    message_id TEXT,
    last_error TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TEXT,
    PRIMARY KEY (order_no, event_type)
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS customer_login_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL,
    consumed_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_customer_login_codes_email ON customer_login_codes(email, created_at DESC);
  CREATE TABLE IF NOT EXISTS customer_sessions (
    token_hash TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_customer_sessions_email ON customer_sessions(email);
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT NOT NULL UNIQUE REFERENCES orders(order_no),
    email TEXT NOT NULL,
    invoice_type TEXT NOT NULL DEFAULT '电子普通发票',
    title TEXT NOT NULL,
    tax_no TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','issued','rejected')),
    invoice_url TEXT,
    remark TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_invoices_email ON invoices(email, created_at DESC);
  CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_no TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    order_no TEXT REFERENCES orders(order_no),
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'processing', 'resolved', 'closed')),
    admin_note TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    resolved_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_support_tickets_email ON support_tickets(email, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, updated_at DESC);
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

const variantColumns = db.prepare("PRAGMA table_info(variants)").all() as { name: string }[];
if (!variantColumns.some((column) => column.name === "gift_variant_id")) {
  try {
    db.exec("ALTER TABLE variants ADD COLUMN gift_variant_id TEXT REFERENCES variants(id)");
  } catch (error) {
    const concurrentlyAdded = error instanceof Error && error.message.includes("duplicate column name: gift_variant_id");
    if (!concurrentlyAdded) throw error;
  }
}
if (!productColumns.some((column) => column.name === "contact_enabled")) {
  try {
    db.exec("ALTER TABLE products ADD COLUMN contact_enabled INTEGER NOT NULL DEFAULT 0");
  } catch (error) {
    const concurrentlyAdded = error instanceof Error && error.message.includes("duplicate column name: contact_enabled");
    if (!concurrentlyAdded) throw error;
  }
}

const orderColumns = db.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
for (const [column, definition] of [
  ["terms_accepted_at", "TEXT"],
  ["terms_version", "TEXT"],
  ["payment_provider", "TEXT"],
  ["deleted_at", "TEXT"],
] as const) {
  if (orderColumns.some((item) => item.name === column)) continue;
  try {
    db.exec(`ALTER TABLE orders ADD COLUMN ${column} ${definition}`);
  } catch (error) {
    const concurrentlyAdded = error instanceof Error && error.message.includes(`duplicate column name: ${column}`);
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
