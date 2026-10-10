import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "muted" | "accent" | "destructive" }) {
  const styles = {
    default: "bg-brand-50 text-brand-700 border-brand-100",
    muted: "bg-muted text-muted-foreground border-transparent",
    accent: "bg-accent/10 text-accent-700 border-accent/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
  }[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = "brand",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "brand" | "accent" | "muted";
}) {
  return (
    <div className="card-surface min-w-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
        {icon && (
          <span
            className={cn(
              "hidden size-8 shrink-0 items-center justify-center rounded-lg sm:flex [&_svg]:size-4",
              tone === "brand" && "bg-brand-50 text-brand",
              tone === "accent" && "bg-accent/10 text-accent",
              tone === "muted" && "bg-muted text-muted-foreground",
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 truncate font-serif text-2xl font-semibold lining-nums tabular-nums text-foreground sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  back,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  back?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words font-serif text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-brand-50 text-brand [&_svg]:size-5">
          {icon}
        </span>
      )}
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const text = parts.length
    ? ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
    : "?";
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 font-serif text-sm font-semibold text-brand-700",
        className,
      )}
    >
      {text}
    </span>
  );
}
