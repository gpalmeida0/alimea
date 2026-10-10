import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginForm } from "@/components/auth-form";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "auth" });
  return { title: t("login") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The demo credentials only exist in the in-memory backend.
  return <LoginForm demoHint={!isSupabaseConfigured()} />;
}
