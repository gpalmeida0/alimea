"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarX, Clock, Receipt, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/tabs";
import {
  PERIODS,
  attendance,
  byType,
  outstanding,
  percentChange,
  periodRange,
  revenueSeries,
  summarize,
  topClients,
  type Bucket,
  type Group,
  type Period,
} from "@/lib/billing/metrics";
import type { Appointment, BillingEntry } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export function BillingInsights({
  entries,
  appointments,
  today,
}: {
  entries: BillingEntry[];
  appointments: Pick<Appointment, "date" | "status">[];
  /** Today in the clinic's time zone (YYYY-MM-DD), computed on the server. */
  today: string;
}) {
  const t = useTranslations("billing.insights");
  const locale = useLocale();
  const [period, setPeriod] = useState<Period>("month");

  const eur = useMemo(
    () => new Intl.NumberFormat(locale === "en" ? "en-IE" : "pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }),
    [locale],
  );

  const data = useMemo(() => {
    const range = periodRange(period, today);
    const previous = periodRange(period, today, -1);
    return {
      range,
      current: summarize(entries, range),
      previous: summarize(entries, previous),
      series: revenueSeries(entries, period, range),
      types: byType(entries, range),
      clients: topClients(entries, range),
      owed: outstanding(entries, today),
      attendance: attendance(appointments, range),
    };
  }, [entries, appointments, period, today]);

  const { current, previous } = data;
  const rangeLabel =
    period === "year"
      ? data.range.start.slice(0, 4)
      : period === "month"
        ? formatDate(data.range.start, locale, { month: "long", year: "numeric" })
        : `${formatDate(data.range.start, locale, { day: "numeric", month: "short" })} – ${formatDate(data.range.end, locale, { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <section className="space-y-4" aria-label={t("title")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented size="sm" value={period} onChange={setPeriod} items={PERIODS.map((p) => ({ value: p, label: t(`periods.${p}`) }))} />
        <p className="text-sm text-muted-foreground first-letter:uppercase">{rangeLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          label={t("billed")}
          value={eur.format(current.billed)}
          icon={<Receipt />}
          hint={<Trend change={percentChange(current.billed, previous.billed)} label={t(`vsPrevious.${period}`)} empty={t("noBaseline")} />}
        />
        <Stat
          label={t("received")}
          value={eur.format(current.paid)}
          icon={<Wallet />}
          hint={<Trend change={percentChange(current.paid, previous.paid)} label={t(`vsPrevious.${period}`)} empty={t("noBaseline")} />}
        />
        <Stat label={t("toReceive")} value={eur.format(current.pending)} icon={<Clock />} tone="accent" hint={t("outstandingAll", { amount: eur.format(data.owed.total) })} />
        <Stat
          label={t("consultations")}
          value={current.count}
          icon={<Users />}
          tone="muted"
          hint={current.average == null ? t("noEntries") : t("average", { amount: eur.format(current.average) })}
        />
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-lg">{t(`chartTitle.${period}`)}</CardTitle>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Legend className="bg-brand" label={t("received")} />
            <Legend className="bg-accent/60" label={t("toReceive")} />
          </div>
        </CardHeader>
        <CardContent>
          <RevenueChart series={data.series} period={period} locale={locale} format={(n) => eur.format(n)} empty={t("noEntries")} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("byType")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Breakdown groups={data.types} format={(n) => eur.format(n)} countLabel={(n) => t("entryCount", { count: n })} empty={t("noEntries")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("topClients")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Breakdown groups={data.clients} format={(n) => eur.format(n)} countLabel={(n) => t("entryCount", { count: n })} empty={t("noEntries")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("outstanding")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("outstandingHint")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.owed.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("nothingOwed")}</p>
            ) : (
              <ul className="space-y-2.5">
                {data.owed.items.slice(0, 5).map(({ entry, days }) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{entry.clientName || "—"}</span>
                      <span className={cn("text-xs", days > 30 ? "text-accent-700" : "text-muted-foreground")}>{t("daysAgo", { count: days })}</span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{eur.format(entry.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            {data.owed.items.length > 5 && <p className="text-xs text-muted-foreground">{t("moreOwed", { count: data.owed.items.length - 5 })}</p>}
            <p className="flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
              <CalendarX className="size-4 shrink-0" />
              {data.attendance.cancellationRate == null
                ? t("noAppointments")
                : t("cancellations", { cancelled: data.attendance.cancelled, total: data.attendance.total, rate: data.attendance.cancellationRate })}
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Trend({ change, label, empty }: { change: number | undefined; label: string; empty: string }) {
  if (change == null) return <span>{empty}</span>;
  const up = change >= 0;
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("inline-flex items-center gap-0.5 font-medium", up ? "text-brand-600" : "text-accent-700")}>
        {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
        {up ? "+" : ""}
        {change}%
      </span>
      {label}
    </span>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-sm", className)} />
      {label}
    </span>
  );
}

function RevenueChart({
  series,
  period,
  locale,
  format,
  empty,
}: {
  series: Bucket[];
  period: Period;
  locale: string;
  format: (n: number) => string;
  empty: string;
}) {
  const max = Math.max(...series.map((b) => b.paid + b.pending));
  if (!max) return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;

  const label = (b: Bucket) =>
    period === "week"
      ? formatDate(b.start, locale, { weekday: "short" })
      : period === "month"
        ? formatDate(b.start, locale, { day: "numeric", month: "short" })
        : formatDate(b.start, locale, { month: "short" });
  const title = (b: Bucket) =>
    `${b.start === b.end ? formatDate(b.start, locale) : `${formatDate(b.start, locale, { day: "numeric", month: "short" })} – ${formatDate(b.end, locale, { day: "numeric", month: "short" })}`}: ${format(b.paid + b.pending)}`;

  return (
    <div className="flex h-48 items-stretch gap-1.5 sm:gap-3" role="img" aria-label={series.map(title).join("; ")}>
      {series.map((b) => {
        const total = b.paid + b.pending;
        return (
          <div key={b.start} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" title={title(b)}>
            <span className="h-4 truncate text-[10px] tabular-nums text-muted-foreground">{total ? format(total) : ""}</span>
            <div className="flex w-full max-w-14 flex-1 flex-col justify-end overflow-hidden rounded-md bg-muted/50">
              <div className="bg-accent/60" style={{ height: `${(b.pending / max) * 100}%` }} />
              <div className="bg-brand" style={{ height: `${(b.paid / max) * 100}%` }} />
            </div>
            <span className="truncate text-[10px] text-muted-foreground first-letter:uppercase">{label(b)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Breakdown({
  groups,
  format,
  countLabel,
  empty,
}: {
  groups: Group[];
  format: (n: number) => string;
  countLabel: (n: number) => string;
  empty: string;
}) {
  if (!groups.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...groups.map((g) => g.total)) || 1;
  return (
    <ul className="space-y-3">
      {groups.map((g) => (
        <li key={g.name} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{g.name}</span>
            <span className="shrink-0 tabular-nums">{format(g.total)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand" style={{ width: `${(g.total / max) * 100}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground">{countLabel(g.count)}</p>
        </li>
      ))}
    </ul>
  );
}
