"use client";

import * as React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";

type TextEffectProps = {
  children: string;
  className?: string;
  delay?: number;
  per?: "word" | "char";
};

const container: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const character: Variants = {
  hidden: { opacity: 0, y: 5, filter: "blur(3px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
};

export function TextEffect({ children, className, delay = 0, per = "char" }: TextEffectProps) {
  const reducedMotion = useReducedMotion();
  const segments = per === "word" ? children.split(/(\s+)/) : Array.from(children);

  if (reducedMotion) return <span className={className}>{children}</span>;

  return (
    <motion.span
      aria-label={children}
      className={cn("inline-flex whitespace-pre", className)}
      variants={container}
      initial="hidden"
      animate="visible"
      transition={{ delay, staggerChildren: per === "word" ? 0.045 : 0.035 }}
    >
      {segments.map((segment, index) => (
        <motion.span
          key={`${segment}-${index}`}
          aria-hidden="true"
          className="inline-block whitespace-pre"
          variants={character}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {segment}
        </motion.span>
      ))}
    </motion.span>
  );
}
