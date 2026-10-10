import { getTranslations, setRequestLocale } from "next-intl/server";
import { MfaForm } from "@/components/auth-form";
import { redirect } from "@/i18n/routing";
import { getMfaStatus } from "@/lib/data/repo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "auth" });
  return { title: t("mfaTitle") };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getMfaStatus()).pending) redirect({ href: "/", locale });
  return <MfaForm next={(await searchParams).next} />;
}
