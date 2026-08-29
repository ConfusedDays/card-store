"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";

type SiteSection = "catalog" | "orders" | "admin";
const ROUTE_EXIT_DURATION = 300;

export function SiteHeader({ active }: { active: SiteSection }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);

  function navigateTo(href: string, event: React.MouseEvent<HTMLAnchorElement>) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) return;

    event.preventDefault();
    if (href === pathname || isNavigating) return;

    setIsNavigating(true);
    const route = document.querySelector<HTMLElement>(".route-transition");
    if (!route || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(href);
      return;
    }

    route.classList.add("route-leaving");
    window.setTimeout(() => router.push(href), ROUTE_EXIT_DURATION);
  }

  const linkProps = (section: SiteSection, href: string) => ({
    className: active === section ? "active" : "",
    "aria-current": active === section ? ("page" as const) : undefined,
    onClick: (event: React.MouseEvent<HTMLAnchorElement>) => navigateTo(href, event),
  });

  return (
    <header className="topbar">
      <Link
        className="brand"
        href="/"
        prefetch={true}
        aria-label="数字授权中心首页"
        onClick={(event) => navigateTo("/", event)}
      >
        <span className="brand-mark"><KeyRound size={19} /></span>
        <span>数字授权中心</span>
      </Link>
      <nav className="nav-links" aria-label="主导航">
        <Link href="/" prefetch={true} {...linkProps("catalog", "/")}>购买</Link>
        <Link href="/orders" prefetch={true} {...linkProps("orders", "/orders")}>订单查询</Link>
        {active === "admin" && (
          <Link href="/admin" prefetch={true} {...linkProps("admin", "/admin")}>库存后台</Link>
        )}
      </nav>
      <div className="topbar-actions" aria-hidden="true" />
    </header>
  );
}
