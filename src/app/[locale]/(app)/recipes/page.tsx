import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { RecipesManager } from "@/components/recipes-manager";
import { listFoods, listRecipes } from "@/lib/data/repo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "nutrition" });
  return { title: t("recipesTitle") };
}

export default async function RecipesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nutrition");
  const [recipes, foods] = await Promise.all([listRecipes(), listFoods({ includeArchived: true })]);
  return (
    <div>
      <PageHeader title={t("recipesTitle")} subtitle={t("recipesSubtitle")} />
      <RecipesManager recipes={recipes} foods={foods} />
    </div>
  );
}
