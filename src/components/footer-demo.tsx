"use client";

import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";

const ASCII = " .,:;irsXA253hMHGS#9B&@";
const ORANGE = { r: 255, g: 106, b: 0 };

type HandSide = "left" | "right";

function hash(index: number, seed: number) {
  const value = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function AsciiHand({ side }: { side: HandSide }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: -100, y: -100, active: false });

  useEffect(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;

    let frame = 0;
    let disposed = false;
    const cell = { width: 0, height: 0, cols: 0, rows: 0 };
    let pixels: Uint8ClampedArray | null = null;
    let highlights: { x: number; y: number; radius: number; phase: number }[] = [];
    const sample = document.createElement("canvas");
    const sampleContext = sample.getContext("2d", { willReadFrequently: true });
    const context = canvas.getContext("2d");
    if (!sampleContext || !context) return;

    const rebuild = () => {
      if (!image.naturalWidth || !image.naturalHeight) return;
      const compact = window.matchMedia("(max-width: 720px)").matches;
      cell.cols = compact ? 52 : 78;
      cell.rows = Math.max(20, Math.floor(cell.cols * image.naturalHeight / image.naturalWidth * 0.48));
      cell.width = canvas.clientWidth / cell.cols;
      cell.height = canvas.clientHeight / cell.rows;
      sample.width = cell.cols;
      sample.height = cell.rows;
      sampleContext.clearRect(0, 0, cell.cols, cell.rows);
      sampleContext.drawImage(image, 0, 0, cell.cols, cell.rows);
      pixels = sampleContext.getImageData(0, 0, cell.cols, cell.rows).data;
      highlights = Array.from({ length: 22 }, (_, index) => ({
        x: Math.floor(hash(index, side === "left" ? 8 : 19) * cell.cols),
        y: Math.floor(hash(index, side === "left" ? 14 : 31) * cell.rows),
        radius: 1.4 + hash(index, 4) * 2.9,
        phase: hash(index, 29) * Math.PI * 2,
      }));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.font = `${Math.max(8, cell.height * 1.2)}px "Courier New", monospace`;
      context.textBaseline = "middle";
    };
    const resizeObserver = new ResizeObserver(rebuild);

    const draw = (time: number) => {
      if (disposed) return;
      frame = requestAnimationFrame(draw);
      if (!pixels || !cell.cols || !cell.rows) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      context.clearRect(0, 0, width, height);
      const pointer = pointerRef.current;
      const cursorX = pointer.x / Math.max(width, 1) * cell.cols;
      const cursorY = pointer.y / Math.max(height, 1) * cell.rows;
      for (let y = 0; y < cell.rows; y += 1) {
        for (let x = 0; x < cell.cols; x += 1) {
          const pixel = (y * cell.cols + x) * 4;
          const brightness = (pixels[pixel] * 0.299 + pixels[pixel + 1] * 0.587 + pixels[pixel + 2] * 0.114) / 255;
          if (brightness < 0.09) continue;
          const drift = Math.sin(time * 0.0012 + x * 0.16 + y * 0.07) * 0.05;
          const level = Math.max(0, Math.min(ASCII.length - 1, Math.floor((brightness + drift) * (ASCII.length - 1))));
          const distance = Math.hypot(x - cursorX, y - cursorY);
          const cursorGlow = pointer.active ? Math.max(0, 1 - distance / 5.5) : 0;
          const clusterGlow = highlights.reduce((best, cluster) => {
            const clusterDistance = Math.hypot(x - cluster.x, y - cluster.y);
            const pulse = 0.68 + Math.sin(time * 0.002 + cluster.phase) * 0.16;
            return Math.max(best, Math.max(0, 1 - clusterDistance / cluster.radius) * pulse);
          }, 0);
          const glow = Math.max(cursorGlow, clusterGlow * 0.34);
          const alpha = Math.min(1, 0.26 + brightness * 0.63 + glow * 0.22);
          context.fillStyle = `rgba(${ORANGE.r}, ${Math.min(190, ORANGE.g + glow * 72)}, ${Math.min(50, ORANGE.b + glow * 18)}, ${alpha})`;
          context.fillText(ASCII[level], x * cell.width + cell.width * 0.08, y * cell.height + cell.height * 0.54);
        }
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointerRef.current = { x: event.clientX - bounds.left, y: event.clientY - bounds.top, active: true };
    };
    const onPointerLeave = () => {
      pointerRef.current.active = false;
    };
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    if (image.complete) rebuild();
    else image.addEventListener("load", rebuild, { once: true });
    resizeObserver.observe(canvas);
    frame = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [side]);

  return (
    <div className={`footer-demo-hand footer-demo-hand-${side}`}>
      <Image ref={imageRef} src={`/${side}.png`} width={1536} height={1024} unoptimized alt="" className="footer-demo-hand-source" />
      <canvas ref={canvasRef} className="footer-demo-hand-canvas" aria-label={`${side === "left" ? "左" : "右"}侧 ASCII 手部画面`} />
    </div>
  );
}

export function FooterDemo() {
  const footerRef = useRef<HTMLElement>(null);
  const revealerRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger, SplitText);
    const footer = footerRef.current;
    const revealer = revealerRef.current;
    if (!footer || !revealer) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const leftHand = footer.querySelector<HTMLElement>(".footer-demo-hand-left");
    const rightHand = footer.querySelector<HTMLElement>(".footer-demo-hand-right");
    const headingWords = Array.from(footer.querySelectorAll<HTMLElement>(".footer-demo-heading-word"));
    const revealLines = Array.from(footer.querySelectorAll<HTMLElement>("[data-footer-reveal-line]"));
    const headingSplits = headingWords.map((word) => new SplitText(word, { type: "chars", charsClass: "footer-demo-char" }));
    const lineSplits = revealLines.map((line) => new SplitText(line, { type: "lines", linesClass: "footer-demo-line" }));
    const chars = headingSplits.flatMap((split) => split.chars);
    const lines = lineSplits.flatMap((split) => split.lines);
    const hands = [leftHand, rightHand].filter((hand): hand is HTMLElement => Boolean(hand));
    const timeline = gsap.timeline({ paused: true, defaults: { ease: "expo.out" } });
    gsap.set(chars, { yPercent: 115, opacity: 0 });
    gsap.set(lines, { yPercent: 110, opacity: 0 });
    gsap.set(hands, { opacity: 0, xPercent: (index) => index === 0 ? -34 : 34 });
    gsap.set(footer.querySelectorAll(".footer-demo-nav, .footer-demo-description, .footer-demo-meta"), { opacity: 0, y: 18 });
    timeline
      .to(hands, { opacity: 1, xPercent: 0, duration: 1.15, stagger: 0.1 }, 0)
      .to(footer.querySelectorAll(".footer-demo-nav, .footer-demo-description, .footer-demo-meta"), { opacity: 1, y: 0, duration: 0.72, stagger: 0.08 }, 0.22)
      .to(chars, { yPercent: 0, opacity: 1, duration: 0.88, stagger: { each: 0.035, from: "center" } }, 0.3)
      .to(lines, { yPercent: 0, opacity: 1, duration: 0.62, stagger: 0.08 }, 0.44);
    if (reduceMotion) timeline.progress(1).pause();

    const lenis = reduceMotion ? null : new Lenis({ autoRaf: false, lerp: 0.085, smoothWheel: true, syncTouch: false });
    const onTick = (time: number) => {
      lenis?.raf(time * 1000);
      ScrollTrigger.update();
    };
    if (lenis) gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);
    const trigger = ScrollTrigger.create({
      trigger: revealer,
      start: "top 62%",
      onEnter: () => timeline.play(),
      onLeaveBack: () => timeline.reverse(),
    });
    const onPointerMove = (event: PointerEvent) => {
      pointerRef.current.x = (event.clientX / window.innerWidth - 0.5) * 2;
      pointerRef.current.y = (event.clientY / window.innerHeight - 0.5) * 2;
    };
    const drift = () => {
      const { x, y } = pointerRef.current;
      if (!reduceMotion) {
        gsap.set(leftHand, { x: x * 24, y: y * 13, rotation: x * 1.1 });
        gsap.set(rightHand, { x: x * -24, y: y * -13, rotation: x * -1.1 });
      }
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    gsap.ticker.add(drift);
    ScrollTrigger.refresh();
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      gsap.ticker.remove(drift);
      if (lenis) {
        gsap.ticker.remove(onTick);
        lenis.destroy();
      }
      trigger.kill();
      timeline.kill();
      headingSplits.forEach((split) => split.revert());
      lineSplits.forEach((split) => split.revert());
    };
  }, []);

  const nudgeScroll = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    document.querySelector(".footer-demo-revealer")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className="footer-demo-page">
      <div className="footer-demo-foreground">
        <section className="footer-demo-section footer-demo-section-intro">
          <span className="footer-demo-eyebrow">REIISHOP / DIGITAL GOODS</span>
          <h1>Build a world<br /><em>worth scrolling.</em></h1>
          <p>A small study in movement, texture and the useful pause before a page ends.</p>
          <button type="button" className="footer-demo-scroll-cue" onClick={nudgeScroll}>Scroll to explore <span>↓</span></button>
        </section>
        <section className="footer-demo-section footer-demo-section-grid">
          <div className="footer-demo-grid-mark" aria-hidden="true">02</div>
          <div>
            <span className="footer-demo-eyebrow">THE INTERFACE IS THE INVITATION</span>
            <h2>Every layer<br /><em>keeps moving.</em></h2>
          </div>
          <p>Designed around a direct path: discover, select, receive. The quiet in between is where the details earn their place.</p>
        </section>
        <section className="footer-demo-section footer-demo-section-signal">
          <span className="footer-demo-eyebrow">A SIGNAL IN THE DARK</span>
          <div className="footer-demo-signal-word" aria-hidden="true">REII</div>
          <p>When the cursor arrives, the surface responds. Keep scrolling.</p>
        </section>
        <div ref={revealerRef} className="footer-demo-revealer" aria-hidden="true" />
      </div>

      <footer ref={footerRef} className="footer-demo-footer" aria-label="ReiiShop footer">
        <div className="footer-demo-footer-noise" aria-hidden="true" />
        <div className="footer-demo-footer-top">
          <Link className="footer-demo-wordmark" href="/">ReiiShop<span>®</span></Link>
          <span className="footer-demo-status"><i /> Available for a good idea</span>
          <span className="footer-demo-coordinates">25° 02′ N / 121° 33′ E</span>
        </div>
        <div className="footer-demo-hands" aria-hidden="true">
          <AsciiHand side="left" />
          <AsciiHand side="right" />
        </div>
        <div className="footer-demo-content">
          <nav className="footer-demo-nav" aria-label="Footer navigation" data-footer-reveal-line>
            <Link href="/">Shop <span>↗</span></Link>
            <Link href="/orders">Orders <span>↗</span></Link>
            <Link href="/policies">Policies <span>↗</span></Link>
            <a href="mailto:hello@reiishop.cn">Contact <span>↗</span></a>
          </nav>
          <p className="footer-demo-description" data-footer-reveal-line>ReiiShop is a small digital goods studio. We make the last step feel as considered as the first — clear products, secure delivery, no wasted motion.</p>
          <div className="footer-demo-meta" data-footer-reveal-line><span>© 2026 ReiiShop</span><span>Made with intent</span></div>
        </div>
        <div className="footer-demo-heading" aria-label="Blank / Canvas">
          <span className="footer-demo-heading-word">Blank</span>
          <span className="footer-demo-heading-slash"> / </span>
          <span className="footer-demo-heading-word">Canvas</span>
        </div>
      </footer>
    </main>
  );
}
