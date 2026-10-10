"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Copy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useFeedback } from "@/components/ui/feedback";
import { startConsultationAction } from "@/app/actions";

/** Start a new consultation — blank, or pre-filled from the previous one. */
export function ConsultationButtons({
  clientId,
  hasPrevious,
  types,
  defaultTypeId,
}: {
  clientId: string;
  hasPrevious: boolean;
  types: { id: string; name: string; price: number }[];
  defaultTypeId?: string;
}) {
  const t = useTranslations("client");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useFeedback();
  const [pending, start] = useTransition();
  const [which, setWhich] = useState<"blank" | "duplicate" | null>(null);
  const [typeId, setTypeId] = useState(
    types.some((x) => x.id === defaultTypeId) ? defaultTypeId! : (types[0]?.id ?? ""),
  );
  const eur = new Intl.NumberFormat(locale === "en" ? "en-IE" : "pt-PT", { style: "currency", currency: "EUR" });

  function begin(duplicateLast: boolean) {
    setWhich(duplicateLast ? "duplicate" : "blank");
    start(async () => {
      try {
        await startConsultationAction(locale, clientId, { duplicateLast, consultationTypeId: typeId || undefined });
      } catch (e) {
        if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
        toast(tc("error"), "error");
      }
    });
  }

  return (
    <div className="card-surface flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t("startTitle")}</p>
        <p className="text-xs text-muted-foreground">{hasPrevious ? t("startHintDuplicate") : t("startHint")}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {types.length > 0 && (
          <Select
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            aria-label={t("consultationType")}
            className="sm:w-56"
          >
            {types.map((ct) => (
              <option key={ct.id} value={ct.id}>
                {ct.name} · {eur.format(ct.price)}
              </option>
            ))}
          </Select>
        )}
        <div className="flex flex-wrap gap-2">
          {hasPrevious && (
            <Button
              onClick={() => begin(true)}
              loading={pending && which === "duplicate"}
              disabled={pending}
              className="flex-1 sm:flex-none"
            >
              <Copy /> {t("duplicateLast")}
            </Button>
          )}
          <Button
            variant={hasPrevious ? "outline" : "default"}
            onClick={() => begin(false)}
            loading={pending && which === "blank"}
            disabled={pending}
            className="flex-1 sm:flex-none"
          >
            <Plus /> {t("newConsultation")}
          </Button>
        </div>
      </div>
    </div>
  );
}
