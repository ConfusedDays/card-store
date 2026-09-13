import { NextResponse } from "next/server";
import { z } from "zod";
import { announcementLevels, createAnnouncement, deleteAnnouncement, getAdminAnnouncements, updateAnnouncement } from "@/lib/announcements";
import { isAdminRequest } from "@/lib/admin";

export const runtime = "nodejs";

const createSchema = z.object({
  title: z.string().trim().min(1, "请输入公告标题").max(120, "公告标题不能超过 120 个字符"),
  content: z.string().trim().min(1, "请输入公告内容").max(5000, "公告内容不能超过 5000 个字符"),
  level: z.enum(announcementLevels).default("info"),
  active: z.boolean().default(true),
});

const updateSchema = createSchema.partial().extend({ id: z.string().uuid("公告标识无效") });

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });
  return NextResponse.json({ announcements: getAdminAnnouncements() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });
  try {
    return NextResponse.json(createAnnouncement(createSchema.parse(await request.json())), { status: 201 });
  } catch (error) {
    return errorResponse(error, "发布公告失败");
  }
}

export async function PATCH(request: Request) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });
  try {
    return NextResponse.json(updateAnnouncement(updateSchema.parse(await request.json())));
  } catch (error) {
    return errorResponse(error, "更新公告失败");
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });
  try {
    const id = z.string().uuid("公告标识无效").parse(new URL(request.url).searchParams.get("id"));
    return NextResponse.json(deleteAnnouncement(id));
  } catch (error) {
    return errorResponse(error, "删除公告失败");
  }
}
