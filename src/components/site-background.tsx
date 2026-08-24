"use client";

import { useSyncExternalStore } from "react";
import Velaris from "@/components/ui/velaris";

const lightColors = ["#eff8f5", "#cce9df", "#91cabc", "#f4f6f3"];
const darkColors = ["#213c36", "#17665a", "#2d8c7d", "#0d1412"];

function subscribe(onChange: () => void) {
  window.addEventListener("card-store-theme-change", onChange);
  return () => window.removeEventListener("card-store-theme-change", onChange);
}

function getTheme() {
  return document.documentElement.classList.contains("dark-mode") ? "dark" : "light";
}

export function SiteBackground() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light");
  const dark = theme === "dark";

  return (
    <Velaris
      key={theme}
      className="site-background"
      height="100dvh"
      bg={dark ? "#0d1412" : "#f4f6f3"}
      colors={dark ? darkColors : lightColors}
      speed={dark ? 0.72 : 0.58}
      grain={dark ? 0.13 : 0.08}
    />
  );
}
