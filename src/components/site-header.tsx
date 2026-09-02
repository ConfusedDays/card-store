"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, Copy, ExternalLink, MessageCircle, Users } from "lucide-react";
import { SlideTabs, type SlideTabItem } from "@/components/ui/slide-tabs";

type SiteSection = "catalog" | "orders" | "admin";
const ROUTE_EXIT_DURATION = 300;

export function SiteHeader({ active }: { active: SiteSection }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
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
        <div className="contact-menu">
          <button
            className="contact-trigger"
            type="button"
            aria-expanded={contactOpen}
            aria-haspopup="menu"
            onClick={() => setContactOpen((open) => !open)}
          >
            <MessageCircle size={16} /> <span>联系方式</span><ChevronDown size={14} />
          </button>
          {contactOpen && (
            <div className="contact-popover" role="menu" aria-label="联系方式">
              <a href="https://discord.gg/MmXRuWnrQT" target="_blank" rel="noreferrer" role="menuitem">
                <span><MessageCircle size={16} /> Discord 频道</span><ExternalLink size={14} />
              </a>
              <button type="button" role="menuitem" onClick={copyQqGroup}>
                <span><Users size={16} /> QQ 群 <strong>1107140300</strong></span>
                {qqCopied ? <Check size={15} /> : <Copy size={14} />}
              </button>
              <small>{qqCopied ? "QQ群号已复制" : "点击 QQ 群号即可复制"}</small>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
