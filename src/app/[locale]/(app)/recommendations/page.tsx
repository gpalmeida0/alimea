import { getTranslations, setRequestLocale } from "next-intl/server";
import { listRecommendations } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/misc";
import { RecommendationsManager } from "@/components/recommendations-manager";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "recommendations" });
  return { title: t("title") };
}

export default async function RecommendationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("recommendations");
  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <RecommendationsManager items={await listRecommendations()} />
    </div>
  );
}
