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

type ViewTransitionAnimationOptions = KeyframeAnimationOptions & {
  pseudoElement: string;
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

    transitioning.current = true;
    document.documentElement.classList.add("telegram-theme-transition");
    document.documentElement.classList.toggle("telegram-theme-contract", nextTheme === "light");

    try {
      const transition = startViewTransition.call(document, () => {
        flushSync(() => commitTheme(nextTheme));
      });

      await transition.ready;
      const radius = Math.hypot(
        Math.max(origin.x, window.innerWidth - origin.x),
        Math.max(origin.y, window.innerHeight - origin.y),
      );
      const contracting = nextTheme === "light";

      const circularAnimation = document.documentElement.animate(
        {
          clipPath: contracting
            ? [
                `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
                `circle(0px at ${origin.x}px ${origin.y}px)`,
              ]
            : [
                `circle(0px at ${origin.x}px ${origin.y}px)`,
                `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
              ],
        },
        {
          duration: 560,
          easing: "cubic-bezier(.22, 1, .36, 1)",
          pseudoElement: contracting
            ? "::view-transition-old(root)"
            : "::view-transition-new(root)",
        } as ViewTransitionAnimationOptions,
      );

      await Promise.all([circularAnimation.finished, transition.finished]);
    } catch {
      commitTheme(nextTheme);
    } finally {
      document.documentElement.classList.remove("telegram-theme-transition");
      document.documentElement.classList.remove("telegram-theme-contract");
      transitioning.current = false;
    }
  }

  return <ThemeSwitcher value={theme} onValueChange={setTheme} className={className} />;
}