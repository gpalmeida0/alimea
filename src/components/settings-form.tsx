"use client";

import { useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ImageUp, X } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/routing";
import { updateProfileAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFeedback } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/input";
import type { NutritionistProfile } from "@/lib/types";

export function SettingsForm({ profile, logoSrc }: { profile: NutritionistProfile; logoSrc?: string }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useFeedback();
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<string | undefined>(logoSrc);
  const [removeLogo, setRemoveLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("profile")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("brandingNote")}</p>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            if (removeLogo) fd.set("removeLogo", "1");
            start(async () => {
              try {
                const res = await updateProfileAction(locale, fd);
                if (!res.ok) return toast(t(`errors.${res.error}`), "error");
                toast(tc("saved"));
                if (fileRef.current) fileRef.current.value = "";
                if (res.locale !== locale) router.replace(pathname, { locale: res.locale });
                else router.refresh();
              } catch {
                toast(tc("error"), "error");
              }
            });
          }}
        >
          <div className="flex items-center gap-4">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt={t("logo")} className="size-full object-contain p-1" />
              ) : (
                <ImageUp className="size-6 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <ImageUp /> {t("uploadLogo")}
                </Button>
                {preview && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPreview(undefined);
                      setRemoveLogo(true);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  >
                    <X /> {t("removeLogo")}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t("logoHint")}</p>
              <input
                ref={fileRef}
                type="file"
                name="logo"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 2 * 1024 * 1024) {
                    toast(t("errors.logoSize"), "error");
                    e.target.value = "";
                    return;
                  }
                  setPreview(URL.createObjectURL(f));
                  setRemoveLogo(false);
                }}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("professionalName")} htmlFor="s-name">
              <Input id="s-name" name="name" defaultValue={profile.name} required />
            </Field>
            <Field label={t("credential")} htmlFor="s-cred">
              <Input id="s-cred" name="credential" defaultValue={profile.credential} />
            </Field>
            <Field label={t("email")} htmlFor="s-email">
              <Input id="s-email" name="email" type="email" defaultValue={profile.email} />
            </Field>
            <Field label={t("phone")} htmlFor="s-phone">
              <Input id="s-phone" name="phone" type="tel" defaultValue={profile.phone ?? ""} />
            </Field>
            <Field label={t("instagram")} htmlFor="s-ig">
              <Input id="s-ig" name="instagram" defaultValue={profile.instagram ?? ""} placeholder="@" />
            </Field>
            <Field label={t("address")} htmlFor="s-addr">
              <Input id="s-addr" name="address" defaultValue={profile.address ?? ""} />
            </Field>
          </div>
          <Field label={t("interfaceLanguage")} htmlFor="s-lang" hint={t("interfaceLanguageHint")} className="sm:w-64">
            <Select id="s-lang" name="interfaceLanguage" defaultValue={profile.interfaceLanguage}>
              <option value="pt-PT">Português (Portugal)</option>
              <option value="en">English</option>
            </Select>
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={pending}>
              {tc("save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
