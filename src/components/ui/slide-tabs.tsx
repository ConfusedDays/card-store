"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

type TabId = string;

export type SlideTabItem = {
  id: TabId;
  label: string;
  href: string;
};

type CursorPosition = {
  left: number;
  width: number;
  opacity: number;
};

type SlideTabsProps = {
  items: SlideTabItem[];
  activeId: TabId;
  ariaLabel?: string;
  onNavigate?: (href: string, event: React.MouseEvent<HTMLAnchorElement>) => void;
};

export function SlideTabs({ items, activeId, ariaLabel = "导航", onNavigate }: SlideTabsProps) {
  const tabsRef = useRef(new Map<TabId, HTMLLIElement>());
  const reduceMotion = useReducedMotion();
  const [position, setPosition] = useState<CursorPosition>({ left: 0, width: 0, opacity: 0 });

  const moveCursor = useCallback((id: TabId) => {
    const tab = tabsRef.current.get(id);
    if (!tab) return;
    setPosition({ left: tab.offsetLeft, width: tab.offsetWidth, opacity: 1 });
  }, []);

  useLayoutEffect(() => {
    moveCursor(activeId);

    const handleResize = () => moveCursor(activeId);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeId, items.length, moveCursor]);

  return (
    <ul
      className="slide-tabs"
      aria-label={ariaLabel}
      onMouseLeave={() => moveCursor(activeId)}
    >
      {items.map((item) => (
        <li
          key={item.id}
          ref={(node) => {
            if (node) tabsRef.current.set(item.id, node);
            else tabsRef.current.delete(item.id);
          }}
          className="slide-tab"
          onMouseEnter={() => moveCursor(item.id)}
        >
          <Link
            href={item.href}
            prefetch
            aria-current={item.id === activeId ? "page" : undefined}
            onFocus={() => moveCursor(item.id)}
            onClick={(event) => onNavigate?.(item.href, event)}
          >
            {item.label}
          </Link>
        </li>
      ))}
      <motion.li
        aria-hidden="true"
        className="slide-tabs-cursor"
        animate={position}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 430, damping: 34, mass: 0.7 }}
      />
    </ul>
  );
}

export const SlideTabsExample = () => (
  <div className="flex min-h-screen w-full items-start justify-center bg-neutral-100 py-20">
    <SlideTabs
      activeId="home"
      items={[
        { id: "home", label: "Home", href: "/" },
        { id: "pricing", label: "Pricing", href: "/pricing" },
        { id: "features", label: "Features", href: "/features" },
        { id: "docs", label: "Docs", href: "/docs" },
        { id: "blog", label: "Blog", href: "/blog" },
      ]}
    />
  </div>
);
