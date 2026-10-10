"use client";

import { useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import {
  changeLoginEmailAction,
  changePasswordAction,
  confirmMfaAction,
  disableMfaAction,
  startMfaAction,
} from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFeedback } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import type { MfaEnrollment } from "@/lib/data/repo-types";

export function SecuritySettings({
  loginEmail,
  mfa,
}: {
  loginEmail: string;
  mfa: { supported: boolean; enabled: boolean };
}) {
  const t = useTranslations("settings.security");
  const tAuth = useTranslations("auth");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const [pending, start] = useTransition();
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState("");
  const passwordForm = useRef<HTMLFormElement>(null);

  function submitEmail(fd: FormData) {
    start(async () => {
      const res = await changeLoginEmailAction(locale, fd);
      if (res === "ok") {
        toast(tc("saved"));
        router.refresh();
      } else if (res === "confirm") toast(t("emailConfirm"));
      else toast(t(`emailErrors.${res}`), "error");
    });
  }

  function submitPassword(fd: FormData) {
    start(async () => {
      const res = await changePasswordAction(locale, fd);
      if (res && "error" in res) return toast(tAuth(`errors.${res.error === "invalid" ? "currentPassword" : res.error}`), "error");
      toast(t("passwordChanged"));
      passwordForm.current?.reset();
    });
  }

  function startEnrollment() {
    start(async () => {
      const res = await startMfaAction(locale);
      if (!res) return toast(tc("error"), "error");
      setCode("");
      setEnrollment(res);
    });
  }

  function confirmEnrollment() {
    if (!enrollment) return;
    start(async () => {
      if (!(await confirmMfaAction(locale, enrollment.factorId, code))) return toast(tAuth("errors.code"), "error");
      setEnrollment(null);
      toast(t("mfaEnabled"));
      router.refresh();
    });
  }

  async function disable() {
    if (!(await confirm({ title: t("mfaDisableTitle"), body: t("mfaDisableBody"), destructive: true, confirmLabel: t("mfaDisable") }))) return;
    start(async () => {
      if (!(await disableMfaAction(locale))) return toast(tc("error"), "error");
      toast(t("mfaDisabled"));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-6 divide-y divide-border [&>*:not(:first-child)]:pt-6">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submitEmail(new FormData(e.currentTarget));
          }}
        >
          <Field label={t("loginEmail")} htmlFor="sec-email" hint={t("loginEmailHint")} className="min-w-56 flex-1">
            <Input id="sec-email" name="email" type="email" required defaultValue={loginEmail} autoComplete="email" />
          </Field>
          <Button type="submit" variant="outline" disabled={pending} className="mb-[22px]">
            {t("changeEmail")}
          </Button>
        </form>

        <form
          ref={passwordForm}
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submitPassword(new FormData(e.currentTarget));
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("currentPassword")} htmlFor="sec-current">
              <Input id="sec-current" name="current" type="password" required autoComplete="current-password" />
            </Field>
            <Field label={tAuth("newPassword")} htmlFor="sec-new" hint={tAuth("passwordHint", { min: MIN_PASSWORD_LENGTH })}>
              <Input id="sec-new" name="password" type="password" required minLength={MIN_PASSWORD_LENGTH} maxLength={200} autoComplete="new-password" />
            </Field>
            <Field label={tAuth("confirmPassword")} htmlFor="sec-confirm">
              <Input id="sec-confirm" name="confirm" type="password" required minLength={MIN_PASSWORD_LENGTH} maxLength={200} autoComplete="new-password" />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="outline" disabled={pending}>
              {t("changePassword")}
            </Button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                {t("mfaTitle")}
                {mfa.supported && <Badge>{mfa.enabled ? t("mfaOn") : t("mfaOff")}</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">{mfa.supported ? t("mfaHint") : t("mfaUnsupported")}</p>
            </div>
            {mfa.supported &&
              !enrollment &&
              (mfa.enabled ? (
                <Button variant="outline" disabled={pending} onClick={disable}>
                  {t("mfaDisable")}
                </Button>
              ) : (
                <Button disabled={pending} onClick={startEnrollment}>
                  {t("mfaEnable")}
                </Button>
              ))}
          </div>

          {enrollment && (
            <div className="flex flex-wrap items-start gap-5 rounded-lg border border-border bg-muted/30 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enrollment.qrCode} alt={t("mfaQrAlt")} className="size-40 rounded-md bg-white p-1" />
              <div className="min-w-56 flex-1 space-y-3">
                <p className="text-sm">{t("mfaScan")}</p>
                <p className="break-all font-mono text-xs text-muted-foreground">{enrollment.secret}</p>
                <Field label={tAuth("mfaCode")} htmlFor="sec-code">
                  <Input
                    id="sec-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="w-40 tracking-[0.3em]"
                  />
                </Field>
                <div className="flex gap-2">
                  <Button disabled={code.length !== 6} loading={pending} onClick={confirmEnrollment}>
                    {tAuth("verify")}
                  </Button>
                  <Button variant="ghost" disabled={pending} onClick={() => setEnrollment(null)}>
                    {tc("cancel")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
