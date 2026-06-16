import { getTranslations, setRequestLocale } from "next-intl/server";
import { LayoutTemplate } from "lucide-react";
import { listTemplates } from "@/lib/data/repo";
import { PageHeader, Badge } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { TemplateBuilder } from "@/components/template-builder";

export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("templates");
  const templates = await listTemplates();

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((tpl) => (
            <Card key={tpl.id}>
              <CardContent className="pt-5">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-serif text-lg font-semibold">
                    <LayoutTemplate className="size-4 text-brand" /> {tpl.name}
                  </h3>
                  <Badge variant="muted">{tpl.language === "en" ? "EN" : "PT"}</Badge>
                </div>
                <ul className="space-y-0.5 text-sm text-muted-foreground">
                  {tpl.meals.length === 0 && <li className="italic">—</li>}
                  {tpl.meals.map((m) => (
                    <li key={m.id}>• {m.name || "—"}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
          {templates.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("noItems")}</p>
          )}
        </div>

        <TemplateBuilder />
      </div>
    </div>
  );
}
