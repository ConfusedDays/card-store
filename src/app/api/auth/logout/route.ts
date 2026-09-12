import { NextResponse } from "next/server";
import { CUSTOMER_SESSION_COOKIE, expiredCustomerSessionCookieOptions, revokeCustomerSession } from "@/lib/customer-auth";

export async function POST(request: Request) {
  revokeCustomerSession(request);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(CUSTOMER_SESSION_COOKIE, "", expiredCustomerSessionCookieOptions());
  return response;
}
