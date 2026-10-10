import { getTranslations, setRequestLocale } from "next-intl/server";
import { listAppointments, listClients, listSentMessages } from "@/lib/data/repo";
import { isReminderDue } from "@/lib/messaging/reminders";
import { isSmsConfigured } from "@/lib/messaging/sms";
import { PageHeader } from "@/components/ui/misc";
import { AppointmentsView, type ApptVM, type MsgVM } from "@/components/calendar/appointments-view";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "appointments" });
  return { title: t("title") };
}

export default async function AppointmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ client?: string }>;
}) {
  const { locale } = await params;
  const { client: preselect } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("appointments");

  const now = new Date();
  const [appts, clients, messages] = await Promise.all([listAppointments(), listClients(), listSentMessages()]);
  const byId = new Map(clients.map((c) => [c.id, c]));

  const apptVMs: ApptVM[] = appts.map((a) => ({
    id: a.id,
    clientId: a.clientId,
    clientName: byId.get(a.clientId)?.name ?? "—",
    clientPhone: byId.get(a.clientId)?.phone,
    date: a.date,
    durationMin: a.durationMin ?? 45,
    note: a.note,
    status: a.status,
    reminderEnabled: a.reminderEnabled,
    reminderSentAt: a.reminderSentAt,
    due: isReminderDue(a, now),
  }));

  const msgVMs: MsgVM[] = messages.slice(0, 20).map((m) => ({
    id: m.id,
    clientName: byId.get(m.clientId)?.name ?? "—",
    to: m.to,
    body: m.body,
    status: m.status,
    createdAt: m.createdAt,
  }));

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <AppointmentsView
        appointments={apptVMs}
        clients={clients.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))}
        messages={msgVMs}
        smsConfigured={isSmsConfigured()}
        nowISO={now.toISOString()}
        preselectClientId={preselect && byId.has(preselect) ? preselect : undefined}
      />
    </div>
  );
}
