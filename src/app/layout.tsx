import type { Metadata } from "next";
import { SiteBackground } from "@/components/site-background";
import { PurchaseNoticeGate } from "@/components/purchase-notice-gate";
import "@fontsource/zcool-xiaowei";
import "./globals.css";
import "./rebuild.css";

export const metadata: Metadata = {
  title: "Reii小店",
  description: "授权数字商品自动交付平台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="dark-mode" style={{ colorScheme: "dark" }}>
      <body>
        <span
          hidden
          aria-hidden="true"
          dangerouslySetInnerHTML={{
            __html: `<!--
THESIS: A familiar digital storefront that proves real inventory and delivery instead of relying on invented social proof.
OWN-WORLD: Ink-black and deep pine surfaces, warm white type, mint status accents, restrained square controls, and the Reii bear mark.
STORY: Visitors identify the available license, understand delivery and refund terms, choose a variant, and complete a traceable order.
FIRST VIEWPORT: Large left-aligned promise and actions occupy the left half; a live catalog console built from real products occupies the right; the store begins below the fold.
FORM: Category-standard digital storefront, chosen canon direction, seed 3f628094.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->`,
          }}
        />
        <SiteBackground />
        {children}
        <PurchaseNoticeGate />
      </body>
    </html>
  );
}
