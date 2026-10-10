import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { getSmsProvider, isSmsConfigured } from "@/lib/messaging/sms";
import { buildReminderMessage, sendDueReminders, sendReminderNow } from "@/lib/messaging/reminders";
import type { ReminderStore } from "@/lib/data/repo-types";
import type { Appointment, Client, SentMessage } from "@/lib/types";
import {
  cn,
  daysBetween,
  formatDate,
  formatNumber,
  initials,
  isDateOnly,
  monthStartISO,
  newId,
  normalizeSearch,
  onOrAfter,
  toE164,
  todayISO,
  toLocalInput,
} from "@/lib/utils";

const TWILIO = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM"] as const;
const realFetch = globalThis.fetch;
const realEnv = { ...process.env };

function useTwilio(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  process.env.TWILIO_ACCOUNT_SID = "AC_test";
  process.env.TWILIO_AUTH_TOKEN = "token";
  process.env.TWILIO_FROM = "+15005550006";
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return respond(url, init);
  }) as typeof fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const k of [...TWILIO, "NODE_ENV"]) {
    if (realEnv[k] === undefined) delete (process.env as Record<string, string | undefined>)[k];
    else (process.env as Record<string, string | undefined>)[k] = realEnv[k];
  }
});

test("SMS: preview provider without Twilio credentials (quiet in production)", async () => {
  for (const k of TWILIO) delete process.env[k];
  assert.equal(isSmsConfigured(), false);
  const provider = getSmsProvider();
  assert.equal(provider.name, "preview");
  (process.env as Record<string, string>).NODE_ENV = "production";
  assert.deepEqual(await provider.send("+351911111111", "olá"), { status: "simulated", provider: "preview" });
});

test("SMS: Twilio request, API error, non-JSON error and network failure", async () => {
  const calls = useTwilio(() => new Response("{}", { status: 201 }));
  assert.equal(isSmsConfigured(), true);
  assert.deepEqual(await getSmsProvider().send("+351911111111", "olá"), { status: "sent", provider: "twilio" });
  assert.match(calls[0].url, /Accounts\/AC_test\/Messages\.json$/);
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers.Authorization, `Basic ${Buffer.from("AC_test:token").toString("base64")}`);
  const body = calls[0].init.body as URLSearchParams;
  assert.deepEqual([body.get("To"), body.get("From"), body.get("Body")], ["+351911111111", "+15005550006", "olá"]);

  useTwilio(() => new Response(JSON.stringify({ message: "Invalid number" }), { status: 400 }));
  assert.deepEqual(await getSmsProvider().send("x", "y"), { status: "failed", provider: "twilio", error: "Invalid number" });

  useTwilio(() => new Response(JSON.stringify({ code: 1 }), { status: 400 }));
  assert.equal((await getSmsProvider().send("x", "y")).error, '{"code":1}');

  useTwilio(() => new Response("<html>Bad gateway</html>", { status: 502 }));
  assert.equal((await getSmsProvider().send("x", "y")).error, "<html>Bad gateway</html>");

  useTwilio(() => {
    throw new Error("offline");
  });
  const failed = await getSmsProvider().send("x", "y");
  assert.equal(failed.status, "failed");
  assert.match(failed.error!, /offline/);
});

// --- Reminder delivery -------------------------------------------------------
const NOW = new Date("2026-03-10T10:00:00Z");
const appt = (over: Partial<Appointment>): Appointment =>
  ({ id: "a1", clientId: "c1", date: "2026-03-11T11:00:00Z", status: "scheduled", reminderEnabled: true, ...over }) as Appointment;
const client = (over: Partial<Client>): Client =>
  ({ id: "c1", nutritionistId: "n1", name: "Ana Silva", phone: "911 111 111", createdAt: "2026-01-01", ...over }) as Client;

function memoryStore(appointments: Appointment[], clients: Client[], language?: "pt-PT" | "en") {
  const sent: Omit<SentMessage, "id">[] = [];
  const marked: string[] = [];
  const store: ReminderStore = {
    listAppointments: async () => appointments,
    getClient: async (id) => clients.find((c) => c.id === id),
    getProfile: async () => (language ? ({ id: "n1", name: "Eduarda", interfaceLanguage: language } as never) : undefined),
    markReminderSent: async (id) => void marked.push(id),
    addSentMessage: async (m) => void sent.push(m),
  };
  return { store, sent, marked };
}

test("reminders: failed sends are logged but not marked; missing client and phone are reported", async () => {
  useTwilio(() => new Response(JSON.stringify({ message: "Unreachable" }), { status: 400 }));
  const { store, sent, marked } = memoryStore(
    [appt({}), appt({ id: "a2", clientId: "gone" }), appt({ id: "a3", clientId: "c3" })],
    [client({}), client({ id: "c3", phone: undefined })],
    "en",
  );
  const { processed, results } = await sendDueReminders(store, NOW);
  assert.equal(processed, 3);
  assert.deepEqual(results.map((r) => r.status), ["failed", "failed", "skipped_no_phone"]);
  assert.equal(results[0].error, "Unreachable");
  assert.equal(results[1].error, "client not found");
  assert.deepEqual(marked, []);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].status, "failed");
  assert.match(sent[0].body, /Ana/);
});

test("reminders: send-now works for any appointment, falls back to pt-PT without a profile", async () => {
  for (const k of TWILIO) delete process.env[k];
  (process.env as Record<string, string>).NODE_ENV = "production";
  const { store, marked } = memoryStore([appt({ date: "2026-03-20T15:00:00Z" })], [client({})]);
  const outcome = await sendReminderNow(store, "a1", NOW);
  assert.equal(outcome?.status, "simulated");
  assert.equal(outcome?.to, "+351911111111");
  assert.deepEqual(marked, ["a1"]);
  assert.equal(await sendReminderNow(store, "nope", NOW), undefined);
});

test("reminder text names the weekday when the appointment is not tomorrow", () => {
  const far = appt({ date: "2026-03-20T15:00:00Z" });
  const en = buildReminderMessage({ name: "Eduarda" }, client({}), far, "en", NOW);
  assert.match(en, /on Friday/);
  const pt = buildReminderMessage({ name: "Eduarda" }, client({}), far, "pt-PT", NOW);
  assert.match(pt, /sexta-feira/);
  assert.doesNotMatch(pt, /amanhã/);
});

// --- Utilities ---------------------------------------------------------------
test("utils: dates", () => {
  assert.equal(isDateOnly("2026-05-14"), true);
  assert.equal(isDateOnly("2026-05-14T10:00:00Z"), false);
  assert.equal(formatDate(undefined, "en"), "—");
  assert.equal(formatDate("not a date", "en"), "not a date");
  assert.equal(formatDate("2026-05-14", "en-GB"), "14 May 2026");
  assert.equal(formatDate("2026-05-14", "not_a_locale"), formatDate("2026-05-14", "pt-PT"));
  // 23:30 UTC is already the next day in Tokyo, and still the 14th in Lisbon.
  assert.equal(formatDate("2026-05-14T23:30:00Z", "en-GB", { day: "2-digit", timeZone: "Asia/Tokyo" }), "15");
  assert.equal(formatDate("2026-05-14T22:30:00Z", "en-GB", { day: "2-digit" }), "14");
  assert.equal(daysBetween("2026-02-27", "2026-03-01"), 2);
  assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(monthStartISO(), `${todayISO().slice(0, 7)}-01`);
  assert.equal(onOrAfter("2026-05-14", "2026-05-14"), true);
  assert.equal(onOrAfter("2026-05-13T23:30:00Z", "2026-05-14"), true); // 00:30 in Lisbon (WEST)
  assert.equal(onOrAfter("2026-05-13T10:00:00Z", "2026-05-14"), false);
  const local = new Date(2026, 0, 5, 9, 7);
  assert.equal(toLocalInput(local.toISOString()), "2026-01-05T09:07");
});

test("utils: phone numbers, ids, numbers, search and initials", () => {
  assert.equal(toE164("0044 20 7946 0958"), "+442079460958");
  assert.equal(toE164("+44 (20) 7946-0958"), "+442079460958");
  assert.equal(toE164("351911111111"), "+351911111111");
  assert.equal(toE164("abc"), undefined);
  assert.equal(toE164("12"), undefined);
  assert.equal(toE164(undefined), undefined);

  assert.match(newId(), /^[0-9a-f-]{36}$/);
  assert.notEqual(newId("x"), newId("x"));

  assert.equal(formatNumber(undefined, "en"), "—");
  assert.equal(formatNumber(Number.NaN, "en"), "—");
  assert.equal(formatNumber(1234.56, "en", 1), "1,234.6");
  assert.equal(formatNumber(2.5, "pt-PT"), "2,5");

  assert.equal(normalizeSearch("Pão de Açúcar"), "pao de acucar");
  assert.equal(initials("  ana maria  silva "), "AS");
  assert.equal(initials("Ana"), "A");
  assert.equal(initials("   "), "?");
  assert.equal(cn("px-2", false && "hidden", "px-4"), "px-4");
});
