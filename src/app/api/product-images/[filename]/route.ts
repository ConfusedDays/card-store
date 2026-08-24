import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  isValidProductImageFilename,
  productImageDirectory,
  productImageTypeFromFilename,
} from "@/lib/product-images";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  const imageType = productImageTypeFromFilename(filename);
  if (!isValidProductImageFilename(filename) || !imageType) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const bytes = await readFile(path.join(/* turbopackIgnore: true */ productImageDirectory(), filename));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": imageType.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
