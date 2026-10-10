import { getTranslations, setRequestLocale } from "next-intl/server";
import { FileText } from "lucide-react";
import { clientMap, listPlans } from "@/lib/data/repo";
import { PageHeader, Badge, EmptyState, Avatar } from "@/components/ui/misc";
import { Link } from "@/i18n/routing";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "nav" });
  return { title: t("plans") };
}

export default async function PlansPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("plans");
  const [plans, clients] = await Promise.all([listPlans(), clientMap()]);

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {plans.length === 0 ? (
        <EmptyState icon={<FileText />} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <div className="card-surface divide-y divide-border overflow-hidden">
          {plans.map((p) => {
            const client = clients.get(p.clientId);
            const meals = p.meals.filter((m) => m.name.trim());
            return (
              <Link key={p.id} href={`/clients/${p.clientId}/plans/${p.id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/60 sm:px-5">
                <Avatar name={client?.name ?? "?"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{client?.name ?? "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {meals.length ? meals.map((m) => m.name).join(" · ") : t("noMeals")}
                  </p>
                </div>
                <div className="hidden text-right text-xs text-muted-foreground sm:block">
                  <p>{t("updated", { date: formatDate(p.updatedAt, locale) })}</p>
                  <p>{p.consultationId ? t("fromConsultation") : t("standalone")}</p>
                </div>
                <Badge variant="muted">{p.language === "en" ? "EN" : "PT"}</Badge>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
