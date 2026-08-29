import Velaris from "@/components/ui/velaris";

const darkColors = ["#213c36", "#17665a", "#2d8c7d", "#0d1412"];

export function SiteBackground() {
  return (
    <Velaris
      className="site-background"
      height="100dvh"
      bg="#0d1412"
      colors={darkColors}
      speed={0.72}
      grain={0.13}
    />
  );
}
