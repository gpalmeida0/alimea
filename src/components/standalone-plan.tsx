"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, Check, Cloud, Loader2, Save } from "lucide-react";
import { savePlanAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { EnergyCalculator } from "@/components/energy-calculator";
import { PlanEditor, type PlanDraft, type PlanEditorContext } from "@/components/plan-editor";
import { useAutosave } from "@/hooks/use-autosave";
import type { Totals } from "@/lib/nutrition/items";
import type { Sex } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A plan not attached to a consultation: editor + autosave + quick calculator. */
export function StandalonePlan({
  initialPlan,
  ctx,
  calculator,
}: {
  initialPlan: PlanDraft;
  ctx: PlanEditorContext;
  calculator: { weightKg?: number; heightCm?: number; age?: number; sex?: Sex };
}) {
  const t = useTranslations("common");
  const locale = useLocale();
  const [plan, setPlan] = useState(initialPlan);
  const [target, setTarget] = useState<Totals | undefined>();
  const { state, saveNow } = useAutosave(plan, async (p) => {
    await savePlanAction(locale, ctx.planId, p);
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-3">
        <span className={cn("flex items-center gap-1.5 text-xs", state === "error" ? "text-destructive" : "text-muted-foreground")}>
          {state === "saving" && <Loader2 className="size-3.5 animate-spin" />}
          {state === "dirty" && <Cloud className="size-3.5" />}
          {state === "error" && <AlertCircle className="size-3.5" />}
          {state === "saved" && <Check className="size-3.5 text-brand" />}
          {t(state === "saving" ? "saving" : state === "dirty" ? "unsaved" : state === "error" ? "saveFailed" : "allSaved")}
        </span>
        <Button size="sm" variant={state === "saved" ? "outline" : "default"} onClick={() => void saveNow()} loading={state === "saving"}>
          <Save /> {t("save")}
        </Button>
      </div>
      <PlanEditor
        draft={plan}
        update={(fn) => setPlan(fn)}
        ctx={ctx}
        target={target}
        ensureSaved={saveNow}
        aside={<EnergyCalculator {...calculator} onResult={setTarget} />}
      />
    </div>
  );
}
