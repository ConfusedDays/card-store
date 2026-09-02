"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";

export type DropdownMenuOption = {
  label: ReactNode;
  icon?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  external?: boolean;
  onSelect?: () => void;
};

type DropdownMenuProps = {
  label: ReactNode;
  icon?: ReactNode;
  options: DropdownMenuOption[];
  footer?: ReactNode;
  align?: "left" | "right";
  className?: string;
};

export function DropdownMenu({ label, icon, options, footer, align = "right", className = "" }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const surfaceMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: -6, scale: 0.96, filter: "blur(8px)" }, animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }, exit: { opacity: 0, y: -4, scale: 0.98, filter: "blur(5px)" } };

  return (
    <div ref={menuRef} className={`dropdown-menu ${className}`}>
      <button
        type="button"
        className="dropdown-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {icon}
        <span>{label}</span>
        <motion.span className="dropdown-menu-chevron" animate={{ rotate: open ? 180 : 0 }} transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}><ChevronDown size={14} /></motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            role="menu"
            className={`dropdown-menu-surface dropdown-menu-${align}`}
            {...surfaceMotion}
            transition={{ duration: reduceMotion ? 0.1 : 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="dropdown-menu-options">
              {options.map((option, index) => {
                const content = <><span className="dropdown-menu-option-main">{option.icon}{option.label}</span>{option.trailing}</>;
                const itemMotion = reduceMotion ? {} : { initial: { opacity: 0, x: 8, filter: "blur(4px)" }, animate: { opacity: 1, x: 0, filter: "blur(0px)" }, exit: { opacity: 0, x: 4 } };
                const transition = { duration: reduceMotion ? 0.1 : 0.18, delay: reduceMotion ? 0 : index * 0.045, ease: [0.16, 1, 0.3, 1] as const };
                return option.href ? (
                  <motion.a key={index} {...itemMotion} transition={transition} className="dropdown-menu-option" href={option.href} role="menuitem" target={option.external ? "_blank" : undefined} rel={option.external ? "noreferrer" : undefined} onClick={() => setOpen(false)}>{content}</motion.a>
                ) : (
                  <motion.button key={index} {...itemMotion} transition={transition} type="button" className="dropdown-menu-option" role="menuitem" onClick={() => { option.onSelect?.(); setOpen(false); }}>{content}</motion.button>
                );
              })}
            </div>
            {footer && <div className="dropdown-menu-footer">{footer}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
