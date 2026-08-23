"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface MenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  showChevron?: boolean;
}

export function Menu({ trigger, children, align = "left", showChevron = true }: MenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex cursor-pointer items-center"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {trigger}
        {showChevron && <ChevronDown className="ml-2 -mr-1 h-4 w-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />}
      </button>

      {isOpen && (
        <div
          className={`absolute ${align === "right" ? "right-0" : "left-0"} z-50 mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black/10 focus:outline-none dark:bg-gray-800 dark:ring-gray-700`}
          role="menu"
          aria-orientation="vertical"
        >
          <div className="py-1">{children}</div>
        </div>
      )}
    </div>
  );
}

const FluidMenuContext = createContext<{ close: () => void }>({ close: () => undefined });

interface MenuItemProps {
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  isActive?: boolean;
  label?: string;
  closeOnSelect?: boolean;
}

export function MenuItem({ children, onClick, disabled = false, icon, isActive = false, label, closeOnSelect = true }: MenuItemProps) {
  const { close } = useContext(FluidMenuContext);
  return (
    <button
      type="button"
      className={`group relative block h-16 w-full text-center transition-colors ${disabled ? "cursor-not-allowed text-gray-400 dark:text-gray-500" : "text-gray-600 hover:text-gray-950 dark:text-gray-300 dark:hover:text-white"} ${isActive ? "bg-white/80 dark:bg-white/10" : ""}`}
      role="menuitem"
      onClick={() => { onClick?.(); if (closeOnSelect) close(); }}
      disabled={disabled}
      aria-label={label}
      title={label}
      data-active={isActive}
    >
      <span className="flex h-full items-center justify-center">
        {icon && <span className="h-6 w-6 transition-all duration-200 group-hover:[&_svg]:stroke-[2.5]">{icon}</span>}
        {children}
      </span>
    </button>
  );
}

export function MenuContainer({ children, label = "快捷导航" }: { children: React.ReactNode; label?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const childrenArray = React.Children.toArray(children);

  useEffect(() => {
    if (!isExpanded) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsExpanded(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsExpanded(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isExpanded]);

  if (childrenArray.length === 0) return null;

  return (
    <FluidMenuContext.Provider value={{ close: () => setIsExpanded(false) }}>
      <div ref={menuRef} className="relative w-16" data-expanded={isExpanded} role="menu" aria-label={label}>
        <div className="relative">
          <div className="group relative z-50 h-16 w-16 cursor-pointer overflow-hidden rounded-full bg-gray-100 will-change-transform dark:bg-gray-800" onClick={() => setIsExpanded((expanded) => !expanded)}>
            {childrenArray[0]}
          </div>

          {childrenArray.slice(1).map((child, index) => (
            <div
              key={index}
              className="absolute top-0 left-0 h-16 w-16 overflow-hidden bg-gray-100 will-change-transform dark:bg-gray-800"
              style={{
                transform: `translateY(${isExpanded ? (index + 1) * 48 : 0}px)`,
                opacity: isExpanded ? 1 : 0,
                pointerEvents: isExpanded ? "auto" : "none",
                zIndex: 40 - index,
                clipPath: index === childrenArray.length - 2 ? "circle(50% at 50% 50%)" : "circle(50% at 50% 55%)",
                transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms",
                backfaceVisibility: "hidden",
                perspective: 1000,
                WebkitFontSmoothing: "antialiased",
              }}
            >
              {child}
            </div>
          ))}
        </div>
      </div>
    </FluidMenuContext.Provider>
  );
}
