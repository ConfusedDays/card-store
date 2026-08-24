import path from "node:path";

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

const imageTypes = {
  jpeg: { extension: "jpg", contentType: "image/jpeg" },
  png: { extension: "png", contentType: "image/png" },
  webp: { extension: "webp", contentType: "image/webp" },
} as const;

export type ProductImageType = (typeof imageTypes)[keyof typeof imageTypes];

export function detectProductImageType(bytes: Uint8Array): ProductImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return imageTypes.jpeg;
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return imageTypes.png;
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return imageTypes.webp;
  }
  return null;
}

export function productImageDirectory() {
  if (process.env.PRODUCT_IMAGE_DIR) return path.resolve(process.env.PRODUCT_IMAGE_DIR);
  if (process.env.DATABASE_PATH) return path.join(path.dirname(path.resolve(process.env.DATABASE_PATH)), "product-images");
  return path.join(process.cwd(), "data", "product-images");
}

export function productImageTypeFromFilename(filename: string): ProductImageType | null {
  const extension = path.extname(filename).slice(1).toLowerCase();
  return Object.values(imageTypes).find((type) => type.extension === extension) ?? null;
}

export function isValidProductImageFilename(filename: string) {
  return /^[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(filename);
}
