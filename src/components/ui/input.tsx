import * as React from "react";
import { cn } from "@/lib/utils";

const control =
  "flex w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input type={type} ref={ref} className={cn(control, "h-9 py-1", className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(control, "min-h-[72px] py-2 leading-relaxed", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(control, "h-9 cursor-pointer pr-8", className)} {...props} />
  ),
);
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-xs font-medium text-muted-foreground", className)} {...props} />;
}

/** Label + control + optional hint, stacked. */
export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Numeric input that keeps the user's raw text while typing (so "72," or ""
 * are allowed), accepts a decimal comma, and reports `undefined` when empty.
 */
export function NumberInput({
  value,
  onValueChange,
  className,
  min,
  max,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | undefined;
  onValueChange: (v: number | undefined) => void;
}) {
  const [text, setText] = React.useState(value == null ? "" : String(value));
  const last = React.useRef(value);
  // Sync when the value changes from outside (e.g. "use this value" buttons).
  if (value !== last.current) {
    last.current = value;
    const parsed = Number(text.replace(",", "."));
    if (value == null ? text !== "" : parsed !== value) setText(value == null ? "" : String(value));
  }
  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.,-]/g, "");
        setText(raw);
        const n = Number(raw.replace(",", "."));
        let next: number | undefined = raw.trim() === "" || Number.isNaN(n) ? undefined : n;
        if (next != null && min != null && next < Number(min)) next = Number(min);
        if (next != null && max != null && next > Number(max)) next = Number(max);
        last.current = next;
        onValueChange(next);
      }}
      className={cn(control, "h-9 py-1 lining-nums tabular-nums", className)}
    />
  );
}
