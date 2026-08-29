import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { detectProductImageType, isValidProductImageFilename, productImageDirectory } from "@/lib/product-images";

const BACKUP_FORMAT = "reii-card-store-backup";
const ENVELOPE_FORMAT = "reii-card-store-encrypted-backup";
const BACKUP_VERSION = 1;
const MAX_IMAGE_BYTES = 64 * 1024 * 1024;
export const MAX_BACKUP_FILE_BYTES = 120 * 1024 * 1024;

const tables = [
  "products",
  "variants",
  "license_keys",
  "orders",
  "payments",
  "deliveries",
  "delivery_emails",
  "audit_logs",
] as const;

type TableName = (typeof tables)[number];
type BackupRow = Record<string, string | number | null>;

type BackupImage = {
  filename: string;
  data: string;
};

type BackupPayload = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  tables: Record<TableName, BackupRow[]>;
  images: BackupImage[];
};

type EncryptedEnvelope = {
  format: typeof ENVELOPE_FORMAT;
  version: typeof BACKUP_VERSION;
  kdf: "scrypt";
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

function assertPassphrase(passphrase: string) {
  if (passphrase.length < 10) throw new Error("备份密码至少需要 10 个字符");
  if (passphrase.length > 200) throw new Error("备份密码过长");
}

function encryptionKey(passphrase: string, salt: Buffer) {
  return crypto.scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1 });
}

export function encryptBackupPayload(payload: unknown, passphrase: string) {
  assertPassphrase(passphrase);
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(passphrase, salt), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const envelope: EncryptedEnvelope = {
    format: ENVELOPE_FORMAT,
    version: BACKUP_VERSION,
    kdf: "scrypt",
    salt: salt.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  };
  return Buffer.from(JSON.stringify(envelope), "utf8");
}

export function decryptBackupPayload(bytes: Uint8Array, passphrase: string): unknown {
  assertPassphrase(passphrase);
  let envelope: EncryptedEnvelope;
  try {
    envelope = JSON.parse(Buffer.from(bytes).toString("utf8")) as EncryptedEnvelope;
  } catch {
    throw new Error("备份文件格式无效");
  }
  if (
    envelope.format !== ENVELOPE_FORMAT || envelope.version !== BACKUP_VERSION || envelope.kdf !== "scrypt" ||
    !envelope.salt || !envelope.iv || !envelope.tag || !envelope.ciphertext
  ) throw new Error("不支持的备份文件格式");

  try {
    const salt = Buffer.from(envelope.salt, "base64url");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(passphrase, salt),
      Buffer.from(envelope.iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString("utf8")) as unknown;
  } catch {
    throw new Error("备份密码错误或文件已损坏");
  }
}

function readImages(): BackupImage[] {
  const directory = productImageDirectory();
  if (!fs.existsSync(directory)) return [];
  let totalBytes = 0;
  const images: BackupImage[] = [];
  for (const filename of fs.readdirSync(directory)) {
    if (!isValidProductImageFilename(filename)) continue;
    const bytes = fs.readFileSync(path.join(directory, filename));
    totalBytes += bytes.length;
    if (totalBytes > MAX_IMAGE_BYTES) throw new Error("商品图片总大小超过备份上限");
    images.push({ filename, data: bytes.toString("base64") });
  }
  return images;
}

function createPayload(): BackupPayload {
  const tableData = db.transaction(() => Object.fromEntries(
    tables.map((table) => [table, db.prepare(`SELECT * FROM ${table}`).all() as BackupRow[]]),
  ) as Record<TableName, BackupRow[]>)();
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    tables: tableData,
    images: readImages(),
  };
}

export function createEncryptedBackup(passphrase: string) {
  return encryptBackupPayload(createPayload(), passphrase);
}

function validatePayload(value: unknown): BackupPayload {
  if (!value || typeof value !== "object") throw new Error("备份内容无效");
  const payload = value as Partial<BackupPayload>;
  if (payload.format !== BACKUP_FORMAT || payload.version !== BACKUP_VERSION) throw new Error("备份版本不兼容");
  if (!payload.tables || typeof payload.tables !== "object") throw new Error("备份缺少数据库内容");
  for (const table of tables) {
    if (!Array.isArray(payload.tables[table])) throw new Error(`备份缺少数据表：${table}`);
    for (const row of payload.tables[table]) {
      if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`数据表 ${table} 内容无效`);
    }
  }
  if (!Array.isArray(payload.images)) throw new Error("备份图片内容无效");
  for (const image of payload.images) {
    if (!image || !isValidProductImageFilename(image.filename) || typeof image.data !== "string") {
      throw new Error("备份包含无效图片");
    }
    const bytes = Buffer.from(image.data, "base64");
    const imageType = detectProductImageType(bytes);
    if (!imageType || !image.filename.endsWith(`.${imageType.extension}`)) throw new Error("备份图片格式不匹配");
  }
  return payload as BackupPayload;
}

function insertRows(table: TableName, rows: BackupRow[]) {
  const allowedColumns = new Set((db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((column) => column.name));
  for (const row of rows) {
    const columns = Object.keys(row).filter((column) => allowedColumns.has(column));
    if (!columns.length) throw new Error(`数据表 ${table} 没有可恢复字段`);
    const placeholders = columns.map(() => "?").join(", ");
    const quotedColumns = columns.map((column) => `"${column}"`).join(", ");
    db.prepare(`INSERT INTO ${table} (${quotedColumns}) VALUES (${placeholders})`)
      .run(...columns.map((column) => row[column]));
  }
}

function backupDirectory() {
  const databasePath = process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.join(process.cwd(), "data", "card-store.sqlite");
  return path.join(path.dirname(databasePath), "manual-backups");
}

function saveEmergencyBackup(bytes: Buffer) {
  const directory = backupDirectory();
  fs.mkdirSync(directory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `pre-restore-${timestamp}.reiibak`;
  fs.writeFileSync(path.join(directory, filename), bytes, { flag: "wx", mode: 0o600 });
  const backups = fs.readdirSync(directory).filter((name) => /^pre-restore-.*\.reiibak$/.test(name)).sort().reverse();
  for (const oldBackup of backups.slice(5)) fs.unlinkSync(path.join(directory, oldBackup));
  return filename;
}

export function restoreEncryptedBackup(bytes: Uint8Array, passphrase: string) {
  if (bytes.byteLength > MAX_BACKUP_FILE_BYTES) throw new Error("备份文件过大");
  const payload = validatePayload(decryptBackupPayload(bytes, passphrase));
  const emergencyBackup = saveEmergencyBackup(createEncryptedBackup(passphrase));

  const restore = db.transaction(() => {
    for (const table of [...tables].reverse()) db.prepare(`DELETE FROM ${table}`).run();
    for (const table of tables) insertRows(table, payload.tables[table]);
    db.prepare("INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)")
      .run("backup.restored", "system", "database", JSON.stringify({ createdAt: payload.createdAt, emergencyBackup }));
  });
  restore();

  const imageDirectory = productImageDirectory();
  fs.mkdirSync(imageDirectory, { recursive: true });
  for (const image of payload.images) {
    fs.writeFileSync(path.join(imageDirectory, image.filename), Buffer.from(image.data, "base64"), { mode: 0o600 });
  }
  return { createdAt: payload.createdAt, emergencyBackup, images: payload.images.length };
}
