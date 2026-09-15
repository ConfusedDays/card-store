"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Check, Copy, ExternalLink, MessageCircle, Users, X } from "lucide-react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import type { Announcement } from "@/lib/announcements";

type SiteSection = "catalog" | "orders" | "policies" | "account" | "admin";
const ROUTE_EXIT_DURATION = 300;
const ANNOUNCEMENT_SEEN_STORAGE_KEY = "reiishop.announcement.seen";

function getSeenAnnouncementKey() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ANNOUNCEMENT_SEEN_STORAGE_KEY)
    ?? window.sessionStorage.getItem(ANNOUNCEMENT_SEEN_STORAGE_KEY);
}

export function SiteHeader({ active }: { active: SiteSection }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [qqCopied, setQqCopied] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [seenAnnouncementKey, setSeenAnnouncementKey] = useState<string | null>(getSeenAnnouncementKey);
  const announcementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const loadAnnouncements = async () => {
      try {
        const response = await fetch("/api/announcements", { cache: "no-store" });
        if (!response.ok) throw new Error("announcement request failed");
        const data = await response.json() as { announcements?: Announcement[] };
        if (active) setAnnouncements(Array.isArray(data.announcements) ? data.announcements : []);
      } catch {
        if (active) setAnnouncements([]);
      }
    };
    void loadAnnouncements();
    const timer = window.setInterval(loadAnnouncements, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!announcementOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!announcementRef.current?.contains(event.target as Node)) setAnnouncementOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAnnouncementOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [announcementOpen]);

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

  function refreshPage(event: React.MouseEvent<HTMLAnchorElement>) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) return;

    event.preventDefault();
    window.location.reload();
  }

  const navigationItems: Array<{ id: SiteSection; label: string; href: string }> = [
    { id: "catalog", label: "商品", href: "/" },
    { id: "account", label: "用户中心", href: "/account" },
    { id: "policies", label: "售后", href: "/policies#contact" },
    ...(active === "admin" ? [{ id: "admin" as const, label: "后台", href: "/admin" }] : []),
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

  function toggleAnnouncements() {
    const nextOpen = !announcementOpen;
    setAnnouncementOpen(nextOpen);
    const latest = announcements[0];
    const latestKey = latest ? `${latest.id}:${latest.updatedAt}` : null;
    if (nextOpen && latestKey && latestKey !== seenAnnouncementKey) {
      setSeenAnnouncementKey(latestKey);
      window.localStorage.setItem(ANNOUNCEMENT_SEEN_STORAGE_KEY, latestKey);
      window.sessionStorage.setItem(ANNOUNCEMENT_SEEN_STORAGE_KEY, latestKey);
    }
  }

  return (
    <header className={`topbar topbar-${active}`}>
      <Link
        className="brand"
        href="/"
        prefetch={true}
        aria-label="Reii小店首页"
        title="刷新网页"
        onClick={refreshPage}
      >
        <span className="brand-mark brand-photo"><Image src="/reii-bear.jpg" alt="" width={34} height={34} priority /></span>
        <span>Reii小店</span>
      </Link>
      <nav className="nav-links" aria-label="主导航">
        <div className="nav-items">
          {navigationItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              aria-label={item.label}
              aria-current={active === item.id ? "page" : undefined}
              onClick={(event) => navigateTo(item.href, event)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <div className="topbar-actions">
        <div ref={announcementRef} className="announcement-menu">
          <button type="button" className="announcement-menu-trigger" aria-label={announcements[0] && `${announcements[0].id}:${announcements[0].updatedAt}` !== seenAnnouncementKey ? "公告通知（有新公告）" : "公告通知"} aria-expanded={announcementOpen} aria-haspopup="dialog" onClick={toggleAnnouncements}>
            <Bell size={16} />
            <span>公告</span>
            {announcements[0] && `${announcements[0].id}:${announcements[0].updatedAt}` !== seenAnnouncementKey && <i className="announcement-unread-dot" aria-label="有新公告" />}
          </button>
          {announcementOpen && (
            <div className="announcement-menu-panel" role="dialog" aria-label="公告通知">
              <div className="announcement-menu-heading"><div><span>最新消息</span><strong>公告通知</strong></div><button type="button" onClick={() => setAnnouncementOpen(false)} aria-label="关闭公告"><X size={15} /></button></div>
              {announcements.length ? announcements.map((announcement) => (
                <article className={`announcement-menu-item announcement-menu-item-${announcement.level}`} key={announcement.id}>
                  <div className="announcement-menu-item-meta"><span>{announcement.level === "important" ? "重要通知" : "通知"}</span><time dateTime={new Date(announcement.updatedAt).toISOString()}>{new Date(announcement.updatedAt).toLocaleDateString("zh-CN")}</time></div>
                  <strong>{announcement.title}</strong>
                  <p>{announcement.content}</p>
                </article>
              )) : <p className="announcement-menu-empty">暂无公告</p>}
            </div>
          )}
        </div>
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
