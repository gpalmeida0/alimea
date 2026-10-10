import { cn } from "@/lib/utils";

/** The Alimea mark: a squared "a" over a base line. Inherits the text colour. */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 158 195" fill="currentColor" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} className={className}>
      {title && <title>{title}</title>}
      <path fillRule="evenodd" d="M0 0H147V98Q148 107 158 108V143H0ZM37 36H107Q98 90 37 105Z" />
      <rect y="158" width="147" height="37" />
    </svg>
  );
}

/** Mark + lowercase wordmark, used wherever the product names itself. */
export function Logo({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  const lg = size === "lg";
  return (
    <span className={cn("inline-flex items-center text-foreground", lg ? "gap-3" : "gap-2.5", className)}>
      <LogoMark className={lg ? "h-10 w-auto" : "h-7 w-auto"} />
      <span className={cn("font-logo font-semibold lowercase leading-none tracking-tight", lg ? "text-4xl" : "text-2xl")}>alimea</span>
    </span>
  );
}
