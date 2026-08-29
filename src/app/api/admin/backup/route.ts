import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { createEncryptedBackup } from "@/lib/admin-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });
  try {
    const body = await request.json() as { passphrase?: string };
    const passphrase = body.passphrase ?? "";
    const backup = createEncryptedBackup(passphrase);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(backup), {
      headers: {
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="reii-backup-${date}.reiibak"`,
        "content-type": "application/octet-stream",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "创建备份失败" }, { status: 400 });
  }
}
