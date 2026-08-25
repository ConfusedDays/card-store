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

  function createBackdrop(theme: Theme, origin: ThemeTransitionOrigin, radius: number) {
    const backdrop = document.createElement("div");
    backdrop.className = `telegram-theme-backdrop telegram-theme-backdrop-${theme}`;
    backdrop.style.setProperty("--theme-transition-x", `${origin.x}px`);
    backdrop.style.setProperty("--theme-transition-y", `${origin.y}px`);
    backdrop.style.setProperty("--theme-transition-radius", `${radius}px`);

    const sourceCanvas = document.querySelector<HTMLCanvasElement>(".site-background canvas");
    if (sourceCanvas && getPreferredTheme() === theme) {
      const snapshot = document.createElement("canvas");
      snapshot.width = sourceCanvas.width;
      snapshot.height = sourceCanvas.height;
      snapshot.className = "telegram-theme-backdrop-canvas";
      snapshot.getContext("2d")?.drawImage(sourceCanvas, 0, 0);
      backdrop.append(snapshot);
    }

    document.body.append(backdrop);
    return backdrop;
  }

  async function setTheme(nextTheme: Theme, origin: ThemeTransitionOrigin) {
    if (nextTheme === theme || transitioning.current) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      commitTheme(nextTheme);
      return;
    }

    const radius = Math.hypot(
      Math.max(origin.x, window.innerWidth - origin.x),
      Math.max(origin.y, window.innerHeight - origin.y),
    );

    transitioning.current = true;
    document.documentElement.classList.add("telegram-theme-transition");
    const backdropTheme = nextTheme === "light" ? theme : nextTheme;
    const backdrop = createBackdrop(backdropTheme, origin, radius);
    const fullCircle = `circle(${radius}px at ${origin.x}px ${origin.y}px)`;
    const pointCircle = `circle(0px at ${origin.x}px ${origin.y}px)`;

    try {
      if (nextTheme === "light") {
        backdrop.style.clipPath = fullCircle;
        flushSync(() => commitTheme(nextTheme));
      }

      const animation = backdrop.animate(
        nextTheme === "light"
          ? [{ clipPath: fullCircle }, { clipPath: pointCircle }]
          : [{ clipPath: pointCircle }, { clipPath: fullCircle }],
        { duration: 560, easing: "cubic-bezier(.22, 1, .36, 1)", fill: "both" },
      );
      await animation.finished;

      if (nextTheme === "dark") {
        flushSync(() => commitTheme(nextTheme));
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      }
    } catch {
      commitTheme(nextTheme);
    } finally {
      backdrop.remove();
      document.documentElement.classList.remove("telegram-theme-transition");
      transitioning.current = false;
    }
  }

  return <ThemeSwitcher value={theme} onValueChange={setTheme} className={className} />;
}
