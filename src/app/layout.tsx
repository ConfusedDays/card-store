import type { Metadata } from "next";
import { SiteBackground } from "@/components/site-background";
import "./globals.css";

export const metadata: Metadata = {
  title: "数字授权中心",
  description: "授权数字商品自动交付平台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="dark-mode" style={{ colorScheme: "dark" }}>
      <body>
        <SiteBackground />
        {children}
      </body>
    </html>
  );
}
