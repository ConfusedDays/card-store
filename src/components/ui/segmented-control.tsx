"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

const CELL = { type: "spring", stiffness: 520, damping: 34, mass: 0.45 } as const;
const SEG = "segmented-cell px-3 py-[7px] text-center text-[13px] font-medium leading-[18px] tracking-[-0.01em] whitespace-nowrap";

export type SegmentedOption = {
  value: string;
  label: ReactNode;
  accessibleLabel: string;
  disabled?: boolean;
};

export type SegmentedControlProps = {
  options: SegmentedOption[];
  label: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  role?: "radiogroup" | "tablist";
};

export function SegmentedControl({ options, label, value, defaultValue, onValueChange, className = "", role = "radiogroup" }: SegmentedControlProps) {
  const count = Math.max(1, options.length);
  const template = `repeat(${count}, minmax(0, 1fr))`;
  const firstEnabled = options.findIndex((option) => !option.disabled);
  const [internal, setInternal] = useState(() => defaultValue ?? options.find((option) => !option.disabled)?.value ?? "");
  const [hovered, setHovered] = useState(-1);
  const current = value ?? internal;
  const index = options.findIndex((option) => option.value === current && !option.disabled);
  const focusIndex = index >= 0 ? index : firstEnabled;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const reduced = useReducedMotion();
  const pos = useMotionValue(Math.max(0, index));
  const thumbX = useTransform(pos, (position) => `${position * 100}%`);
  const maskX = useTransform(pos, (position) => `${position * -100}%`);

  useEffect(() => {
    if (index < 0) return;
    if (reduced) {
      pos.set(index);
      return;
    }
    const controls = animate(pos, index, CELL);
    return () => controls.stop();
  }, [index, reduced, pos]);

  function select(next: string) {
    if (value === undefined) setInternal(next);
    if (next !== current) onValueChange?.(next);
  }

  function seek(from: number, direction: number) {
    let next = from;
    for (let step = 0; step < count; step++) {
      next = (next + direction + count) % count;
      if (!options[next]?.disabled) return next;
    }
    return from;
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, from: number) {
    let next: number;
    switch (event.key) {
      case "ArrowRight": case "ArrowDown": next = seek(from, 1); break;
      case "ArrowLeft": case "ArrowUp": next = seek(from, -1); break;
      case "Home": next = seek(count - 1, 1); break;
      case "End": next = seek(0, -1); break;
      default: return;
    }
    event.preventDefault();
    const option = options[next];
    if (!option || option.disabled) return;
    buttons.current[next]?.focus({ preventScroll: true });
    buttons.current[next]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    select(option.value);
  }

  if (!options.length) return null;

  return (
    <div role={role} aria-label={label} aria-orientation="horizontal" className={`segmented-control relative inline-block max-w-full min-w-0 select-none overflow-x-auto rounded-[9px] border border-stone-200 bg-stone-100/70 p-[3px] shadow-[inset_0_1px_2px_rgba(28,25,23,0.07)] dark:border-white/[0.16] dark:bg-[#1D1D1A] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)] ${className}`}>
      <div className="relative grid" style={{ gridTemplateColumns: template, minWidth: `calc(${count} * var(--segment-min-width, 0px))`, touchAction: "manipulation" }}>
        {options.map((option, optionIndex) => (
          <span key={option.value} aria-hidden="true" className={`${SEG} pointer-events-none ${option.disabled ? "text-stone-300 dark:text-stone-600" : hovered === optionIndex && optionIndex !== index ? "text-stone-700 dark:text-stone-200" : "text-stone-500 dark:text-stone-400"}`}>
            {option.label}
          </span>
        ))}
        {index >= 0 && <motion.div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden rounded-[6px] bg-stone-800 shadow-[0_1px_2px_rgba(28,25,23,0.28)] dark:bg-stone-100 dark:shadow-[0_1px_2px_rgba(0,0,0,0.5)]" style={{ width: `${100 / count}%`, x: thumbX }} initial={false}>
          <motion.div className="absolute inset-0" style={{ x: maskX }} initial={false}>
            <div className="absolute inset-y-0 left-0 grid" style={{ width: `${count * 100}%`, gridTemplateColumns: template }}>
              {options.map((option) => <span key={option.value} className={`${SEG} text-stone-50 dark:text-stone-900`}>{option.label}</span>)}
            </div>
          </motion.div>
        </motion.div>}
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: template }} onPointerLeave={() => setHovered(-1)}>
          {options.map((option, optionIndex) => (
            <button key={option.value} ref={(node) => { buttons.current[optionIndex] = node; }} type="button" role={role === "tablist" ? "tab" : "radio"}
              aria-selected={role === "tablist" ? optionIndex === index : undefined}
              aria-checked={role === "radiogroup" ? optionIndex === index : undefined}
              disabled={option.disabled} aria-disabled={option.disabled || undefined}
              tabIndex={optionIndex === focusIndex ? 0 : -1} title={option.accessibleLabel}
              onClick={() => select(option.value)} onKeyDown={(event) => onKeyDown(event, optionIndex)}
              onPointerEnter={() => !option.disabled && setHovered(optionIndex)}
              className="cursor-pointer rounded-[6px] border-0 bg-transparent p-0 outline-none focus-visible:bg-[#4568FF]/[0.06] focus-visible:shadow-[inset_0_0_0_1px_#4568FF] disabled:cursor-not-allowed dark:focus-visible:bg-[#93B0FF]/[0.08] dark:focus-visible:shadow-[inset_0_0_0_1px_#93B0FF]">
              <span className="sr-only">{option.accessibleLabel}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SegmentedControl;
