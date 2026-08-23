"use client";

import { Moon, Sun } from "lucide-react";

export type ThemeSwitcherValue = "light" | "dark";
export type ThemeTransitionOrigin = { x: number; y: number };

interface ThemeSwitcherProps {
  value: ThemeSwitcherValue;
  onValueChange: (theme: ThemeSwitcherValue, origin: ThemeTransitionOrigin) => void;
  className?: string;
}

export function ThemeSwitcher({ value, onValueChange, className = "" }: ThemeSwitcherProps) {
  const isDark = value === "dark";
  const nextTheme = isDark ? "light" : "dark";
  const label = isDark ? "切换到日间模式" : "切换到夜间模式";

  return (
    <button
      className={`theme-toggle telegram-theme-toggle ${className}`.trim()}
      type="button"
      data-theme={value}
      aria-label={label}
      title={label}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const keyboardTriggered = event.detail === 0;
        onValueChange(nextTheme, {
          x: keyboardTriggered ? rect.left + rect.width / 2 : event.clientX,
          y: keyboardTriggered ? rect.top + rect.height / 2 : event.clientY,
        });
      }}
    >
      <span className="telegram-theme-icon" key={value} aria-hidden="true">
        {isDark ? <Moon size={19} /> : <Sun size={19} />}
      </span>
    </button>
  );
}