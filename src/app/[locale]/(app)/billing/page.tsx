import { getTranslations, setRequestLocale } from "next-intl/server";
import { listBillingEntries, listClients, listConsultationTypes } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/misc";
import { BillingManager } from "@/components/billing-manager";

export default async function BillingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("billing");
  const [entries, types, clients] = await Promise.all([
    listBillingEntries(),
    listConsultationTypes(),
    listClients(),
  ]);

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <BillingManager
        entries={entries}
        types={types.map((ct) => ({
          id: ct.id,
          name: ct.name,
          price: ct.price,
          isDefault: ct.isDefault,
        }))}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        locale={locale}
      />
    </div>
  );
}
