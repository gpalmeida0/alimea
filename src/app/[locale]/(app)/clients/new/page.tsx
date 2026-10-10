import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/routing";
import { NewClientForm } from "@/components/new-client-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "clients" });
  return { title: t("createTitle") };
}

export default async function NewClientPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("clients");
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={
          <Link href="/clients" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> {t("title")}
          </Link>
        }
        title={t("createTitle")}
        subtitle={t("createSubtitle")}
      />
      <Card>
        <CardContent className="pt-6">
          <NewClientForm />
        </CardContent>
      </Card>
    </div>
  );
}
