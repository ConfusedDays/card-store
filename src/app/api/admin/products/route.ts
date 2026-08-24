import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin";
import { reorderProducts, saveProduct } from "@/lib/product-admin";

const variantSchema = z.object({
  id: z.string().min(1).optional(),
  label: z.string().trim().min(1, "请输入规格名称").max(80),
  durationLabel: z.string().trim().min(1, "请输入规格说明").max(120),
  priceCents: z.number().int().min(1, "价格必须大于 0").max(100_000_000),
  active: z.boolean(),
});

const productSchema = z.object({
  id: z.string().min(1).optional(),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "链接标识只能使用小写字母、数字和连字符"),
  name: z.string().trim().min(1, "请输入商品名称").max(120),
  description: z.string().trim().min(1, "请输入商品介绍").max(1000),
  category: z.string().trim().min(1, "请输入商品分类").max(80),
  accent: z.string().trim().min(1).max(30),
  imageUrl: z.string().trim().regex(/^\/api\/product-images\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/).nullable(),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
  variants: z.array(variantSchema).min(1, "至少添加一个商品规格").max(30),
});

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });
  try {
    const input = productSchema.parse(await request.json());
    return NextResponse.json(saveProduct(input), { status: input.id ? 200 : 201 });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues[0]?.message
      : error instanceof Error ? error.message : "保存商品失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


const reorderSchema = z.object({ productIds: z.array(z.string().min(1)).min(1).max(500) });

export async function PATCH(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });
  try {
    const { productIds } = reorderSchema.parse(await request.json());
    return NextResponse.json({ products: reorderProducts(productIds) });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues[0]?.message
      : error instanceof Error ? error.message : "保存商品排序失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
