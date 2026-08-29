import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isTurnstileConfigured } from "@/lib/turnstile";

export function GET() {
  db.prepare("SELECT 1").get();
  return NextResponse.json({ status: "ok", turnstile: isTurnstileConfigured() ? "configured" : "disabled" });
}
