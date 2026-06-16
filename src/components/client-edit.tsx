"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { updateClientAction } from "@/app/actions";

interface Props {
  clientId: string;
  name: string;
  email?: string;
  phone?: string;
  goals?: string;
  notes?: string;
}

export function ClientEditButton(props: Props) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil /> {tc("edit")}
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold">{tc("edit")}</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                start(async () => {
                  await updateClientAction(locale, props.clientId, fd);
                  router.refresh();
                  setOpen(false);
                });
              }}
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <Label>{t("name")}</Label>
                <Input name="name" defaultValue={props.name} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("email")}</Label>
                  <Input name="email" type="email" defaultValue={props.email ?? ""} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("phone")}</Label>
                  <Input name="phone" defaultValue={props.phone ?? ""} placeholder="911 920 299" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("goals")}</Label>
                <Textarea name="goals" defaultValue={props.goals ?? ""} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("notes")}</Label>
                <Textarea name="notes" defaultValue={props.notes ?? ""} rows={2} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" /> : null} {tc("save")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
