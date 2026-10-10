// ---------------------------------------------------------------------------
// Billing analytics — pure functions over the billing ledger and appointments.
// All dates are date-only strings ("YYYY-MM-DD") in the clinic's calendar, so
// nothing here depends on the server's time zone.
// ---------------------------------------------------------------------------

import type { Appointment, BillingEntry } from "@/lib/types";
import { dateInZone } from "@/lib/utils";

export const PERIODS = ["week", "month", "quarter", "year"] as const;
export type Period = (typeof PERIODS)[number];

/** Inclusive date range. */
export interface DateRange {
  start: string;
  end: string;
}

type Entry = Pick<BillingEntry, "amount" | "date" | "status" | "clientName" | "typeName">;

const DAY = 86_400_000;
const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);
const format = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => format(new Date(Date.UTC(y, m, d)));

export function addDays(iso: string, days: number): string {
  return format(new Date(parse(iso).getTime() + days * DAY));
}

/**
 * The week / month / quarter / year containing `today`, shifted by `offset`
 * periods (-1 = the previous one). Weeks run Monday to Sunday.
 */
export function periodRange(period: Period, today: string, offset = 0): DateRange {
  const d = parse(today);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (period === "week") {
    const monday = addDays(today, -((d.getUTCDay() + 6) % 7) + offset * 7);
    return { start: monday, end: addDays(monday, 6) };
  }
  if (period === "month") return { start: utc(y, m + offset, 1), end: utc(y, m + offset + 1, 0) };
  if (period === "quarter") {
    const first = Math.floor(m / 3) * 3 + offset * 3;
    return { start: utc(y, first, 1), end: utc(y, first + 3, 0) };
  }
  return { start: utc(y + offset, 0, 1), end: utc(y + offset, 12, 0) };
}

export const inRange = (date: string, range: DateRange) => date.slice(0, 10) >= range.start && date.slice(0, 10) <= range.end;

export interface Summary {
  /** Everything billed in the range (paid + pending). */
  billed: number;
  paid: number;
  pending: number;
  count: number;
  /** Average amount per entry; undefined when there are none. */
  average?: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function summarize(entries: Entry[], range?: DateRange): Summary {
  const list = range ? entries.filter((e) => inRange(e.date, range)) : entries;
  const sum = (status?: Entry["status"]) => round2(list.reduce((s, e) => (status && e.status !== status ? s : s + e.amount), 0));
  const billed = sum();
  return { billed, paid: sum("paid"), pending: sum("pending"), count: list.length, average: list.length ? round2(billed / list.length) : undefined };
}

/** Relative change in percent (rounded); undefined when there is no baseline. */
export function percentChange(current: number, previous: number): number | undefined {
  if (!previous) return undefined;
  return Math.round(((current - previous) / previous) * 100);
}

export interface Bucket extends DateRange {
  paid: number;
  pending: number;
}

/**
 * Revenue per bucket for the chart. A week is shown day by day, a month week
 * by week, and a quarter or year month by month — always clipped to `range`.
 */
export function revenueSeries(entries: Entry[], period: Period, range: DateRange): Bucket[] {
  const buckets: DateRange[] = [];
  if (period === "week") {
    for (let d = range.start; d <= range.end; d = addDays(d, 1)) buckets.push({ start: d, end: d });
  } else if (period === "month") {
    for (let w = periodRange("week", range.start); w.start <= range.end; w = periodRange("week", addDays(w.start, 7))) {
      buckets.push({ start: w.start < range.start ? range.start : w.start, end: w.end > range.end ? range.end : w.end });
    }
  } else {
    for (let m = periodRange("month", range.start); m.start <= range.end; m = periodRange("month", addDays(m.end, 1))) buckets.push(m);
  }
  return buckets.map((b) => {
    const s = summarize(entries, b);
    return { ...b, paid: s.paid, pending: s.pending };
  });
}

export interface Group {
  name: string;
  count: number;
  total: number;
}

function groupBy(entries: Entry[], key: (e: Entry) => string): Group[] {
  const groups = new Map<string, Group>();
  for (const e of entries) {
    const name = key(e).trim() || "—";
    const g = groups.get(name) ?? { name, count: 0, total: 0 };
    g.count += 1;
    g.total = round2(g.total + e.amount);
    groups.set(name, g);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

/** Revenue per consultation type, highest first. */
export const byType = (entries: Entry[], range: DateRange) => groupBy(entries.filter((e) => inRange(e.date, range)), (e) => e.typeName);

/** The clients who brought in the most revenue in the range. */
export const topClients = (entries: Entry[], range: DateRange, limit = 5) =>
  groupBy(entries.filter((e) => inRange(e.date, range)), (e) => e.clientName).slice(0, limit);

export interface Outstanding<T> {
  entry: T;
  /** Days since the entry's date. */
  days: number;
}

/** Every unpaid entry up to today, oldest first — regardless of the period. */
export function outstanding<T extends Entry>(entries: T[], today: string): { total: number; items: Outstanding<T>[] } {
  const items = entries
    .filter((e) => e.status === "pending" && e.date.slice(0, 10) <= today)
    .map((entry) => ({ entry, days: Math.round((parse(today).getTime() - parse(entry.date.slice(0, 10)).getTime()) / DAY) }))
    .sort((a, b) => b.days - a.days);
  return { total: round2(items.reduce((s, i) => s + i.entry.amount, 0)), items };
}

export interface Attendance {
  /** Appointments in the range that are already in the past (or were cancelled). */
  total: number;
  cancelled: number;
  /** Cancelled / total, in percent; undefined when there were none. */
  cancellationRate?: number;
}

/** How many of the period's appointments were cancelled. */
export function attendance(appointments: Pick<Appointment, "date" | "status">[], range: DateRange, now = new Date()): Attendance {
  const relevant = appointments.filter(
    (a) => inRange(dateInZone(a.date), range) && (a.status === "cancelled" || new Date(a.date).getTime() <= now.getTime()),
  );
  const cancelled = relevant.filter((a) => a.status === "cancelled").length;
  return { total: relevant.length, cancelled, cancellationRate: relevant.length ? Math.round((cancelled / relevant.length) * 100) : undefined };
}
