import { getTranslations, setRequestLocale } from "next-intl/server";
import { listAppointments, listBillingEntries, listClients, listConsultationTypes } from "@/lib/data/repo";
import { todayISO } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { BillingManager } from "@/components/billing-manager";
import { BillingInsights } from "@/components/billing-insights";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "billing" });
  return { title: t("title") };
}

export default async function BillingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("billing");
  const [entries, types, clients, appointments] = await Promise.all([
    listBillingEntries(),
    listConsultationTypes(),
    listClients(),
    listAppointments(),
  ]);
  return (
    <div className="space-y-8">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <BillingInsights entries={entries} appointments={appointments.map(({ date, status }) => ({ date, status }))} today={todayISO()} />
      <BillingManager
        entries={entries}
        types={types.map(({ id, name, price, isDefault }) => ({ id, name, price, isDefault }))}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
