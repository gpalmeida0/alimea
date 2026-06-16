import {
  addSentMessage,
  getClient,
  getProfileById,
  listAllAppointments,
  markReminderSent,
  newMessageId,
} from "@/lib/data/repo";
import type { Appointment, Client, NutritionistProfile, PlanLanguage } from "@/lib/types";
import { toE164 } from "@/lib/utils";
import { getSmsProvider } from "./sms";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Builds the localized 1-day-before reminder text. */
export function buildReminderMessage(
  profile: NutritionistProfile,
  client: Client,
  appt: Appointment,
  lang: PlanLanguage,
): string {
  const first = client.name.split(" ")[0];
  const dt = new Date(appt.date);
  const time = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
  const date = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(dt);

  if (lang === "en") {
    return `Hi ${first}! Reminder of your appointment with ${profile.name} tomorrow, ${date}, at ${time}. Reply to reschedule. See you soon!`;
  }
  return `Olá ${first}! Lembrete da sua consulta com ${profile.name} amanhã, ${date}, às ${time}. Caso precise de remarcar, responda a esta mensagem. Até já!`;
}

/** A reminder is due once we are within 24h of the appointment and it hasn't been sent. */
export function isReminderDue(appt: Appointment, now: Date): boolean {
  if (!appt.reminderEnabled || appt.status !== "scheduled" || appt.reminderSentAt) {
    return false;
  }
  const apptTime = new Date(appt.date).getTime();
  const n = now.getTime();
  return n >= apptTime - DAY_MS && n < apptTime;
}

export interface ReminderOutcome {
  appointmentId: string;
  clientName: string;
  to?: string;
  status: "sent" | "simulated" | "failed" | "skipped_no_phone";
  body?: string;
  error?: string;
}

async function deliver(appt: Appointment, now: Date): Promise<ReminderOutcome> {
  const client = await getClient(appt.clientId);
  if (!client) {
    return { appointmentId: appt.id, clientName: "—", status: "failed", error: "client not found" };
  }
  const profile = (await getProfileById(client.nutritionistId)) ?? {
    id: client.nutritionistId,
    name: "",
    email: "",
    credential: "",
    interfaceLanguage: "pt-PT" as const,
  };
  const to = toE164(client.phone);
  if (!to) {
    return {
      appointmentId: appt.id,
      clientName: client.name,
      status: "skipped_no_phone",
    };
  }

  const lang = profile.interfaceLanguage;
  const body = buildReminderMessage(profile, client, appt, lang);
  const provider = getSmsProvider();
  const result = await provider.send(to, body);

  if (result.status !== "failed") {
    await markReminderSent(appt.id, now.toISOString());
  }
  await addSentMessage({
    id: newMessageId(),
    appointmentId: appt.id,
    clientId: client.id,
    to,
    channel: "sms",
    body,
    status: result.status,
    provider: result.provider,
    createdAt: now.toISOString(),
  });

  return {
    appointmentId: appt.id,
    clientName: client.name,
    to,
    status: result.status,
    body,
    error: result.error,
  };
}

/** Process every appointment whose 24h reminder window is open. Idempotent. */
export async function sendDueReminders(now = new Date()): Promise<{
  processed: number;
  results: ReminderOutcome[];
}> {
  const appts = await listAllAppointments();
  const due = appts.filter((a) => isReminderDue(a, now));
  const results: ReminderOutcome[] = [];
  for (const appt of due) {
    results.push(await deliver(appt, now));
  }
  return { processed: results.length, results };
}

/** Manually (re)send a single appointment's reminder, ignoring the 24h window. */
export async function sendReminderNow(
  appointmentId: string,
  now = new Date(),
): Promise<ReminderOutcome | undefined> {
  const appt = (await listAllAppointments()).find((a) => a.id === appointmentId);
  if (!appt) return undefined;
  return deliver(appt, now);
}
