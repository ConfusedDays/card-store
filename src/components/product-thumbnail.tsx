"use client";

import Image from "next/image";
import { KeyRound } from "lucide-react";
import { useState } from "react";

export function ProductThumbnail({ src }: { src: string | null }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return (
    <span className="product-thumbnail" aria-hidden="true">
      {src && src !== failedSrc
        ? <Image src={src} alt="" width={40} height={40} unoptimized onError={() => setFailedSrc(src)} />
        : <KeyRound size={20} />}
    </span>
  );
}
