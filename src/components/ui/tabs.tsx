"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Segmented control used for page-level and in-card tabs. */
export function Segmented<T extends string>({
  value,
  onChange,
  items,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: React.ReactNode; icon?: React.ReactNode; badge?: React.ReactNode }[];
  className?: string;
  size?: "sm" | "md";
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Keep the active tab visible when the strip scrolls horizontally.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);

  return (
    <div
      ref={ref}
      role="tablist"
      className={cn(
        "inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg border border-border bg-card p-0.5 scroll-thin",
        className,
      )}
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cn(
              "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors [&_svg]:size-4",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
              active ? "bg-brand text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {it.icon}
            {it.label}
            {it.badge}
          </button>
        );
      })}
    </div>
  );
}
