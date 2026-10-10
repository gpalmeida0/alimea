import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  attendance,
  byType,
  inRange,
  outstanding,
  percentChange,
  periodRange,
  revenueSeries,
  summarize,
  topClients,
} from "@/lib/billing/metrics";

const entry = (date: string, amount: number, status: "paid" | "pending" = "paid", clientName = "Ana", typeName = "Presencial") => ({
  id: `${date}-${amount}-${clientName}`,
  date,
  amount,
  status,
  clientName,
  typeName,
});

// Wednesday 14 October 2026.
const TODAY = "2026-10-14";

test("periodRange: weeks run Monday–Sunday; months, quarters and years are calendar periods", () => {
  assert.deepEqual(periodRange("week", TODAY), { start: "2026-10-12", end: "2026-10-18" });
  assert.deepEqual(periodRange("week", "2026-10-18"), { start: "2026-10-12", end: "2026-10-18" }); // Sunday
  assert.deepEqual(periodRange("week", "2026-10-12"), { start: "2026-10-12", end: "2026-10-18" }); // Monday
  assert.deepEqual(periodRange("week", TODAY, -1), { start: "2026-10-05", end: "2026-10-11" });
  assert.deepEqual(periodRange("month", TODAY), { start: "2026-10-01", end: "2026-10-31" });
  assert.deepEqual(periodRange("month", "2026-01-15", -1), { start: "2025-12-01", end: "2025-12-31" });
  assert.deepEqual(periodRange("month", "2028-03-31", -1), { start: "2028-02-01", end: "2028-02-29" }); // leap year
  assert.deepEqual(periodRange("quarter", TODAY), { start: "2026-10-01", end: "2026-12-31" });
  assert.deepEqual(periodRange("quarter", "2026-02-10", -1), { start: "2025-10-01", end: "2025-12-31" });
  assert.deepEqual(periodRange("year", TODAY), { start: "2026-01-01", end: "2026-12-31" });
  assert.deepEqual(periodRange("year", TODAY, -1), { start: "2025-01-01", end: "2025-12-31" });
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("summarize: billed, paid, pending, count and average, with or without a range", () => {
  const entries = [entry("2026-10-01", 40), entry("2026-10-31", 35.5, "pending"), entry("2026-09-30", 50), entry("2026-11-01", 50)];
  assert.deepEqual(summarize(entries, periodRange("month", TODAY)), { billed: 75.5, paid: 40, pending: 35.5, count: 2, average: 37.75 });
  assert.equal(summarize(entries).billed, 175.5);
  assert.deepEqual(summarize([], periodRange("month", TODAY)), { billed: 0, paid: 0, pending: 0, count: 0, average: undefined });
  // Datetime values are compared by their date part.
  assert.equal(inRange("2026-10-31T23:59:00Z", periodRange("month", TODAY)), true);
  // Floating-point sums are rounded to cents.
  assert.equal(summarize([entry("2026-10-01", 0.1), entry("2026-10-02", 0.2)]).billed, 0.3);
});

test("percentChange: rounded, and undefined without a baseline", () => {
  assert.equal(percentChange(1240, 1000), 24);
  assert.equal(percentChange(500, 1000), -50);
  assert.equal(percentChange(0, 80), -100);
  assert.equal(percentChange(120, 0), undefined);
});

test("revenueSeries: a week by day, a month by week (clipped), a quarter or year by month", () => {
  const entries = [entry("2026-10-12", 40), entry("2026-10-14", 35, "pending"), entry("2026-10-14", 10), entry("2026-10-01", 50), entry("2026-12-31", 20)];

  const week = revenueSeries(entries, "week", periodRange("week", TODAY));
  assert.equal(week.length, 7);
  assert.deepEqual(week[0], { start: "2026-10-12", end: "2026-10-12", paid: 40, pending: 0 });
  assert.deepEqual(week[2], { start: "2026-10-14", end: "2026-10-14", paid: 10, pending: 35 });

  // October 2026 starts on a Thursday and ends on a Saturday.
  const month = revenueSeries(entries, "month", periodRange("month", TODAY));
  assert.deepEqual(month.map((b) => [b.start, b.end]), [
    ["2026-10-01", "2026-10-04"],
    ["2026-10-05", "2026-10-11"],
    ["2026-10-12", "2026-10-18"],
    ["2026-10-19", "2026-10-25"],
    ["2026-10-26", "2026-10-31"],
  ]);
  assert.deepEqual([month[0].paid, month[2].paid, month[2].pending], [50, 50, 35]);
  assert.equal(month.reduce((s, b) => s + b.paid + b.pending, 0), summarize(entries, periodRange("month", TODAY)).billed);

  const quarter = revenueSeries(entries, "quarter", periodRange("quarter", TODAY));
  assert.deepEqual(quarter.map((b) => b.start), ["2026-10-01", "2026-11-01", "2026-12-01"]);
  assert.equal(quarter[2].paid, 20);
  assert.equal(revenueSeries(entries, "year", periodRange("year", TODAY)).length, 12);
});

test("byType and topClients: grouped, highest revenue first, limited", () => {
  const range = periodRange("month", TODAY);
  const entries = [
    entry("2026-10-01", 40, "paid", "Ana", "Presencial"),
    entry("2026-10-02", 40, "pending", "Rui", "Presencial"),
    entry("2026-10-03", 50, "paid", "Ana", "Beat"),
    entry("2026-10-04", 35, "paid", " ", ""),
    entry("2026-09-04", 999, "paid", "Old", "Old"),
  ];
  assert.deepEqual(byType(entries, range), [
    { name: "Presencial", count: 2, total: 80 },
    { name: "Beat", count: 1, total: 50 },
    { name: "—", count: 1, total: 35 },
  ]);
  assert.deepEqual(topClients(entries, range, 2), [
    { name: "Ana", count: 2, total: 90 },
    { name: "Rui", count: 1, total: 40 },
  ]);
  // Equal totals fall back to alphabetical order.
  assert.deepEqual(topClients([entry("2026-10-01", 10, "paid", "Zé"), entry("2026-10-01", 10, "paid", "Bia")], range).map((g) => g.name), ["Bia", "Zé"]);
  assert.equal(topClients(entries, range).length, 3);
});

test("outstanding: unpaid entries up to today, oldest first, with their age", () => {
  const entries = [
    entry("2026-10-14", 40, "pending", "Today"),
    entry("2026-09-01", 35, "pending", "Old"),
    entry("2026-10-10T09:00:00Z", 50, "pending", "Recent"),
    entry("2026-10-20", 60, "pending", "Future"),
    entry("2026-08-01", 70, "paid", "Paid"),
  ];
  const owed = outstanding(entries, TODAY);
  assert.equal(owed.total, 125);
  assert.deepEqual(owed.items.map((i) => [i.entry.clientName, i.days]), [["Old", 43], ["Recent", 4], ["Today", 0]]);
  assert.deepEqual(outstanding([], TODAY), { total: 0, items: [] });
});

test("attendance: cancellation rate over past appointments in the period", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  const appointments = [
    { date: "2026-10-05T10:00:00Z", status: "completed" as const },
    { date: "2026-10-06T10:00:00Z", status: "scheduled" as const }, // past, never closed: still counts
    { date: "2026-10-07T10:00:00Z", status: "cancelled" as const },
    { date: "2026-10-20T10:00:00Z", status: "cancelled" as const }, // future but already cancelled
    { date: "2026-10-21T10:00:00Z", status: "scheduled" as const }, // future: not counted yet
    { date: "2026-09-21T10:00:00Z", status: "cancelled" as const }, // other month
  ];
  assert.deepEqual(attendance(appointments, periodRange("month", TODAY), now), { total: 4, cancelled: 2, cancellationRate: 50 });
  assert.deepEqual(attendance(appointments, periodRange("month", "2026-07-01"), now), { total: 0, cancelled: 0, cancellationRate: undefined });
  assert.equal(attendance([], periodRange("month", TODAY)).total, 0);
});
