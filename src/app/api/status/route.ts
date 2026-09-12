import { NextResponse } from "next/server";
import { getLiveStatus } from "@/lib/weao";

export const runtime = "nodejs";

export async function GET() {
  const status = await getLiveStatus();
  return NextResponse.json(status, {
    headers: {
      "cache-control": "public, max-age=30, stale-while-revalidate=120",
    },
  });
}
