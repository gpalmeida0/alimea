import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Dates & time zones
//
// The clinic works in a single local time zone (Portugal by default). Servers
// (e.g. Vercel) run in UTC, so every *datetime* that is shown to a human or put
// in an SMS is formatted explicitly in APP_TIME_ZONE. *Date-only* values
// ("2026-05-14") carry no time zone and are formatted as-is (in UTC) so they
// never shift by a day.
// ---------------------------------------------------------------------------

export const APP_TIME_ZONE = process.env.NEXT_PUBLIC_APP_TIME_ZONE || "Europe/Lisbon";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(s: string): boolean {
  return DATE_ONLY.test(s);
}

function safeLocale(locale: string): string {
  try {
    new Intl.DateTimeFormat(locale);
    return locale;
  } catch {
    return "pt-PT";
  }
}

export function formatDate(
  iso: string | undefined,
  locale: string,
  opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "2-digit" },
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const timeZone = isDateOnly(iso) ? "UTC" : (opts.timeZone ?? APP_TIME_ZONE);
  return new Intl.DateTimeFormat(safeLocale(locale), { ...opts, timeZone }).format(d);
}

/** Calendar date ("YYYY-MM-DD") of an instant, in the clinic's time zone. */
export function dateInZone(d: Date | string = new Date(), timeZone = APP_TIME_ZONE): string {
  const date = typeof d === "string" ? new Date(d) : d;
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Today's date ("YYYY-MM-DD") in the clinic's time zone. */
export function todayISO(): string {
  return dateInZone(new Date());
}

/** Whole days between two "YYYY-MM-DD" dates (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** First day of the current month ("YYYY-MM-01") in the clinic's time zone. */
export function monthStartISO(): string {
  return `${todayISO().slice(0, 7)}-01`;
}

/** True when an ISO date/datetime falls on or after `fromDate` (YYYY-MM-DD, clinic TZ). */
export function onOrAfter(iso: string, fromDate: string): boolean {
  const day = isDateOnly(iso) ? iso : dateInZone(iso);
  return day >= fromDate;
}

/** ISO instant → value for <input type="datetime-local"> in the browser's zone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ageFromBirth(birth?: string, on: string = todayISO()): number | undefined {
  if (!birth || !isDateOnly(birth.slice(0, 10))) return undefined;
  const [by, bm, bd] = birth.slice(0, 10).split("-").map(Number);
  const [y, m, d] = on.split("-").map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age >= 0 ? age : undefined;
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/**
 * Normalise a phone number to E.164 (required by Twilio).
 * Assumes Portugal (+351) when no country code is present.
 * "911 920 299" → "+351911920299"; "+44 20 …" is kept as-is.
 */
export function toE164(phone: string | undefined, defaultCc = "351"): string | undefined {
  if (!phone) return undefined;
  let p = phone.trim().replace(/[\s\-().]/g, "");
  if (p.startsWith("+")) p = "+" + p.slice(1).replace(/\D/g, "");
  else if (p.startsWith("00")) p = "+" + p.slice(2).replace(/\D/g, "");
  else {
    p = p.replace(/\D/g, "");
    if (!p) return undefined;
    p = p.startsWith(defaultCc) && p.length > 9 ? `+${p}` : `+${defaultCc}${p}`;
  }
  // E.164: max 15 digits, and a plausible minimum.
  return /^\+\d{8,15}$/.test(p) ? p : undefined;
}

export function newId(prefix = "id"): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Locale-aware number formatting with up to `digits` decimals. */
export function formatNumber(n: number | undefined, locale: string, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(safeLocale(locale), { maximumFractionDigits: digits }).format(n);
}

/** Case/accent-insensitive normalisation for search. */
export function normalizeSearch(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
