"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { LanguageSwitcher } from "@/components/shell/language-switcher";
import {
  forgotPasswordAction,
  loginAction,
  logoutAction,
  redeemLinkAction,
  setPasswordAction,
  verifyMfaAction,
  type AuthResult,
} from "@/app/auth-actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

/** Centered card layout shared by every signed-out screen. */
function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const tApp = useTranslations("app");
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50/60 to-background px-4 py-12">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <h1>
            <Logo size="lg" />
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">{tApp("tagline")}</p>
        </div>
        <div className="card-surface space-y-4 p-6 shadow-sm">
          <div>
            <h2 className="font-serif text-2xl font-semibold">{title}</h2>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </div>
        {footer}
      </div>
    </div>
  );
}

/** Runs an auth server action and turns its `{ error }` into a translated message. */
function useAuthAction() {
  const t = useTranslations("auth");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<AuthResult>, onDone?: () => void) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res && "error" in res) setError(t(`errors.${res.error}`));
      else onDone?.();
    });
  };
  return { error, pending, run };
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}

function BackToLogin() {
  const t = useTranslations("auth");
  return (
    <p className="text-center text-sm">
      <Link href="/login" className="font-medium text-brand-600 hover:underline">
        {t("backToLogin")}
      </Link>
    </p>
  );
}

function PasswordInput({ id, name, autoComplete, minLength }: { id: string; name: string; autoComplete: string; minLength?: number }) {
  const t = useTranslations("auth");
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} name={name} type={show ? "text" : "password"} required minLength={minLength} maxLength={200} autoComplete={autoComplete} className="pr-10" />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
        aria-label={show ? t("hidePassword") : t("showPassword")}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function LoginForm({ demoHint }: { demoHint?: boolean }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const { error, pending, run } = useAuthAction();

  return (
    <AuthShell
      title={t("login")}
      subtitle={t("loginSubtitle")}
      footer={demoHint && <p className="mt-4 text-center text-xs text-muted-foreground">{t("demoHint")}</p>}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run(() => loginAction(locale, fd));
        }}
      >
        <Field label={t("email")} htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label={t("password")} htmlFor="password">
          <PasswordInput id="password" name="password" autoComplete="current-password" />
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" className="w-full" loading={pending}>
          {t("login")}
        </Button>
        <p className="text-center text-sm">
          <Link href="/forgot-password" className="font-medium text-brand-600 hover:underline">
            {t("forgotPassword")}
          </Link>
        </p>
        <p className="text-center text-xs text-muted-foreground">{t("inviteOnly")}</p>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  return (
    <AuthShell title={t("forgotTitle")} subtitle={sent ? undefined : t("forgotSubtitle")}>
      {sent ? (
        <div className="space-y-3 text-center">
          <MailCheck className="mx-auto size-8 text-brand" />
          <p className="text-sm">{t("forgotSent")}</p>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              await forgotPasswordAction(locale, fd);
              setSent(true);
            });
          }}
        >
          <Field label={t("email")} htmlFor="email">
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </Field>
          <Button type="submit" className="w-full" loading={pending}>
            {t("sendResetLink")}
          </Button>
        </form>
      )}
      <BackToLogin />
    </AuthShell>
  );
}

/** Landing screen for emailed links (invite, password reset, email change). */
export function ConfirmLinkForm({ tokenHash, type }: { tokenHash?: string; type?: string }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const { error, pending, run } = useAuthAction();
  const broken = !tokenHash || !type;

  return (
    <AuthShell title={t(type === "invite" ? "inviteTitle" : "confirmTitle")} subtitle={broken ? undefined : t("confirmSubtitle")}>
      <ErrorNote>{broken ? t("errors.link") : error}</ErrorNote>
      {!broken && (
        <Button className="w-full" loading={pending} onClick={() => run(() => redeemLinkAction(locale, tokenHash, type))}>
          {t("continue")}
        </Button>
      )}
      <BackToLogin />
    </AuthShell>
  );
}

export function UpdatePasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const { error, pending, run } = useAuthAction();

  return (
    <AuthShell title={t("newPasswordTitle")} subtitle={t("newPasswordSubtitle")}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run(() => setPasswordAction(locale, fd));
        }}
      >
        <Field label={t("newPassword")} htmlFor="password" hint={t("passwordHint", { min: MIN_PASSWORD_LENGTH })}>
          <PasswordInput id="password" name="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} />
        </Field>
        <Field label={t("confirmPassword")} htmlFor="confirm">
          <PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} />
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" className="w-full" loading={pending}>
          {t("savePassword")}
        </Button>
      </form>
    </AuthShell>
  );
}

export function MfaForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const { error, pending, run } = useAuthAction();
  const [leaving, startLeaving] = useTransition();

  return (
    <AuthShell title={t("mfaTitle")} subtitle={t("mfaSubtitle")}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run(() => verifyMfaAction(locale, fd, next));
        }}
      >
        <Field label={t("mfaCode")} htmlFor="code">
          <Input
            id="code"
            name="code"
            required
            autoFocus
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            className="text-center text-lg tracking-[0.4em]"
          />
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" className="w-full" loading={pending}>
          {t("verify")}
        </Button>
        <p className="text-center text-xs text-muted-foreground">{t("mfaLost")}</p>
      </form>
      <Button variant="ghost" size="sm" className="w-full" loading={leaving} onClick={() => startLeaving(() => logoutAction(locale))}>
        {t("logout")}
      </Button>
    </AuthShell>
  );
}
