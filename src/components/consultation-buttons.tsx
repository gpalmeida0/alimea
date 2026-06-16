"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startConsultationAction } from "@/app/actions";

interface TypeLite {
  id: string;
  name: string;
  price: number;
}

export function ConsultationButtons({
  clientId,
  hasPrevious,
  types,
}: {
  clientId: string;
  hasPrevious: boolean;
  types: TypeLite[];
}) {
  const t = useTranslations("client");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      {types.length > 0 && (
        <select
          value={typeId}
          onChange={(e) => setTypeId(e.target.value)}
          aria-label={t("consultationType")}
          className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm sm:w-auto"
        >
          {types.map((ct) => (
            <option key={ct.id} value={ct.id}>
              {ct.name}
            </option>
          ))}
        </select>
      )}
      <div className="flex flex-1 flex-wrap gap-2 sm:flex-none">
        {hasPrevious && (
          <Button
            variant="outline"
            disabled={pending}
            className="flex-1 sm:flex-none"
            onClick={() =>
              start(() =>
                startConsultationAction(locale, clientId, {
                  duplicateLast: true,
                  consultationTypeId: typeId || undefined,
                }),
              )
            }
          >
            <Copy /> {t("duplicateLast")}
          </Button>
        )}
        <Button
          disabled={pending}
          className="flex-1 sm:flex-none"
          onClick={() =>
            start(() =>
              startConsultationAction(locale, clientId, {
                consultationTypeId: typeId || undefined,
              }),
            )
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <Plus />} {t("newConsultation")}
        </Button>
      </div>
    </div>
  );
}
