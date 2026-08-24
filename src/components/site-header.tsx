"use client";

import Link from "next/link";
import { KeyRound } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

type SiteSection = "catalog" | "orders" | "admin";

export function SiteHeader({
  active,
  onNavigate,
}: {
  active: SiteSection;
  onNavigate?: (href: string, event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const linkProps = (section: SiteSection, href: string) => ({
    className: active === section ? "active" : "",
    "aria-current": active === section ? ("page" as const) : undefined,
    onClick: onNavigate ? (event: React.MouseEvent<HTMLAnchorElement>) => onNavigate(href, event) : undefined,
  });

  return (
    <header className="topbar">
      <Link
        className="brand"
        href="/"
        prefetch={true}
        aria-label="数字授权中心首页"
        onClick={onNavigate ? (event) => onNavigate("/", event) : undefined}
      >
        <span className="brand-mark"><KeyRound size={19} /></span>
        <span>数字授权中心</span>
      </Link>
      <nav className="nav-links" aria-label="主导航">
        <Link href="/" prefetch={true} {...linkProps("catalog", "/")}>购买</Link>
        <Link href="/orders" prefetch={true} {...linkProps("orders", "/orders")}>订单查询</Link>
        <Link href="/admin" prefetch={true} {...linkProps("admin", "/admin")}>库存后台</Link>
      </nav>
      <div className="topbar-actions">
        <ThemeToggle />
      </div>
    </header>
  );
}
