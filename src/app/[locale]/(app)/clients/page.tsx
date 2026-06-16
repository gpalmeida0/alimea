import { getTranslations, setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { listClients, listConsultations } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { ClientsList } from "@/components/clients-list";

export default async function ClientsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("clients");
  const clients = await listClients();

  const rows = await Promise.all(
    clients.map(async (c) => {
      const consults = await listConsultations(c.id);
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        consultations: consults.length,
        lastConsultation: consults[0]?.date,
      };
    }),
  );

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <Link href="/clients/new">
            <Button>
              <Plus /> {t("new")}
            </Button>
          </Link>
        }
      />
      <ClientsList rows={rows} locale={locale} />
    </div>
  );
}
