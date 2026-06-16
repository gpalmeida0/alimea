import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  getClient,
  listAppointments,
  listClients,
  listSentMessages,
} from "@/lib/data/repo";
import { isReminderDue } from "@/lib/messaging/reminders";
import { isSmsConfigured } from "@/lib/messaging/sms";
import { PageHeader } from "@/components/ui/misc";
import { AppointmentsView, type ApptVM, type MsgVM } from "@/components/calendar/appointments-view";

export default async function AppointmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("appointments");

  const now = new Date();
  const [appts, clients, messages] = await Promise.all([
    listAppointments(),
    listClients(),
    listSentMessages(),
  ]);

  const apptVMs: ApptVM[] = await Promise.all(
    appts.map(async (a) => {
      const client = await getClient(a.clientId);
      return {
        id: a.id,
        clientId: a.clientId,
        clientName: client?.name ?? "—",
        clientPhone: client?.phone,
        date: a.date,
        durationMin: a.durationMin ?? 45,
        note: a.note,
        status: a.status,
        reminderEnabled: a.reminderEnabled,
        reminderSentAt: a.reminderSentAt,
        due: isReminderDue(a, now),
      };
    }),
  );

  const msgVMs: MsgVM[] = await Promise.all(
    messages.map(async (m) => {
      const client = await getClient(m.clientId);
      return {
        id: m.id,
        clientName: client?.name ?? "—",
        to: m.to,
        body: m.body,
        status: m.status,
        createdAt: m.createdAt,
      };
    }),
  );

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <AppointmentsView
        appointments={apptVMs}
        clients={clients.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))}
        messages={msgVMs}
        smsConfigured={isSmsConfigured()}
        nowISO={now.toISOString()}
        locale={locale}
      />
    </div>
  );
}
