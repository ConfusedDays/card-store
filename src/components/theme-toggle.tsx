"use client";

import { Check, Moon, Palette, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "reii-theme";
const ACCENT_STORAGE_KEY = "reii-accent";
const accents = [
  { id: "teal", label: "青绿" },
  { id: "violet", label: "紫罗兰" },
  { id: "amber", label: "琥珀金" },
] as const;
type Accent = (typeof accents)[number]["id"];

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);
  const [accent, setAccent] = useState<Accent>("teal");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) !== "light") return;
      const frame = window.requestAnimationFrame(() => setIsDark(false));
      return () => window.cancelAnimationFrame(frame);
    } catch {
      // Keep the default theme when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    try {
      const savedAccent = window.localStorage.getItem(ACCENT_STORAGE_KEY);
      if (!accents.some((item) => item.id === savedAccent)) return;
      const frame = window.requestAnimationFrame(() => setAccent(savedAccent as Accent));
      return () => window.cancelAnimationFrame(frame);
    } catch {
      // Keep the brand default when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark-mode", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    try {
      window.localStorage.setItem(STORAGE_KEY, isDark ? "dark" : "light");
    } catch {
      // A blocked storage area should not prevent users from switching themes.
    }
    window.dispatchEvent(new Event("reii-theme-change"));
  }, [isDark]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    try {
      window.localStorage.setItem(ACCENT_STORAGE_KEY, accent);
    } catch {
      // Accent selection still applies for the current visit when storage is unavailable.
    }
    window.dispatchEvent(new Event("reii-theme-change"));
  }, [accent]);

  function toggleTheme() {
    setIsDark((current) => !current);
  }

  return (
    <div className="theme-control">
      {isOpen && (
        <section className="theme-panel" aria-label="主题设置">
          <span className="theme-panel-title">主题颜色</span>
          <div className="theme-swatches" role="group" aria-label="选择主题颜色">
            {accents.map((item) => (
              <button key={item.id} type="button" className={`theme-swatch theme-swatch-${item.id}`} onClick={() => setAccent(item.id)} aria-pressed={accent === item.id}>
                <span aria-hidden="true" />{item.label}{accent === item.id && <Check size={13} aria-hidden="true" />}
              </button>
            ))}
          </div>
          <button type="button" className="theme-mode-button" onClick={toggleTheme}>
            {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
            {isDark ? "切换浅色模式" : "切换深色模式"}
          </button>
        </section>
      )}
      <button type="button" className="theme-toggle" onClick={() => setIsOpen((open) => !open)} aria-expanded={isOpen} aria-label="打开主题设置" title="主题设置">
        <Palette size={19} aria-hidden="true" />
      </button>
    </div>
  );
}
