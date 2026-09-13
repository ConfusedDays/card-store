import { NextResponse } from "next/server";
import { getPublicAnnouncements } from "@/lib/announcements";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ announcements: getPublicAnnouncements() }, {
    headers: { "cache-control": "public, max-age=30, stale-while-revalidate=120" },
  });
}
