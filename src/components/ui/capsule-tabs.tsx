"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface ScrollableTabItem {
  value: string;
  label: string;
  content?: React.ReactNode;
}

interface CapsuleTabsProps {
  items: ScrollableTabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  visibleCount?: number;
  ariaLabel?: string;
}

export default function CapsuleTabs({ items, value, defaultValue, onValueChange, className, visibleCount = 5, ariaLabel = "标签筛选" }: CapsuleTabsProps) {
  const reducedMotion = useReducedMotion();
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? items[0]?.value ?? "");
  const [page, setPage] = React.useState(0);
  const activeValue = value ?? internalValue;
  const totalPages = Math.max(1, Math.ceil(items.length / visibleCount));
  const currentPageTabs = React.useMemo(() => items.slice(page * visibleCount, page * visibleCount + visibleCount), [items, page, visibleCount]);

  const selectTab = (nextValue: string) => {
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
  };

  if (!items.length) return null;

  return (
    <Tabs value={activeValue} onValueChange={selectTab} className={cn("capsule-tabs", className)}>
      <div className="capsule-tabs-controls">
        {totalPages > 1 && <Button type="button" variant="ghost" size="icon" aria-label="上一组分类" onClick={() => setPage((current) => Math.max(current - 1, 0))} disabled={page === 0}><ChevronLeft size={17} /></Button>}
        <TabsList className="capsule-tabs-list" aria-label={ariaLabel}>
          {currentPageTabs.map((item) => (
            <TabsTrigger key={item.value} value={item.value} asChild>
              <motion.button
                type="button"
                className="capsule-tabs-trigger"
                whileHover={reducedMotion ? undefined : { y: -1 }}
                whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              >
                {item.label}
              </motion.button>
            </TabsTrigger>
          ))}
        </TabsList>
        {totalPages > 1 && <Button type="button" variant="ghost" size="icon" aria-label="下一组分类" onClick={() => setPage((current) => Math.min(current + 1, totalPages - 1))} disabled={page === totalPages - 1}><ChevronRight size={17} /></Button>}
      </div>
      {totalPages > 1 && <div className="capsule-tabs-pages" aria-label="分类分页">{Array.from({ length: totalPages }, (_, index) => <button key={index} type="button" className={cn("capsule-tabs-page", index === page && "active")} aria-label={`第 ${index + 1} 组分类`} aria-current={index === page ? "true" : undefined} onClick={() => setPage(index)} />)}</div>}
      {items.map((item) => item.content !== undefined && <TabsContent key={item.value} value={item.value}>{item.content}</TabsContent>)}
    </Tabs>
  );
}
