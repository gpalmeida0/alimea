"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LogOut, Loader2 } from "lucide-react";
import { logoutAction } from "@/app/auth-actions";
import { cn } from "@/lib/utils";

export function LogoutButton({ className }: { className?: string }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => logoutAction(locale))}
      disabled={pending}
      className={cn(
        "flex items-center gap-2 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50",
        className,
      )}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
      {t("logout")}
    </button>
  );
}
