"use client";

import { useRef, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import {
  ThemeSwitcher,
  type ThemeSwitcherValue,
  type ThemeTransitionOrigin,
} from "@/components/ui/apple-liquid-glass-switcher";

const STORAGE_KEY = "card-store-theme";

type Theme = ThemeSwitcherValue;

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => {
    ready: Promise<void>;
    finished: Promise<void>;
  };
};

function getPreferredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark-mode", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

const subscribe = (onChange: () => void) => {
  window.addEventListener("card-store-theme-change", onChange);
  return () => window.removeEventListener("card-store-theme-change", onChange);
};

const getServerTheme = (): Theme => "light";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getPreferredTheme, getServerTheme);
  const transitioning = useRef(false);

  function commitTheme(nextTheme: Theme) {
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
    window.dispatchEvent(new Event("card-store-theme-change"));
  }

  async function setTheme(nextTheme: Theme, origin: ThemeTransitionOrigin) {
    if (nextTheme === theme || transitioning.current) return;

    const viewTransitionDocument = document as ViewTransitionDocument;
    const startViewTransition = viewTransitionDocument.startViewTransition;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!startViewTransition || reduceMotion) {
      commitTheme(nextTheme);
      return;
    }

    const radius = Math.hypot(
      Math.max(origin.x, window.innerWidth - origin.x),
      Math.max(origin.y, window.innerHeight - origin.y),
    );
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--theme-transition-x", `${origin.x}px`);
    rootStyle.setProperty("--theme-transition-y", `${origin.y}px`);
    rootStyle.setProperty("--theme-transition-radius", `${radius}px`);

    transitioning.current = true;
    document.documentElement.classList.add("telegram-theme-transition");
    document.documentElement.classList.add("telegram-theme-snapshot");
    document.documentElement.classList.toggle("telegram-theme-contract", nextTheme === "light");

    try {
      const transition = startViewTransition.call(document, () => {
        flushSync(() => commitTheme(nextTheme));
      });

      await transition.ready;
      document.documentElement.classList.remove("telegram-theme-snapshot");
      await transition.finished;
    } catch {
      commitTheme(nextTheme);
    } finally {
      document.documentElement.classList.remove("telegram-theme-snapshot");
      document.documentElement.classList.remove("telegram-theme-transition");
      document.documentElement.classList.remove("telegram-theme-contract");
      rootStyle.removeProperty("--theme-transition-x");
      rootStyle.removeProperty("--theme-transition-y");
      rootStyle.removeProperty("--theme-transition-radius");
      transitioning.current = false;
    }
  }

  return <ThemeSwitcher value={theme} onValueChange={setTheme} className={className} />;
}
