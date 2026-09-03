import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { MAX_BACKUP_FILE_BYTES, restoreEncryptedBackup } from "@/lib/admin-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BACKUP_FILE_BYTES + 1024 * 1024) return NextResponse.json({ error: "备份文件过大" }, { status: 413 });

  try {
    const form = await request.formData();
    const file = form.get("backup");
    const passphrase = String(form.get("passphrase") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (!(file instanceof File)) throw new Error("请选择备份文件");
    if (confirmation !== "恢复数据") throw new Error("恢复确认文字不正确");
    if (file.size > MAX_BACKUP_FILE_BYTES) return NextResponse.json({ error: "备份文件过大" }, { status: 413 });
    const result = restoreEncryptedBackup(new Uint8Array(await file.arrayBuffer()), passphrase);
    return NextResponse.json({ ok: true, ...result }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "恢复备份失败" }, { status: 400 });
  }
}
