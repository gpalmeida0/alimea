"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Calculator, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Field, NumberInput, Select } from "@/components/ui/input";
import { bmi, bmiClass, macros, targetKcal, type Goal } from "@/lib/nutrition/calc";
import { FFM_FORMULAS, GEB_FORMULAS, PAL_OPTIONS, DEFAULT_PAL, geb, get, suggestGebFormula } from "@/lib/nutrition/energy";
import { DEFAULT_MACRO_CONFIG, type MacroConfig, type Sex } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Totals } from "@/lib/nutrition/items";

/**
 * Quick energy/macro calculator for plans that are not attached to a
 * consultation (consultations have the full Energy and Macros tabs).
 */
export function EnergyCalculator({
  weightKg: initialWeight,
  heightCm: initialHeight,
  age: initialAge,
  sex: initialSex,
  onResult,
}: {
  weightKg?: number;
  heightCm?: number;
  age?: number;
  sex?: Sex;
  onResult: (r: Totals | undefined) => void;
}) {
  const t = useTranslations("calc");
  const tn = useTranslations("nutrition");
  const [open, setOpen] = useState(false);
  const [sex, setSex] = useState<Sex>(initialSex ?? "female");
  const [age, setAge] = useState(initialAge);
  const [weight, setWeight] = useState(initialWeight);
  const [height, setHeight] = useState(initialHeight);
  const [formula, setFormula] = useState(() => suggestGebFormula({ sex: initialSex, ageYears: initialAge }) ?? "mifflin_st_jeor");
  const [pal, setPal] = useState(DEFAULT_PAL);
  const [goal, setGoal] = useState<Goal>("maintain");
  const [split, setSplit] = useState<MacroConfig>(DEFAULT_MACRO_CONFIG);

  const input = { sex, weightKg: weight, heightCm: height, ageYears: age };
  const gebValue = geb(formula, input);
  const getValue = get(gebValue, pal);
  const target = getValue ? targetKcal(getValue, goal) : undefined;
  const m = target ? macros(target, split, weight) : undefined;
  const bmiVal = bmi(weight, height);
  const pctSum = split.proteinPct + split.carbsPct + split.fatPct;

  const result = useMemo<Totals | undefined>(
    () => (target && m ? { kcal: target, protein: m.protein.grams, carbs: m.carbs.grams, fat: m.fat.grams } : undefined),
    [target, m?.protein.grams, m?.carbs.grams, m?.fat.grams], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => onResult(open ? result : undefined), [result, open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card>
      <CardContent className="pt-5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <Calculator className="size-4 text-brand" /> {t("title")}
          </span>
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("sex")}>
                <Select value={sex} onChange={(e) => setSex(e.target.value as Sex)} className="h-8">
                  <option value="female">{t("female")}</option>
                  <option value="male">{t("male")}</option>
                </Select>
              </Field>
              <Field label={t("age")}>
                <NumberInput value={age} onValueChange={setAge} className="h-8" />
              </Field>
              <Field label={tn("weightKg")}>
                <NumberInput value={weight} onValueChange={setWeight} className="h-8" />
              </Field>
              <Field label={tn("heightCm")}>
                <NumberInput value={height} onValueChange={setHeight} className="h-8" />
              </Field>
            </div>
            <Field label={t("formula")}>
              <Select value={formula} onChange={(e) => setFormula(e.target.value)} className="h-8">
                {GEB_FORMULAS.filter((f) => !FFM_FORMULAS.has(f.key)).map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("activity")}>
                <Select value={pal} onChange={(e) => setPal(Number(e.target.value))} className="h-8">
                  {PAL_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.value} — {tn(`palShort.${p.labelKey.split(".")[1]}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("goal")}>
                <Select value={goal} onChange={(e) => setGoal(e.target.value as Goal)} className="h-8">
                  <option value="loss">{t("goals.loss")}</option>
                  <option value="maintain">{t("goals.maintain")}</option>
                  <option value="gain">{t("goals.gain")}</option>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <Result label={t("bmr")} value={gebValue} />
              <Result label={t("tdee")} value={getValue} />
              <Result label={t("target")} value={target} highlight />
            </div>
            {bmiVal != null && (
              <p className="text-center text-xs text-muted-foreground">
                {t("bmi")} {bmiVal} · {t(`bmiClass.${bmiClass(bmiVal)}`)}
              </p>
            )}

            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{t("macros")}</span>
                <span className={cn("text-xs lining-nums tabular-nums", pctSum === 100 ? "text-muted-foreground" : "text-destructive")}>
                  {pctSum}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["proteinPct", t("protein"), m?.protein],
                    ["carbsPct", t("carbs"), m?.carbs],
                    ["fatPct", t("fat"), m?.fat],
                  ] as const
                ).map(([key, label, res]) => (
                  <div key={key} className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">{label} %</p>
                    <NumberInput
                      value={split[key]}
                      onValueChange={(v) => setSplit((s) => ({ ...s, [key]: v ?? 0 }))}
                      className="h-8 text-center"
                    />
                    {res && (
                      <p className="text-center text-[11px] lining-nums tabular-nums">
                        {res.grams}g{res.gPerKg != null && <span className="text-muted-foreground"> · {res.gPerKg}g/kg</span>}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {(!weight || !height || !age) && <p className="text-xs italic text-muted-foreground">{t("needData")}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Result({ label, value, highlight }: { label: string; value?: number; highlight?: boolean }) {
  return (
    <div className={cn("rounded-md p-2", highlight ? "bg-brand-50" : "bg-muted/60")}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("font-serif text-lg font-semibold lining-nums tabular-nums", highlight && "text-brand-700")}>{value ?? "—"}</p>
      <p className="text-[10px] text-muted-foreground">kcal</p>
    </div>
  );
}
