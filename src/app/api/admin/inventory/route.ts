import { NextResponse } from "next/server";
import { z } from "zod";
import { importLicenseKeys, isAdminRequest } from "@/lib/admin";

const schema = z.object({
  variantId: z.string().min(1),
  keys: z.array(z.string().min(3)).min(1).max(5000),
});

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });
  try {
    const input = schema.parse(await request.json());
    return NextResponse.json(importLicenseKeys(input.variantId, input.keys));
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "导入失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
