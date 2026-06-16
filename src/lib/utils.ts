import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(
  iso: string | undefined,
  locale: string,
  opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "2-digit" },
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // `locale` originates from a route param — fall back if it is not a valid BCP-47 tag.
  try {
    return new Intl.DateTimeFormat(locale, opts).format(d);
  } catch {
    return new Intl.DateTimeFormat("pt-PT", opts).format(d);
  }
}

/**
 * Normalise a phone number to E.164 (required by Twilio).
 * Assumes Portugal (+351) when no country code is present.
 * "911 920 299" → "+351911920299"; "+44 20 …" is kept as-is.
 */
export function toE164(phone: string | undefined, defaultCc = "351"): string | undefined {
  if (!phone) return undefined;
  let p = phone.trim().replace(/[\s\-().]/g, "");
  if (p.startsWith("+")) return "+" + p.slice(1).replace(/\D/g, "");
  if (p.startsWith("00")) return "+" + p.slice(2).replace(/\D/g, "");
  p = p.replace(/\D/g, "");
  if (!p) return undefined;
  // already includes the PT country code without "+"
  if (p.startsWith(defaultCc) && p.length > 9) return "+" + p;
  return `+${defaultCc}${p}`;
}

export function ageFromBirth(birth?: string): number | undefined {
  if (!birth) return undefined;
  const b = new Date(birth);
  if (Number.isNaN(b.getTime())) return undefined;
  const diff = Date.now() - b.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}
