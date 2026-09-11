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
};

const character: Variants = {
  hover: { y: -3, filter: "blur(0px)", transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] } },
};

export function TextEffect({ children, className, delay = 0, per = "char", hover = false }: TextEffectProps) {
  const reducedMotion = useReducedMotion();
  const segments = per === "word" ? children.split(/(\s+)/) : Array.from(children);

  if (reducedMotion) return <span className={className}>{children}</span>;

  const stagger = per === "word" ? 0.13 : 0.11;

  return (
    <motion.span aria-label={children} className={cn("inline-flex whitespace-pre text-effect", className)} whileHover={hover ? "hover" : undefined} whileFocus={hover ? "hover" : undefined}>
      {segments.map((segment, index) => (
        <motion.span
          key={`${segment}-${index}`}
          aria-hidden="true"
          className="inline-block whitespace-pre text-effect-char"
          variants={character}
          style={{ "--text-effect-delay": `${delay + index * stagger}s` } as React.CSSProperties}
        >
          {segment}
        </motion.span>
      ))}
    </motion.span>
  );
}
