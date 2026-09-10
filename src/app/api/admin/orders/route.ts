import { NextResponse } from "next/server";
import { getRecycledOrders, isAdminRequest, permanentlyDeleteOrders, recycleOrders, restoreOrders } from "@/lib/admin";
import { z } from "zod";

export const runtime = "nodejs";

const orderNosSchema = z.object({ orderNos: z.array(z.string().trim().min(1).max(80)).min(1).max(200) });

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });
  const scope = new URL(request.url).searchParams.get("scope");
  if (scope !== "trash") return NextResponse.json({ error: "订单范围无效" }, { status: 400 });
  return NextResponse.json({ orders: getRecycledOrders() });
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });
  try {
    const { orderNos } = orderNosSchema.parse(await request.json());
    return NextResponse.json(recycleOrders(orderNos));
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "移入回收站失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });
  try {
    const body = await request.json() as { action?: unknown; orderNos?: unknown };
    const { orderNos } = orderNosSchema.parse({ orderNos: body.orderNos });
    if (body.action === "restore") return NextResponse.json(restoreOrders(orderNos));
    if (body.action === "purge") return NextResponse.json(permanentlyDeleteOrders(orderNos));
    return NextResponse.json({ error: "订单操作无效" }, { status: 400 });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "更新回收站订单失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
