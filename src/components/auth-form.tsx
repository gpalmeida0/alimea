"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Leaf, Loader2 } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { loginAction, signupAction } from "@/app/auth-actions";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const action = mode === "login" ? loginAction : signupAction;
      const res = await action(locale, fd);
      if (res?.error) setError(t(`errors.${res.error}`));
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-3 flex size-12 items-center justify-center rounded-xl bg-brand text-white">
            <Leaf className="size-6" />
          </span>
          <h1 className="font-serif text-3xl font-semibold">Alimea</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login" ? t("loginSubtitle") : t("signupSubtitle")}
          </p>
        </div>

        <form onSubmit={onSubmit} className="card-surface space-y-4 p-6">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("name")}</Label>
              <Input id="name" name="name" required autoComplete="name" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("password")}</Label>
            <Input id="password" name="password" type="password" required autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {mode === "login" ? t("login") : t("signup")}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                {t("noAccount")}{" "}
                <Link href="/signup" className="text-brand-600 hover:underline">
                  {t("signup")}
                </Link>
              </>
            ) : (
              <>
                {t("haveAccount")}{" "}
                <Link href="/login" className="text-brand-600 hover:underline">
                  {t("login")}
                </Link>
              </>
            )}
          </p>
        </form>

        {mode === "login" && (
          <p className="mt-4 text-center text-xs text-muted-foreground">{t("demoHint")}</p>
        )}
      </div>
    </div>
  );
}
