import { NextResponse } from "next/server";
import { z } from "zod";
import { getCustomerFromRequest } from "@/lib/customer-auth";
import { createSupportTicket, getCustomerTickets } from "@/lib/support-tickets";
import { sendTicketNotification } from "@/lib/ticket-email";

const schema = z.object({
  orderNo: z.string().trim().max(80).optional(),
  subject: z.string().trim().min(2, "请填写工单主题").max(80, "工单主题不能超过 80 个字符"),
  message: z.string().trim().min(5, "请详细描述遇到的问题").max(3000, "问题描述不能超过 3000 个字符"),
});

export async function GET(request: Request) {
  const customer = getCustomerFromRequest(request);
  if (!customer) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  return NextResponse.json({ tickets: getCustomerTickets(customer.email) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const customer = getCustomerFromRequest(request);
  if (!customer) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const input = schema.parse(await request.json());
    const ticket = createSupportTicket({ ...input, email: customer.email });
    try {
      await sendTicketNotification({ ...input, email: customer.email, ticketNo: ticket.ticketNo });
    } catch (error) {
      console.error("Support ticket notification failed", error instanceof Error ? error.message : error);
    }
    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "提交工单失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
