import type { ReminderStore } from "@/lib/data/repo-types";
import type { Appointment, Client, NutritionistProfile, PlanLanguage } from "@/lib/types";
import { APP_TIME_ZONE, dateInZone, daysBetween, toE164 } from "@/lib/utils";
import { getSmsProvider } from "./sms";

// ---------------------------------------------------------------------------
// SMS appointment reminders.
//
// The cron (/api/cron/reminders) runs once a day. A reminder is "due" from the
// day before the appointment (clinic time zone) until the appointment starts,
// so a single daily run reliably reminds every one of tomorrow's appointments.
// The data store is injected: the cron uses a cross-tenant store, interactive
// actions use the signed-in tenant's store.
// ---------------------------------------------------------------------------

const intlLocale = (lang: PlanLanguage) => (lang === "en" ? "en-GB" : "pt-PT");

/** "hoje" / "amanhã" / "quinta-feira, 12 de junho" relative to `now`, in the clinic zone. */
function relativeDay(appt: Date, now: Date, lang: PlanLanguage): string {
  const diff = daysBetween(dateInZone(now), dateInZone(appt));
  if (diff === 0) return lang === "en" ? "today" : "hoje";
  if (diff === 1) return lang === "en" ? "tomorrow" : "amanhã";
  const date = new Intl.DateTimeFormat(intlLocale(lang), {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: APP_TIME_ZONE,
  }).format(appt);
  return lang === "en" ? `on ${date}` : `${date}`;
}

/** Builds the localized reminder text. */
export function buildReminderMessage(
  profile: Pick<NutritionistProfile, "name">,
  client: Pick<Client, "name">,
  appt: Pick<Appointment, "date">,
  lang: PlanLanguage,
  now: Date = new Date(),
): string {
  const first = client.name.trim().split(/\s+/)[0] ?? "";
  const dt = new Date(appt.date);
  const time = new Intl.DateTimeFormat(intlLocale(lang), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(dt);
  const when = relativeDay(dt, now, lang);
  const withWhom = profile.name ? (lang === "en" ? ` with ${profile.name}` : ` com ${profile.name}`) : "";

  if (lang === "en") {
    return `Hi ${first}! Reminder of your appointment${withWhom} ${when} at ${time}. Reply to this message if you need to reschedule. See you soon!`;
  }
  return `Olá ${first}! Lembrete da sua consulta${withWhom} ${when}, às ${time}. Caso precise de remarcar, responda a esta mensagem. Até breve!`;
}

/** Due from the day before the appointment (clinic time zone) until it starts. */
export function isReminderDue(appt: Appointment, now: Date): boolean {
  if (!appt.reminderEnabled || appt.status !== "scheduled" || appt.reminderSentAt) return false;
  const start = new Date(appt.date);
  if (Number.isNaN(start.getTime()) || start.getTime() <= now.getTime()) return false;
  return daysBetween(dateInZone(now), dateInZone(start)) <= 1;
}

export interface ReminderOutcome {
  appointmentId: string;
  clientName: string;
  to?: string;
  status: "sent" | "simulated" | "failed" | "skipped_no_phone";
  body?: string;
  error?: string;
}

async function deliver(store: ReminderStore, appt: Appointment, now: Date): Promise<ReminderOutcome> {
  const client = await store.getClient(appt.clientId);
  if (!client) {
    return { appointmentId: appt.id, clientName: "—", status: "failed", error: "client not found" };
  }
  const to = toE164(client.phone);
  if (!to) return { appointmentId: appt.id, clientName: client.name, status: "skipped_no_phone" };

  const profile = await store.getProfile(client.nutritionistId);
  const lang = profile?.interfaceLanguage ?? "pt-PT";
  const body = buildReminderMessage(profile ?? { name: "" }, client, appt, lang, now);
  const result = await getSmsProvider().send(to, body);

  if (result.status !== "failed") await store.markReminderSent(appt.id, now.toISOString());
  await store.addSentMessage({
    appointmentId: appt.id,
    clientId: client.id,
    to,
    channel: "sms",
    body,
    status: result.status,
    provider: result.provider,
    createdAt: now.toISOString(),
  });

  return { appointmentId: appt.id, clientName: client.name, to, status: result.status, body, error: result.error };
}

/** Send every due reminder visible to `store`. Idempotent (sent ones are marked). */
export async function sendDueReminders(
  store: ReminderStore,
  now = new Date(),
): Promise<{ processed: number; results: ReminderOutcome[] }> {
  const due = (await store.listAppointments()).filter((a) => isReminderDue(a, now));
  const results: ReminderOutcome[] = [];
  for (const appt of due) {
    try {
      results.push(await deliver(store, appt, now));
    } catch (e) {
      results.push({ appointmentId: appt.id, clientName: "—", status: "failed", error: String(e) });
    }
  }
  return { processed: results.length, results };
}

/** Manually (re)send one appointment's reminder, ignoring the due window. */
export async function sendReminderNow(
  store: ReminderStore,
  appointmentId: string,
  now = new Date(),
): Promise<ReminderOutcome | undefined> {
  const appt = (await store.listAppointments()).find((a) => a.id === appointmentId);
  if (!appt || appt.status === "cancelled") return undefined;
  return deliver(store, appt, now);
}
