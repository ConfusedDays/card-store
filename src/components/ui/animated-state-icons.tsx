"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AnimatedButtonIconProps = {
  idle: ReactNode;
  loading?: boolean;
  success?: boolean;
  className?: string;
  size?: number;
};

/**
 * A small, controlled state icon for action buttons.
 * The state is owned by the action so an icon never changes by itself while
 * the user is deciding what to click.
 */
export function AnimatedButtonIcon({ idle, loading = false, success = false, className, size = 18 }: AnimatedButtonIconProps) {
  const state = loading ? "loading" : success ? "success" : "idle";

  return (
    <span className={cn("animated-button-icon", className)} aria-hidden="true">
      <AnimatePresence initial={false} mode="wait">
        {state === "loading" ? (
          <motion.span key="loading" initial={{ opacity: 0, scale: 0.65, rotate: -90 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.65 }} transition={{ duration: 0.18 }}>
            <LoaderCircle className="spin" size={size} />
          </motion.span>
        ) : state === "success" ? (
          <motion.span key="success" initial={{ opacity: 0, scale: 0.65 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.65 }} transition={{ type: "spring", stiffness: 520, damping: 24 }}>
            <CheckCircle2 size={size} />
          </motion.span>
        ) : (
          <motion.span key="idle" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} whileHover={{ scale: 1.12, rotate: -4 }} whileTap={{ scale: 0.86, rotate: 0 }} transition={{ duration: 0.2 }}>
            {idle}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
