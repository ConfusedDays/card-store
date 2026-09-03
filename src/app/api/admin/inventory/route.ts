import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteInventoryKeys, getAdminInventoryKeys, importLicenseKeys, isAdminRequest, updateInventoryKeys } from "@/lib/admin";

const schema = z.object({
  variantId: z.string().min(1),
  keys: z.array(z.string().min(3)).min(1).max(5000),
});

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });
  try {
    const input = schema.parse(await request.json());
    return NextResponse.json(importLicenseKeys(input.variantId, input.keys));
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "导入失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

const selectedSchema = z.object({ ids: z.array(z.number().int().positive()).min(1).max(500) });

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  return NextResponse.json({ keys: getAdminInventoryKeys({ variantId: searchParams.get("variantId") || undefined, status: searchParams.get("status") || undefined, search: searchParams.get("search") || undefined }) });
}

export async function PATCH(request: Request) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });
  try { const input = selectedSchema.extend({ status: z.enum(["available", "disabled"]) }).parse(await request.json()); return NextResponse.json(updateInventoryKeys(input.ids, input.status)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "更新失败" }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });
  try { return NextResponse.json(deleteInventoryKeys(selectedSchema.parse(await request.json()).ids)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "删除失败" }, { status: 400 }); }
}
