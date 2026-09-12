import { NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/customer-auth";
import { getCustomerDashboard } from "@/lib/customer";

export async function GET(request: Request) {
  const customer = getCustomerFromRequest(request);
  if (!customer) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  return NextResponse.json(getCustomerDashboard(customer.email), { headers: { "cache-control": "no-store" } });
}
