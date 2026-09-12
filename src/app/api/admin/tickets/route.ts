import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin";
import { getAdminTickets, supportTicketStatuses, updateSupportTicket } from "@/lib/support-tickets";

export const runtime = "nodejs";

const updateSchema = z.object({
  ticketNo: z.string().trim().min(1).max(80),
  status: z.enum(supportTicketStatuses),
  adminNote: z.string().trim().max(3000, "处理备注不能超过 3000 个字符").optional(),
});

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });
  const status = new URL(request.url).searchParams.get("status") ?? undefined;
  return NextResponse.json({ tickets: getAdminTickets(status) }, { headers: { "cache-control": "no-store" } });
}

export async function PATCH(request: Request) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });
  try {
    return NextResponse.json(updateSupportTicket(updateSchema.parse(await request.json())));
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "更新工单失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
