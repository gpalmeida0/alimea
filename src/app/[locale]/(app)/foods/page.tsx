import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { FoodsPageTabs } from "@/components/foods-page-tabs";
import { listFoods } from "@/lib/data/repo";

export default async function FoodsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("foods");
  const foods = await listFoods({ includeArchived: true });
  return (
    <div>
      <PageHeader title={t("pageTitle")} subtitle={t("subtitle")} />
      <FoodsPageTabs foods={foods} />
    </div>
  );
}
