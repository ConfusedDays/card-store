"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, MessageCircle, Users } from "lucide-react";
import { SlideTabs, type SlideTabItem } from "@/components/ui/slide-tabs";
import { DropdownMenu } from "@/components/ui/dropdown-menu";

type SiteSection = "catalog" | "orders" | "admin";
const ROUTE_EXIT_DURATION = 300;

export function SiteHeader({ active }: { active: SiteSection }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [qqCopied, setQqCopied] = useState(false);

  function navigateTo(href: string, event: React.MouseEvent<HTMLAnchorElement>) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) return;

    event.preventDefault();
    if (isNavigating) return;
    if (href === pathname) {
      if (href === "/") {
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
      }
      return;
    }

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

  async function copyQqGroup() {
    try {
      await navigator.clipboard.writeText("1107140300");
      setQqCopied(true);
      window.setTimeout(() => setQqCopied(false), 1600);
    } catch {
      setQqCopied(false);
    }
  }

  return (
    <header className={`topbar topbar-${active}`}>
      <Link
        className="brand"
        href="/"
        prefetch={true}
        aria-label="Reii小店首页"
        title="返回首页"
        onClick={(event) => navigateTo("/", event)}
      >
        <span className="brand-mark brand-photo"><Image src="/reii-bear.jpg" alt="" width={34} height={34} priority /></span>
        <span>Reii小店</span>
      </Link>
      <nav className="nav-links" aria-label="主导航">
        <SlideTabs items={tabs} activeId={active} onNavigate={navigateTo} />
      </nav>
      <div className="topbar-actions">
        <DropdownMenu
          label="联系方式"
          icon={<MessageCircle size={16} />}
          footer={qqCopied ? "QQ群号已复制" : "点击 QQ 群号即可复制"}
          options={[
            { label: "Discord 频道", icon: <MessageCircle size={16} />, trailing: <ExternalLink size={14} />, href: "https://discord.gg/MmXRuWnrQT", external: true },
            { label: <><span>QQ 群</span><strong>1107140300</strong></>, icon: <Users size={16} />, trailing: qqCopied ? <Check size={15} /> : <Copy size={14} />, onSelect: copyQqGroup },
          ]}
        />
      </div>
    </header>
  );
}
