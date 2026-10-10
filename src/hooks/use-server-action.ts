"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useFeedback } from "@/components/ui/feedback";

/** True for the special error Next.js throws to perform redirect()/notFound(). */
function isNavigation(e: unknown): boolean {
  const digest = (e as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND");
}

/**
 * Run server actions from client components with a pending state, a router
 * refresh afterwards and an error toast instead of an unhandled rejection.
 *
 *   const { run, pending } = useServerAction();
 *   run(() => deleteFoo(locale, id), { success: t("deleted") });
 */
export function useServerAction() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useFeedback();
  const t = useTranslations("common");

  const run = useCallback(
    <T,>(
      fn: () => Promise<T>,
      opts: { success?: string; onDone?: (result: T) => void; refresh?: boolean } = {},
    ) =>
      new Promise<T | undefined>((resolve) => {
        start(async () => {
          try {
            const result = await fn();
            if (opts.refresh !== false) router.refresh();
            if (opts.success) toast(opts.success);
            opts.onDone?.(result);
            resolve(result);
          } catch (e) {
            if (isNavigation(e)) throw e;
            console.error(e);
            toast(t("error"), "error");
            resolve(undefined);
          }
        });
      }),
    [router, toast, t],
  );

  return { run, pending };
}
