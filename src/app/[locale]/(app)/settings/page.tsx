import { getTranslations, setRequestLocale } from "next-intl/server";
import { getLoginEmail, getMfaStatus, getProfile, listPdfTemplates, backend } from "@/lib/data/repo";
import { fileUrl } from "@/lib/files";
import { isSmsConfigured } from "@/lib/messaging/sms";
import { isAiConfigured } from "@/lib/ai/assistant";
import { PageHeader } from "@/components/ui/misc";
import { SettingsForm } from "@/components/settings-form";
import { SecuritySettings } from "@/components/security-settings";
import { PdfTemplatesManager } from "@/components/pdf-templates-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "settings" });
  return { title: t("title") };
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("settings");
  const [profile, pdfTemplates, loginEmail, mfa] = await Promise.all([
    getProfile(),
    listPdfTemplates(),
    getLoginEmail(),
    getMfaStatus(),
  ]);

  const integrations = [
    { key: "database", ok: backend === "supabase" },
    { key: "sms", ok: isSmsConfigured() },
    { key: "ai", ok: isAiConfigured() },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <SettingsForm profile={profile} logoSrc={fileUrl(profile.logoUrl)} />
      <SecuritySettings loginEmail={loginEmail ?? ""} mfa={{ supported: mfa.supported, enabled: mfa.enabled }} />
      <PdfTemplatesManager templates={pdfTemplates.map((p) => ({ id: p.id, name: p.name, url: fileUrl(p.storagePath)! }))} />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("integrations")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("integrationsHint")}</p>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {integrations.map((i) => (
            <div key={i.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium">{t(`integration.${i.key}.title`)}</p>
                <p className="text-xs text-muted-foreground">{t(`integration.${i.key}.${i.ok ? "on" : "off"}`)}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${i.ok ? "bg-brand-50 text-brand-700" : "bg-muted text-muted-foreground"}`}
              >
                {i.ok ? t("active") : t("inactive")}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
