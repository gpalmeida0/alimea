import { getTranslations, setRequestLocale } from "next-intl/server";
import { listRecommendations } from "@/lib/data/repo";
import { PageHeader, Badge } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createRecommendationAction } from "@/app/actions";

export default async function RecommendationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("recommendations");
  const tcom = await getTranslations("common");
  const recs = await listRecommendations();
  const action = createRecommendationAction.bind(null, locale);

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {recs.map((r) => (
            <Card key={r.id}>
              <CardContent className="pt-5">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-serif text-lg font-semibold">{r.title}</h3>
                  <Badge variant="muted">{t(`categories.${r.category}`)}</Badge>
                </div>
                <p className="text-sm text-foreground">🇵🇹 {r.content["pt-PT"]}</p>
                <p className="mt-1 text-sm text-muted-foreground">🇬🇧 {r.content.en}</p>
              </CardContent>
            </Card>
          ))}
          {recs.length === 0 && <p className="text-sm text-muted-foreground">{t("noItems")}</p>}
        </div>

        <Card className="h-fit">
          <CardContent className="pt-5">
            <h3 className="mb-3 font-serif text-lg font-semibold">{t("new")}</h3>
            <form action={action} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="title">{t("titleLabel")}</Label>
                <Input id="title" name="title" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">{t("category")}</Label>
                <select
                  id="category"
                  name="category"
                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                >
                  {(["hydration", "behavior", "supplementation", "restrictions", "general"] as const).map(
                    (c) => (
                      <option key={c} value={c}>
                        {t(`categories.${c}`)}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="content_pt">🇵🇹 {t("content")}</Label>
                <Textarea id="content_pt" name="content_pt" rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="content_en">🇬🇧 {t("content")}</Label>
                <Textarea id="content_en" name="content_en" rows={2} />
              </div>
              <Button type="submit" className="w-full">
                {tcom("save")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
