"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const labels: Record<string, string> = { "pt-PT": "PT", en: "EN" };

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchTo(next: string) {
    // Preserve the current route when changing interface language.
    router.replace(pathname, { locale: next });
  }

  return (
    <div className="inline-flex rounded-md border border-border bg-card p-0.5">
      {routing.locales.map((l) => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-semibold transition-colors",
            locale === l
              ? "bg-brand text-white"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {labels[l] ?? l}
        </button>
      ))}
    </div>
  );
}
