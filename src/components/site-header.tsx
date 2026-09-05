"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, MessageCircle, Users } from "lucide-react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";

type SiteSection = "catalog" | "orders" | "admin";
const ROUTE_EXIT_DURATION = 300;

export function SiteHeader({ active }: { active: SiteSection }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [qqCopied, setQqCopied] = useState(false);
  const [hoveredNavigationId, setHoveredNavigationId] = useState<SiteSection | null>(null);
  const [navigationCursor, setNavigationCursor] = useState({ left: 0, width: 0 });
  const navigationRef = useRef<HTMLDivElement>(null);

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

  const navigationItems: Array<{ id: SiteSection; label: string; href: string }> = [
    { id: "catalog", label: "商品", href: "/" },
    { id: "orders", label: "订单", href: "/orders" },
    ...(active === "admin" ? [{ id: "admin" as const, label: "后台", href: "/admin" }] : []),
  ];

  const highlightedNavigationId = hoveredNavigationId ?? active;

  useEffect(() => {
    const updateCursor = () => {
      const container = navigationRef.current;
      const target = container?.querySelector<HTMLElement>(`[data-nav-id="${highlightedNavigationId}"]`);
      if (!container || !target) return;

      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      setNavigationCursor({ left: targetRect.left - containerRect.left, width: targetRect.width });
    };

    updateCursor();
    window.addEventListener("resize", updateCursor);
    return () => window.removeEventListener("resize", updateCursor);
  }, [highlightedNavigationId, navigationItems.length]);

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
        <span className="nav-rail" aria-hidden="true" />
        <div
          ref={navigationRef}
          className="nav-items"
          style={{
            "--nav-cursor-left": `${navigationCursor.left}px`,
            "--nav-cursor-scale": navigationCursor.width,
          } as CSSProperties}
          onMouseLeave={() => setHoveredNavigationId(null)}
        >
          <span className="nav-cursor" aria-hidden="true" />
          {navigationItems.map((item) => (
            <Link
              key={item.id}
              data-nav-id={item.id}
              href={item.href}
              aria-current={active === item.id ? "page" : undefined}
              onClick={(event) => navigateTo(item.href, event)}
              onMouseEnter={() => setHoveredNavigationId(item.id)}
              onFocus={() => setHoveredNavigationId(item.id)}
              onBlur={() => setHoveredNavigationId(null)}
            >
              {item.label}
            </Link>
          ))}
        </div>
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
