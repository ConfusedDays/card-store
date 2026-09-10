"use client";

import { useEffect, useRef, useState } from "react";

const names = ["Volt", "Potassium", "Matcha", "Wave", "Real"] as const;

export function StoreHeroTitle() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const heading = headingRef.current;
    if (!heading) return;
    let inView = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const syncTimer = () => {
      clearInterval(timer);
      timer = undefined;
      if (inView && !document.hidden) {
        timer = setInterval(() => setIndex((current) => (current + 1) % names.length), 3000);
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncTimer();
    });
    observer.observe(heading);
    document.addEventListener("visibilitychange", syncTimer);
    return () => {
      clearInterval(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncTimer);
    };
  }, []);

  return (
    <h1 id="store-hero-title" ref={headingRef} aria-label={`更简单地购买 ${names.join("、")} 卡密`}>
      更简单地购买<br />
      <span className="store-hero-title-line" aria-hidden="true">
        <span className="store-hero-title-spacer">Potassium 卡密</span>
        <span className="store-hero-title-current">
          <span key={index} className="store-hero-name">{names[index]}</span>
          卡密
        </span>
      </span>
    </h1>
  );
}
