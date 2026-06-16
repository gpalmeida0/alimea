"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { formatDate } from "@/lib/utils";

export interface ProgressPoint {
  date: string;
  weight?: number;
  bmi?: number;
  bodyFat?: number;
  muscle?: number;
  waist?: number;
  arm?: number;
  hip?: number;
  thigh?: number;
  calf?: number;
}

type MetricKey = keyof Omit<ProgressPoint, "date">;

const METRICS: { key: MetricKey; labelKey: string; unit: string; goodDown: boolean }[] = [
  { key: "weight", labelKey: "weight", unit: "kg", goodDown: true },
  { key: "bmi", labelKey: "bmi", unit: "", goodDown: true },
  { key: "bodyFat", labelKey: "bodyFat", unit: "%", goodDown: true },
  { key: "muscle", labelKey: "muscleMass", unit: "kg", goodDown: false },
  { key: "waist", labelKey: "waist", unit: "cm", goodDown: true },
  { key: "arm", labelKey: "arm", unit: "cm", goodDown: false },
  { key: "hip", labelKey: "hip", unit: "cm", goodDown: true },
  { key: "thigh", labelKey: "thigh", unit: "cm", goodDown: true },
  { key: "calf", labelKey: "calf", unit: "cm", goodDown: false },
];

export function ProgressDashboard({ points, locale }: { points: ProgressPoint[]; locale: string }) {
  const t = useTranslations("consultation");

  const active = useMemo(
    () =>
      METRICS.map((m) => ({
        ...m,
        series: points
          .map((p) => ({ date: p.date, value: p[m.key] }))
          .filter((p): p is { date: string; value: number } => typeof p.value === "number"),
      })).filter((m) => m.series.length >= 1),
    [points],
  );

  if (active.every((m) => m.series.length < 2)) {
    return null;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {active.map((m) => (
        <MetricCard
          key={m.key}
          label={t(m.labelKey)}
          unit={m.unit}
          goodDown={m.goodDown}
          series={m.series}
          locale={locale}
        />
      ))}
    </div>
  );
}

function MetricCard({
  label,
  unit,
  goodDown,
  series,
  locale,
}: {
  label: string;
  unit: string;
  goodDown: boolean;
  series: { date: string; value: number }[];
  locale: string;
}) {
  const first = series[0].value;
  const last = series[series.length - 1].value;
  const delta = Math.round((last - first) * 10) / 10;
  const improved = goodDown ? delta < 0 : delta > 0;
  const flat = delta === 0 || series.length < 2;

  return (
    <div className="card-surface p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-0.5 font-serif text-2xl font-semibold">
            {last}
            <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
          </p>
        </div>
        <span
          className={`flex items-center gap-1 text-xs font-medium ${
            flat ? "text-muted-foreground" : improved ? "text-brand-600" : "text-accent"
          }`}
        >
          {flat ? <Minus className="size-3" /> : delta < 0 ? <TrendingDown className="size-3" /> : <TrendingUp className="size-3" />}
          {delta > 0 ? "+" : ""}
          {delta}
          {unit}
        </span>
      </div>
      <Sparkline series={series} positive={improved} locale={locale} />
    </div>
  );
}

function Sparkline({
  series,
  positive,
  locale,
}: {
  series: { date: string; value: number }[];
  positive: boolean;
  locale: string;
}) {
  if (series.length < 2) {
    return <p className="mt-3 text-xs text-muted-foreground">{formatDate(series[0].date, locale)}</p>;
  }
  const W = 240;
  const H = 56;
  const pad = 6;
  const values = series.map((s) => s.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (series.length - 1)) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (H - pad * 2);
  const line = series.map((s, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(s.value)}`).join(" ");
  const stroke = positive ? "#2E7D32" : "#FF8F00";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" preserveAspectRatio="none">
      <path d={`${line} L ${x(series.length - 1)} ${H} L ${x(0)} ${H} Z`} fill={stroke} opacity="0.08" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {series.map((s, i) => (
        <circle key={i} cx={x(i)} cy={y(s.value)} r="2.5" fill={stroke} />
      ))}
    </svg>
  );
}
