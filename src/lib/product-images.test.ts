import { describe, expect, it } from "vitest";
import { detectProductImageType, isValidProductImageFilename } from "@/lib/product-images";

describe("product image validation", () => {
  it("detects the supported image signatures", () => {
    expect(detectProductImageType(Uint8Array.from([0xff, 0xd8, 0xff]))?.extension).toBe("jpg");
    expect(detectProductImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.extension).toBe("png");
    expect(detectProductImageType(Uint8Array.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]))?.extension).toBe("webp");
  });

  it("rejects unsupported content and unsafe filenames", () => {
    expect(detectProductImageType(Uint8Array.from([60, 115, 118, 103]))).toBeNull();
    expect(isValidProductImageFilename("../../secret.png")).toBe(false);
    expect(isValidProductImageFilename("6f65bf01-2d0c-4fd9-b2a8-70d724721aff.webp")).toBe(true);
  });
});
