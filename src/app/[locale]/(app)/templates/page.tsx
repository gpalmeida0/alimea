import { getTranslations, setRequestLocale } from "next-intl/server";
import { listTemplates } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/misc";
import { TemplatesManager } from "@/components/templates-manager";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "templates" });
  return { title: t("title") };
}

export default async function TemplatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("templates");
  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <TemplatesManager templates={await listTemplates()} />
    </div>
  );
}
