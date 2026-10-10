"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  useEffect(() => console.error(error), [error]);
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </span>
      <h1 className="font-serif text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{t("body")}</p>
      {error.digest && <p className="mt-2 font-mono text-[11px] text-muted-foreground">ref: {error.digest}</p>}
      <Button className="mt-6" onClick={reset}>
        <RotateCcw /> {t("retry")}
      </Button>
    </div>
  );
}
