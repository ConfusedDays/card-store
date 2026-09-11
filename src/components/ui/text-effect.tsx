"use client";

import * as React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";

type TextEffectProps = {
  children: string;
  className?: string;
  delay?: number;
  per?: "word" | "char";
  hover?: boolean;
  forceMotion?: boolean;
  duration?: number;
  stagger?: number;
};

const character: Variants = {
  hidden: { opacity: 0, y: "0.9em", rotateX: 90, scale: 0.88, filter: "blur(12px)" },
  visible: ({ delay }: { delay: number }) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { delay, duration: 1.3, ease: [0.16, 1, 0.3, 1] },
  }),
  hover: { y: -3, filter: "blur(0px)", transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] } },
};

export function TextEffect({ children, className, delay = 0, per = "char", hover = false, forceMotion = false, duration = 1.3, stagger: staggerProp }: TextEffectProps) {
  const reducedMotion = useReducedMotion();
  const segments = per === "word" ? children.split(/(\s+)/) : Array.from(children);

  if (reducedMotion && !forceMotion) return <span className={className}>{children}</span>;

  const stagger = staggerProp ?? (per === "word" ? 0.2 : 0.17);

  return (
    <motion.span aria-label={children} className={cn("inline-flex whitespace-pre text-effect", className)} whileHover={hover ? "hover" : undefined} whileFocus={hover ? "hover" : undefined}>
      {segments.map((segment, index) => (
        <motion.span
          key={`${segment}-${index}`}
          aria-hidden="true"
          className="inline-block whitespace-pre text-effect-char"
          initial="hidden"
          animate="visible"
          custom={{ delay: delay + index * stagger, duration }}
          variants={character}
        >
          {segment}
        </motion.span>
      ))}
    </motion.span>
  );
}
