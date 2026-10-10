import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReminderMessage, isReminderDue, sendDueReminders } from "@/lib/messaging/reminders";
import { ageFromBirth, dateInZone, daysBetween, formatDate, toE164 } from "@/lib/utils";
import type { ReminderStore } from "@/lib/data/repo-types";
import type { Appointment } from "@/lib/types";

const appt = (date: string, extra: Partial<Appointment> = {}): Appointment => ({
  id: "a1",
  clientId: "c1",
  date,
  status: "scheduled",
  reminderEnabled: true,
  reminderChannel: "sms",
  ...extra,
});

test("reminder is due from the day before (Lisbon time) until it starts", () => {
  const now = new Date("2026-06-14T09:00:00Z"); // daily cron, 10:00 in Lisbon (WEST)
  assert.equal(isReminderDue(appt("2026-06-15T17:00:00Z"), now), true, "tomorrow afternoon — previously missed by the 24h rule");
  assert.equal(isReminderDue(appt("2026-06-14T15:00:00Z"), now), true, "later today");
  assert.equal(isReminderDue(appt("2026-06-16T08:00:00Z"), now), false, "in two days");
  assert.equal(isReminderDue(appt("2026-06-14T08:00:00Z"), now), false, "already started");
  assert.equal(isReminderDue(appt("2026-06-15T10:00:00Z", { reminderSentAt: "x" }), now), false);
  assert.equal(isReminderDue(appt("2026-06-15T10:00:00Z", { status: "cancelled" }), now), false);
  assert.equal(isReminderDue(appt("2026-06-15T10:00:00Z", { reminderEnabled: false }), now), false);
});

test("reminder text uses Lisbon time and says 'amanhã' only for tomorrow", () => {
  const now = new Date("2026-06-14T09:00:00Z");
  const tomorrow = buildReminderMessage({ name: "Eduarda" }, { name: "Gonçalo Almeida" }, { date: "2026-06-15T13:00:00Z" }, "pt-PT", now);
  assert.match(tomorrow, /^Olá Gonçalo!/);
  assert.match(tomorrow, /amanhã, às 14:00/, "13:00Z is 14:00 in Lisbon summer time");
  const later = buildReminderMessage({ name: "Eduarda" }, { name: "Ana" }, { date: "2026-06-20T13:00:00Z" }, "pt-PT", now);
  assert.doesNotMatch(later, /amanhã/);
  assert.match(later, /sábado, 20 de junho/);
  const en = buildReminderMessage({ name: "Eduarda" }, { name: "Ana" }, { date: "2026-06-14T16:00:00Z" }, "en", now);
  assert.match(en, /today at 17:00/);
});

test("sendDueReminders only touches what the injected store exposes", async () => {
  const sent: string[] = [];
  const marked: string[] = [];
  const store: ReminderStore = {
    listAppointments: async () => [appt("2026-06-15T10:00:00Z"), appt("2026-06-15T11:00:00Z", { id: "a2", clientId: "nophone" })],
    getClient: async (id) =>
      ({ id, nutritionistId: "n", name: id === "nophone" ? "Sem Telefone" : "Ana", phone: id === "nophone" ? undefined : "912345678", createdAt: "" }),
    getProfile: async () => ({ id: "n", name: "Eduarda", email: "", credential: "", interfaceLanguage: "pt-PT" }),
    markReminderSent: async (id) => void marked.push(id),
    addSentMessage: async (m) => void sent.push(m.to),
  };
  const res = await sendDueReminders(store, new Date("2026-06-14T09:00:00Z"));
  assert.equal(res.processed, 2);
  assert.deepEqual(res.results.map((r) => r.status).sort(), ["simulated", "skipped_no_phone"]);
  assert.deepEqual(sent, ["+351912345678"]);
  assert.deepEqual(marked, ["a1"]);
});

test("phone numbers → E.164", () => {
  assert.equal(toE164("911 920 299"), "+351911920299");
  assert.equal(toE164("+44 20 7946 0958"), "+442079460958");
  assert.equal(toE164("00351 911920299"), "+351911920299");
  assert.equal(toE164("351911920299"), "+351911920299");
  assert.equal(toE164("abc"), undefined);
  assert.equal(toE164("12"), undefined);
});

test("dates: date-only values never shift a day; ages are exact", () => {
  assert.equal(formatDate("2026-03-01", "pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" }), "01/03/2026");
  assert.equal(dateInZone(new Date("2026-06-14T23:30:00Z")), "2026-06-15", "00:30 in Lisbon is the next day");
  assert.equal(daysBetween("2026-02-27", "2026-03-01"), 2);
  assert.equal(ageFromBirth("1992-03-14", "2026-03-13"), 33);
  assert.equal(ageFromBirth("1992-03-14", "2026-03-14"), 34);
  assert.equal(ageFromBirth(undefined), undefined);
});
