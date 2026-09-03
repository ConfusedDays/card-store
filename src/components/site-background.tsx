"use client";

import { useEffect, useState } from "react";
import Velaris from "@/components/ui/velaris";

const darkColors = ["#213c36", "#17665a", "#2d8c7d", "#0d1412"];
const lightColors = ["#d9f3ed", "#9ed8cc", "#5fb6a5", "#f4f6f3"];

export function SiteBackground() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const syncTheme = () => setIsDark(document.documentElement.classList.contains("dark-mode"));
    syncTheme();
    window.addEventListener("reii-theme-change", syncTheme);
    return () => window.removeEventListener("reii-theme-change", syncTheme);
  }, []);

  return (
    <Velaris
      className="site-background"
      height="100dvh"
      bg={isDark ? "#0d1412" : "#f4f6f3"}
      colors={isDark ? darkColors : lightColors}
      speed={0.72}
      grain={0.13}
    />
  );
}
