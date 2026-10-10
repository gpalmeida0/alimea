import { getTranslations, setRequestLocale } from "next-intl/server";
import { UpdatePasswordForm } from "@/components/auth-form";
import { redirect } from "@/i18n/routing";
import { getAuthNid } from "@/lib/data/repo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "auth" });
  return { title: t("newPasswordTitle") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getAuthNid())) redirect({ href: "/login", locale });
  return <UpdatePasswordForm />;
}
