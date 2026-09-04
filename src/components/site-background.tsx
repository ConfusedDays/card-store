"use client";

import { useEffect, useState } from "react";
import Velaris from "@/components/ui/velaris";

const palettes = {
  teal: ["#213c36", "#17665a", "#2d8c7d", "#0d1412"],
  violet: ["#33284f", "#58418d", "#7d63c6", "#100d1a"],
  amber: ["#49351d", "#7c5524", "#b57420", "#171006"],
  ocean: ["#17384f", "#21678d", "#318bc3", "#07131d"],
  rose: ["#4d223b", "#863e68", "#ca5d93", "#1b0b15"],
};

export function SiteBackground() {
  const [accent, setAccent] = useState<keyof typeof palettes>("teal");

  useEffect(() => {
    const syncTheme = () => setAccent((document.documentElement.dataset.accent as keyof typeof palettes) || "teal");
    syncTheme();
    window.addEventListener("reii-theme-change", syncTheme);
    return () => window.removeEventListener("reii-theme-change", syncTheme);
  }, []);

  return (
    <Velaris
      className="site-background"
      height="100dvh"
      bg={palettes[accent][3]}
      colors={palettes[accent]}
      speed={0.72}
      grain={0.13}
    />
  );
}
