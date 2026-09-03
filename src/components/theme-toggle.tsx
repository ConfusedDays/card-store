"use client";

import { Check, Palette } from "lucide-react";
import { useEffect, useState } from "react";

const ACCENT_STORAGE_KEY = "reii-accent";
const accents = [
  { id: "teal", label: "青绿" },
  { id: "violet", label: "紫罗兰" },
  { id: "amber", label: "琥珀金" },
] as const;
type Accent = (typeof accents)[number]["id"];

export function ThemeToggle() {
  const [accent, setAccent] = useState<Accent>("teal");
  const [isOpen, setIsOpen] = useState(false);

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
    document.documentElement.dataset.accent = accent;
    try {
      window.localStorage.setItem(ACCENT_STORAGE_KEY, accent);
    } catch {
      // Accent selection still applies for the current visit when storage is unavailable.
    }
    window.dispatchEvent(new Event("reii-theme-change"));
  }, [accent]);

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
        </section>
      )}
      <button type="button" className="theme-toggle" onClick={() => setIsOpen((open) => !open)} aria-expanded={isOpen} aria-label="打开主题设置" title="主题设置">
        <Palette size={19} aria-hidden="true" />
      </button>
    </div>
  );
}
