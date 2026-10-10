"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { createClientAction } from "@/app/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { ClientFields } from "./client-form";

export function NewClientForm() {
  const t = useTranslations("common");
  const locale = useLocale();
  const { toast } = useFeedback();
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          try {
            await createClientAction(locale, fd);
          } catch (err) {
            if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
            toast(t("error"), "error");
          }
        });
      }}
    >
      <ClientFields />
      <div className="mt-6 flex justify-end gap-2">
        <Link href="/clients" className={buttonVariants({ variant: "ghost" })}>
          {t("cancel")}
        </Link>
        <Button type="submit" loading={pending}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
