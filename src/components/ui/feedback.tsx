"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Dialog, DialogFooter } from "./dialog";

// ---------------------------------------------------------------------------
// App-wide feedback: toasts + a promise-based confirm dialog.
//   const { toast, confirm } = useFeedback();
//   if (await confirm({ title, body, destructive: true })) …
// ---------------------------------------------------------------------------

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}
interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

interface Feedback {
  toast: (message: string, kind?: ToastKind) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const Ctx = createContext<Feedback | null>(null);

export function useFeedback(): Feedback {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFeedback must be used inside <FeedbackProvider>");
  return ctx;
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("common");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "success") => {
      const id = ++seq.current;
      setToasts((all) => [...all.slice(-3), { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === "error" ? 6000 : 3000);
    },
    [dismiss],
  );

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })),
    [],
  );

  const close = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  const Icon = { success: CheckCircle2, error: AlertCircle, info: Info };

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}

      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((x) => {
          const I = Icon[x.kind];
          return (
            <div
              key={x.id}
              role={x.kind === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-lg animate-in fade-in-0 slide-in-from-bottom-2",
                x.kind === "error" ? "border-destructive/30" : "border-border",
              )}
            >
              <I
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  x.kind === "error" ? "text-destructive" : x.kind === "info" ? "text-accent" : "text-brand",
                )}
              />
              <p className="flex-1">{x.message}</p>
              <button onClick={() => dismiss(x.id)} className="text-muted-foreground hover:text-foreground" aria-label={t("close")}>
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {pending && (
        <Dialog title={pending.title} onClose={() => close(false)} size="sm">
          {pending.body && <p className="text-sm text-muted-foreground">{pending.body}</p>}
          <DialogFooter>
            {/* Destructive prompts focus "Cancel" so Enter never deletes by accident. */}
            <Button variant="ghost" onClick={() => close(false)} data-autofocus={pending.destructive ? "" : undefined}>
              {t("cancel")}
            </Button>
            <Button
              variant={pending.destructive ? "destructive" : "default"}
              onClick={() => close(true)}
              data-autofocus={pending.destructive ? undefined : ""}
            >
              {pending.confirmLabel ?? (pending.destructive ? t("delete") : t("confirm"))}
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </Ctx.Provider>
  );
}
