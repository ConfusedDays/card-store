"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";

export type DropdownMenuOption = {
  label: ReactNode;
  icon?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  external?: boolean;
  onSelect?: () => void;
};

export type DropdownSelectOption = { value: string; label: ReactNode; disabled?: boolean };

type DropdownSelectProps = {
  value: string;
  options: DropdownSelectOption[];
  onValueChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
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

export function DropdownSelect({ value, options, onValueChange, ariaLabel, disabled = false, className = "" }: DropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const reduceMotion = useReducedMotion();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!selectRef.current?.contains(event.target as Node)) setOpen(false);
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
    : { initial: { opacity: 0, y: -6, scale: 0.97, filter: "blur(8px)" }, animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }, exit: { opacity: 0, y: -4, scale: 0.98, filter: "blur(5px)" } };

  return (
    <div ref={selectRef} className={`dropdown-select ${className}`}>
      <button
        type="button"
        className="dropdown-select-trigger"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        disabled={disabled}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label ?? "请选择"}</span>
        <motion.span className="dropdown-menu-chevron" animate={{ rotate: open ? 180 : 0 }} transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}><ChevronDown size={17} /></motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div id={listboxId} role="listbox" aria-label={ariaLabel} className="dropdown-select-surface" {...surfaceMotion} transition={{ duration: reduceMotion ? 0.1 : 0.24, ease: [0.16, 1, 0.3, 1] }}>
            {options.map((option, index) => (
              <motion.button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                disabled={option.disabled}
                className={`dropdown-select-option ${option.value === value ? "selected" : ""}`}
                initial={reduceMotion ? undefined : { opacity: 0, x: 8, filter: "blur(4px)" }}
                animate={reduceMotion ? undefined : { opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={reduceMotion ? undefined : { opacity: 0, x: 4 }}
                transition={{ duration: reduceMotion ? 0.1 : 0.18, delay: reduceMotion ? 0 : index * 0.035, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => { onValueChange(option.value); setOpen(false); }}
              >
                <span>{option.label}</span>
                {option.value === value && <Check size={15} />}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
