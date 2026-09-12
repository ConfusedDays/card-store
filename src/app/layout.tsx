import type { Metadata } from "next";
import { SiteBackground } from "@/components/site-background";
import { PurchaseNoticeGate } from "@/components/purchase-notice-gate";
import { ThemeToggle } from "@/components/theme-toggle";
import { TurnstileAccessGate } from "@/components/turnstile-access-gate";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reii小店",
  description: "授权数字商品自动交付平台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="dark-mode" style={{ colorScheme: "dark" }} suppressHydrationWarning>
      <body>
        <SiteBackground />
        <TurnstileAccessGate siteKey={process.env.TURNSTILE_SITE_KEY}>{children}</TurnstileAccessGate>
        <ThemeToggle />
        <PurchaseNoticeGate />
      </body>
    </html>
  );
}
