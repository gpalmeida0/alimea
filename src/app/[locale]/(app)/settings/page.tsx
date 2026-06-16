import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getProfile, listPdfTemplates } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/misc";
import { PdfTemplatesManager } from "@/components/pdf-templates-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateProfileAction } from "@/app/actions";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("settings");
  const tcom = await getTranslations("common");
  const [profile, pdfTemplates] = await Promise.all([getProfile(), listPdfTemplates()]);
  const action = updateProfileAction.bind(null, locale);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("title")} />
      <Card>
        <CardHeader className="flex-row items-center gap-4">
          {profile.logoUrl && (
            <Image src={profile.logoUrl} alt="logo" width={56} height={56} className="rounded-full" />
          )}
          <CardTitle>{t("profile")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("professionalName")} name="name" defaultValue={profile.name} />
              <Field label={t("credential")} name="credential" defaultValue={profile.credential} />
              <Field label="Email" name="email" type="email" defaultValue={profile.email} />
              <Field label={t("instagram")} name="instagram" defaultValue={profile.instagram ?? ""} />
              <Field label={t("phone")} name="phone" defaultValue={profile.phone ?? ""} />
              <Field label={t("address")} name="address" defaultValue={profile.address ?? ""} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="interfaceLanguage">{t("interfaceLanguage")}</Label>
              <select
                id="interfaceLanguage"
                name="interfaceLanguage"
                defaultValue={profile.interfaceLanguage}
                className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm sm:w-48"
              >
                <option value="pt-PT">Português (Portugal)</option>
                <option value="en">English</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="logo">{t("logo")}</Label>
              <div className="flex items-center gap-3">
                {profile.logoUrl && (
                  <Image
                    src={profile.logoUrl}
                    alt="logo"
                    width={48}
                    height={48}
                    className="rounded-full border border-border"
                  />
                )}
                <Input
                  id="logo"
                  name="logo"
                  type="file"
                  accept="image/png,image/jpeg"
                  className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">{t("logoHint")}</p>
            </div>

            <p className="text-xs text-muted-foreground">{t("brandingNote")}</p>
            <div className="flex justify-end">
              <Button type="submit">{tcom("save")}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <PdfTemplatesManager
        templates={pdfTemplates.map((p) => ({ id: p.id, name: p.name, storagePath: p.storagePath }))}
      />
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} />
    </div>
  );
}
