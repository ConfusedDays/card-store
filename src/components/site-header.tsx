"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { SlideTabs, type SlideTabItem } from "@/components/ui/slide-tabs";

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

  const tabs: SlideTabItem[] = [
    { id: "catalog", label: "购买", href: "/" },
    { id: "orders", label: "订单查询", href: "/orders" },
    ...(active === "admin" ? [{ id: "admin", label: "库存后台", href: "/admin" }] : []),
  ];

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
        <SlideTabs items={tabs} activeId={active} onNavigate={navigateTo} />
      </nav>
      <div className="topbar-actions" aria-hidden="true" />
    </header>
  );
}
