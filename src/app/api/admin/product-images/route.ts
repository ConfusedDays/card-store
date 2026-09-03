import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import {
  detectProductImageType,
  MAX_PRODUCT_IMAGE_BYTES,
  productImageDirectory,
} from "@/lib/product-images";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理员凭证无效" }, { status: 401 });

  try {
    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File) || image.size === 0) {
      return NextResponse.json({ error: "请选择宣传图" }, { status: 400 });
    }
    if (image.size > MAX_PRODUCT_IMAGE_BYTES) {
      return NextResponse.json({ error: "宣传图不能超过 5MB" }, { status: 400 });
    }

    const bytes = new Uint8Array(await image.arrayBuffer());
    const imageType = detectProductImageType(bytes);
    if (!imageType) {
      return NextResponse.json({ error: "仅支持 JPG、PNG 或 WebP 图片" }, { status: 400 });
    }

    const filename = `${randomUUID()}.${imageType.extension}`;
    const directory = productImageDirectory();
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(/* turbopackIgnore: true */ directory, filename), bytes, { flag: "wx" });

    return NextResponse.json({ imageUrl: `/api/product-images/${filename}` }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "上传宣传图失败" }, { status: 500 });
  }
}
