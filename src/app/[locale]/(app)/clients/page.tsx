import { getTranslations, setRequestLocale } from "next-intl/server";
import { UserPlus } from "lucide-react";
import { listAllConsultations, listAppointments, listClients } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/misc";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { ClientsList, type ClientRow } from "@/components/clients-list";
import { ageFromBirth } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "clients" });
  return { title: t("title") };
}

export default async function ClientsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("clients");
  const [clients, consultations, appts] = await Promise.all([
    listClients(),
    listAllConsultations(),
    listAppointments(),
  ]);

  const now = Date.now();
  const rows: ClientRow[] = clients.map((c) => {
    const own = consultations.filter((x) => x.clientId === c.id); // newest first
    const next = appts.find((a) => a.clientId === c.id && a.status === "scheduled" && new Date(a.date).getTime() >= now);
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      age: ageFromBirth(c.birthDate),
      consultations: own.length,
      lastConsultation: own[0]?.date,
      lastWeight: own[0]?.measurements.weightKg,
      nextAppointment: next?.date,
      createdAt: c.createdAt,
    };
  });

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <Link href="/clients/new" className={buttonVariants()}>
            <UserPlus /> {t("new")}
          </Link>
        }
      />
      <ClientsList rows={rows} locale={locale} />
    </div>
  );
}
