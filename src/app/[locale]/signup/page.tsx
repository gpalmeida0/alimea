import { setRequestLocale } from "next-intl/server";
import { AuthForm } from "@/components/auth-form";

export default async function SignupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AuthForm mode="signup" />;
}
