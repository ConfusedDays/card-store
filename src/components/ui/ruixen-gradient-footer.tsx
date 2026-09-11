"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

type GradientStop = { offset: number; color: string };

const VIEWBOX_WIDTH = 1271;
const VIEWBOX_HEIGHT = 599;

const DEFAULT_STOPS: GradientStop[] = [
  { offset: 0, color: "var(--charcoal)" },
  { offset: 0.2, color: "var(--teal-dark)" },
  { offset: 0.38, color: "var(--teal)" },
  { offset: 0.55, color: "color-mix(in srgb, var(--teal) 35%, white)" },
  { offset: 0.69, color: "var(--amber)" },
  { offset: 0.82, color: "color-mix(in srgb, var(--amber) 72%, var(--teal))" },
  { offset: 1, color: "color-mix(in srgb, var(--amber) 28%, transparent)" },
];

function bellHeights(count: number, peak: number, valley: number) {
  const mid = (count - 1) / 2;
  return Array.from({ length: count }, (_, index) => {
    const distance = mid === 0 ? 0 : Math.abs(index - mid) / mid;
    const eased = 1 - Math.pow(distance, 1.24);
    return peak * VIEWBOX_HEIGHT * (valley + (1 - valley) * eased);
  });
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export interface RuixenGradientFooterProps {
  children?: ReactNode;
  gradientHeight?: string;
  minReveal?: number;
  bars?: number;
  blur?: number;
  peak?: number;
  valley?: number;
  stops?: GradientStop[];
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  ariaLabelledBy?: string;
}

/** A fixed gradient band that rises into view during the final stretch of page scroll. */
export function RuixenGradientFooter({
  children,
  gradientHeight = "42vh",
  minReveal = 0.035,
  bars = 9,
  blur = 18,
  peak = 0.92,
  valley = 0.45,
  stops = DEFAULT_STOPS,
  className = "",
  style,
  ariaLabel,
  ariaLabelledBy,
}: RuixenGradientFooterProps) {
  const uid = useId().replace(/:/g, "");
  const footerRef = useRef<HTMLElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(minReveal);
  const [footerInView, setFooterInView] = useState(false);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) footer.classList.add("is-visible");
      setFooterInView(entry.isIntersecting);
    }, { threshold: 0.14 });
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const band = bandRef.current;
    if (!band) return;
    const doc = band.ownerDocument;
    const win = doc.defaultView ?? window;
    let frame = 0;

    const measure = () => {
      win.cancelAnimationFrame(frame);
      frame = win.requestAnimationFrame(() => {
        const height = band.offsetHeight || 1;
        const remaining = doc.documentElement.scrollHeight - win.innerHeight - win.scrollY;
        const progressAtEnd = clamp01((height - remaining) / height);
        setProgress(minReveal + (1 - minReveal) * progressAtEnd);
      });
    };

    measure();
    win.addEventListener("scroll", measure, { passive: true });
    win.addEventListener("resize", measure, { passive: true });
    return () => {
      win.cancelAnimationFrame(frame);
      win.removeEventListener("scroll", measure);
      win.removeEventListener("resize", measure);
    };
  }, [minReveal]);

  const columnWidth = VIEWBOX_WIDTH / bars;
  const heights = bellHeights(bars, peak, valley);

  return (
    <footer ref={footerRef} className={`ruixen-gradient-footer ${className}`.trim()} style={{ paddingBottom: gradientHeight, ...style }} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy}>
      {children}
      <div
        ref={bandRef}
        className="ruixen-gradient-footer-band"
        aria-hidden="true"
        style={{ height: gradientHeight, transform: `scaleY(${progress})`, opacity: footerInView ? undefined : 0 }}
      >
        <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={`ruixen-gradient-${uid}`} x1="0" y1="1" x2="0" y2="0">
              {stops.map((stop) => <stop key={`${stop.offset}-${stop.color}`} offset={stop.offset} stopColor={stop.color} />)}
            </linearGradient>
            <filter id={`ruixen-blur-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={blur} />
            </filter>
          </defs>
          {heights.map((height, index) => (
            <g key={index} filter={`url(#ruixen-blur-${uid})`}>
              <rect x={index * columnWidth} y={VIEWBOX_HEIGHT - height} width={columnWidth * 1.24} height={height} fill={`url(#ruixen-gradient-${uid})`} />
            </g>
          ))}
        </svg>
      </div>
    </footer>
  );
}
