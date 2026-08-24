import type { Metadata } from "next";
import { SiteBackground } from "@/components/site-background";
import "./globals.css";

export const metadata: Metadata = {
  title: "数字授权中心",
  description: "授权数字商品自动交付平台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const themeScript = `(() => {
    try {
      const saved = localStorage.getItem("card-store-theme");
      const theme = saved === "dark" || saved === "light"
        ? saved
        : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.classList.toggle("dark-mode", theme === "dark");
      document.documentElement.style.colorScheme = theme;
    } catch {}
  })();`;

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <SiteBackground />
        {children}
      </body>
    </html>
  );
}
