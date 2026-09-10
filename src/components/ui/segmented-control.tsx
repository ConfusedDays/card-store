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
  columns?: number;
};

export function SegmentedControl({ options, label, value, defaultValue, onValueChange, className = "", role = "radiogroup", columns }: SegmentedControlProps) {
  const count = Math.max(1, options.length);
  const columnCount = Math.max(1, Math.min(columns ?? count, count));
  const rowCount = Math.ceil(count / columnCount);
  const template = `repeat(${columnCount}, minmax(0, 1fr))`;
  const rowTemplate = `repeat(${rowCount}, minmax(0, 1fr))`;
  const firstEnabled = options.findIndex((option) => !option.disabled);
  const [internal, setInternal] = useState(() => defaultValue ?? options.find((option) => !option.disabled)?.value ?? "");
  const [hovered, setHovered] = useState(-1);
  const current = value ?? internal;
  const index = options.findIndex((option) => option.value === current && !option.disabled);
  const focusIndex = index >= 0 ? index : firstEnabled;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const reduced = useReducedMotion();
  const column = Math.max(0, index) % columnCount;
  const row = Math.floor(Math.max(0, index) / columnCount);
  const pos = useMotionValue(column);
  const rowPos = useMotionValue(row);
  const thumbX = useTransform(pos, (position) => `${position * 100}%`);
  const maskX = useTransform(pos, (position) => `${position * -100}%`);
  const thumbY = useTransform(rowPos, (position) => `${position * 100}%`);
  const maskY = useTransform(rowPos, (position) => `${position * -100}%`);

  useEffect(() => {
    if (index < 0) return;
    if (reduced) {
      pos.set(column);
      rowPos.set(row);
      return;
    }
    const horizontal = animate(pos, column, CELL);
    const vertical = animate(rowPos, row, CELL);
    return () => { horizontal.stop(); vertical.stop(); };
  }, [index, column, row, reduced, pos, rowPos]);

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
    const seekRow = (direction: number) => {
      if (rowCount === 1) return seek(from, direction);
      for (let step = 1; step <= rowCount; step++) {
        const nextRow = (Math.floor(from / columnCount) + direction * step + rowCount) % rowCount;
        const next = Math.min(nextRow * columnCount + from % columnCount, options.length - 1);
        if (!options[next]?.disabled) return next;
      }
      return from;
    };
    let next: number;
    switch (event.key) {
      case "ArrowRight": next = seek(from, 1); break;
      case "ArrowLeft": next = seek(from, -1); break;
      case "ArrowDown": next = seekRow(1); break;
      case "ArrowUp": next = seekRow(-1); break;
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
    <div role={role} aria-label={label} aria-orientation="horizontal" className={`segmented-control relative inline-block max-w-full min-w-0 select-none overflow-x-auto rounded-[9px] p-[3px] ${className}`}>
      <div className="relative grid" style={{ gridTemplateColumns: template, gridTemplateRows: rowTemplate, minWidth: `calc(${columnCount} * var(--segment-min-width, 0px))`, touchAction: "manipulation" }}>
        {options.map((option, optionIndex) => (
          <span key={option.value} aria-hidden="true" className={`${SEG} pointer-events-none ${option.disabled ? "segmented-label-disabled" : hovered === optionIndex && optionIndex !== index ? "segmented-label-hover" : "segmented-label"}`}>
            {option.label}
          </span>
        ))}
        {index >= 0 && <motion.div aria-hidden="true" className="segmented-thumb pointer-events-none absolute top-0 left-0 overflow-hidden rounded-[6px]" style={{ width: `${100 / columnCount}%`, height: `${100 / rowCount}%`, x: thumbX, y: thumbY }} initial={false}>
          <motion.div className="absolute inset-0" style={{ x: maskX, y: maskY }} initial={false}>
            <div className="absolute top-0 left-0 grid" style={{ width: `${columnCount * 100}%`, height: `${rowCount * 100}%`, gridTemplateColumns: template, gridTemplateRows: rowTemplate }}>
              {options.map((option) => <span key={option.value} className={`${SEG} segmented-label-active`}>{option.label}</span>)}
            </div>
          </motion.div>
        </motion.div>}
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: template, gridTemplateRows: rowTemplate }} onPointerLeave={() => setHovered(-1)}>
          {options.map((option, optionIndex) => (
            <button key={option.value} ref={(node) => { buttons.current[optionIndex] = node; }} type="button" role={role === "tablist" ? "tab" : "radio"}
              aria-selected={role === "tablist" ? optionIndex === index : undefined}
              aria-checked={role === "radiogroup" ? optionIndex === index : undefined}
              disabled={option.disabled} aria-disabled={option.disabled || undefined}
              tabIndex={optionIndex === focusIndex ? 0 : -1} title={option.accessibleLabel}
              onClick={() => select(option.value)} onKeyDown={(event) => onKeyDown(event, optionIndex)}
              onPointerEnter={() => !option.disabled && setHovered(optionIndex)}
              className="segmented-button cursor-pointer rounded-[6px] border-0 bg-transparent p-0 outline-none disabled:cursor-not-allowed">
              <span className="sr-only">{option.accessibleLabel}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SegmentedControl;
