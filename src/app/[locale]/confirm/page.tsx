import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConfirmLinkForm } from "@/components/auth-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "auth" });
  return { title: t("confirmTitle"), referrer: "no-referrer" as const };
}

/**
 * Emailed links (invite, password reset, email change) land here. The token is
 * only redeemed when the person presses the button, so link scanners in mail
 * clients cannot spend it first.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token_hash, type } = await searchParams;
  return <ConfirmLinkForm tokenHash={token_hash} type={type} />;
}
