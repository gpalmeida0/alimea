"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bell, CalendarClock } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { cn, formatDate } from "@/lib/utils";

export interface UpcomingAppt {
  id: string;
  clientId: string;
  clientName: string;
  date: string; // ISO
}

export function Notifications({ upcoming }: { upcoming: UpcomingAppt[] }) {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Re-evaluate countdowns every 30s.
  useEffect(() => {
    const i = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);

  const items = useMemo(() => {
    return upcoming
      .map((a) => ({ ...a, mins: Math.round((new Date(a.date).getTime() - nowMs) / 60000) }))
      .filter((a) => a.mins >= -15)
      .sort((a, b) => a.mins - b.mins);
  }, [upcoming, nowMs]);

  // "Imminent" = within the next 60 minutes.
  const imminent = items.filter((a) => a.mins <= 60);
  const count = imminent.length;

  const label = (mins: number, name: string) => {
    const firstName = name.split(" ")[0];
    if (mins <= 0) return t("now", { name: firstName });
    if (mins < 60) return t("inMin", { min: mins, name: firstName });
    return t("inHours", { h: Math.round(mins / 60), name: firstName });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-9 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-muted"
        aria-label={t("title")}
        aria-expanded={open}
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
            {count}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* click-outside catcher */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-2 shadow-2xl animate-fade-in">
            <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("title")}
            </p>
            {items.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">{t("none")}</p>
            )}
            {items.slice(0, 8).map((a) => {
              const soon = a.mins <= 60;
              return (
                <button
                  key={a.id}
                  onClick={() => {
                    setOpen(false);
                    router.push(`/clients/${a.clientId}`);
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full",
                      soon ? "bg-accent/15 text-accent" : "bg-brand-50 text-brand-600",
                    )}
                  >
                    <CalendarClock className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block truncate text-sm", soon ? "font-semibold text-accent" : "font-medium")}>
                      {label(a.mins, a.clientName)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(a.date, locale, {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
