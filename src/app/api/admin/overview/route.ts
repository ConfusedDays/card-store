import { NextResponse } from "next/server";
import { getAdminOverview, isAdminRequest } from "@/lib/admin";
import { getAdminProducts } from "@/lib/product-admin";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });
  return NextResponse.json({ ...getAdminOverview(), products: getAdminProducts() });
}
