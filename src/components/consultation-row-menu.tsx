"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MoreVertical, Trash2 } from "lucide-react";
import { deleteConsultationAction } from "@/app/actions";
import { useFeedback } from "@/components/ui/feedback";
import { useServerAction } from "@/hooks/use-server-action";

export function ConsultationRowMenu({ consultationId, clientId }: { consultationId: string; clientId: string }) {
  const t = useTranslations("client");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { confirm } = useFeedback();
  const { run } = useServerAction();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative pr-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={tc("more")}
        aria-expanded={open}
      >
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-52 rounded-lg border border-border bg-card p-1 shadow-lg animate-in fade-in-0 zoom-in-95">
            <button
              onClick={async () => {
                setOpen(false);
                if (await confirm({ title: t("deleteConsultation"), body: t("deleteConsultationBody"), destructive: true })) {
                  run(() => deleteConsultationAction(locale, consultationId, clientId), { success: tc("deleted") });
                }
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-4" /> {t("deleteConsultation")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
