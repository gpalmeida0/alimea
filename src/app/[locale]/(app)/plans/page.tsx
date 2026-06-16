import { getTranslations, setRequestLocale } from "next-intl/server";
import { FileText } from "lucide-react";
import { getClient, listPlans } from "@/lib/data/repo";
import { PageHeader, Badge } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/routing";
import { formatDate } from "@/lib/utils";

export default async function PlansPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");
  const tp = await getTranslations("plan");
  const plans = await listPlans();
  const rows = await Promise.all(
    plans.map(async (p) => ({ ...p, client: await getClient(p.clientId) })),
  );

  return (
    <div>
      <PageHeader title={t("plans")} subtitle={tp("title")} />
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {rows.map((p) => (
            <Link
              key={p.id}
              href={`/clients/${p.clientId}/plans/${p.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-muted"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <FileText className="size-5" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">{p.client?.name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {p.meals.length} {tp("meals").toLowerCase()} · {formatDate(p.updatedAt, locale)}
                </p>
              </div>
              <Badge variant="muted">{p.language === "en" ? "EN" : "PT"}</Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
