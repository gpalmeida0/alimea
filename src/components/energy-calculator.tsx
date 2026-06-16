"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Calculator, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import {
  ACTIVITY_LEVELS,
  bmr,
  bmi,
  bmiClass,
  macros,
  targetKcal,
  tdee,
  type ActivityLevel,
  type BmrFormula,
  type Goal,
  type Sex,
} from "@/lib/nutrition/calc";

interface Props {
  weightKg?: number;
  heightCm?: number;
  initialAge?: number;
  onResult?: (r: { kcal: number; protein: number; carbs: number; fat: number } | undefined) => void;
}

export function EnergyCalculator({ weightKg, heightCm, initialAge, onResult }: Props) {
  const t = useTranslations("calc");
  const [open, setOpen] = useState(false);
  const [sex, setSex] = useState<Sex>("female");
  const [age, setAge] = useState<number | undefined>(initialAge);
  const [activity, setActivity] = useState<ActivityLevel>("light");
  const [goal, setGoal] = useState<Goal>("maintain");
  const [formula, setFormula] = useState<BmrFormula>("mifflin");
  const [p, setP] = useState(30);
  const [c, setC] = useState(40);
  const [f, setF] = useState(30);

  const bmrVal =
    weightKg && heightCm && age
      ? bmr({ sex, weightKg, heightCm, ageYears: age }, formula)
      : undefined;
  const tdeeVal = bmrVal ? tdee(bmrVal, activity) : undefined;
  const target = tdeeVal ? targetKcal(tdeeVal, goal) : undefined;
  const m = target ? macros(target, { proteinPct: p, carbsPct: c, fatPct: f }, weightKg) : undefined;
  const bmiVal = bmi(weightKg, heightCm);
  const pctSum = p + c + f;

  // Report the computed target up to the plan editor (for the nutrition summary).
  useEffect(() => {
    onResult?.(
      target && m
        ? { kcal: target, protein: m.protein.grams, carbs: m.carbs.grams, fat: m.fat.grams }
        : undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, m?.protein.grams, m?.carbs.grams, m?.fat.grams]);

  return (
    <Card>
      <CardContent className="pt-5">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <Calculator className="size-4 text-brand" /> {t("title")}
          </span>
          <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("sex")}>
                <select value={sex} onChange={(e) => setSex(e.target.value as Sex)} className={selectCls}>
                  <option value="female">{t("female")}</option>
                  <option value="male">{t("male")}</option>
                </select>
              </Field>
              <Field label={t("age")}>
                <Input
                  type="number"
                  value={age ?? ""}
                  onChange={(e) => setAge(e.target.value ? Number(e.target.value) : undefined)}
                  className="h-8"
                />
              </Field>
              <Field label={t("activity")}>
                <select value={activity} onChange={(e) => setActivity(e.target.value as ActivityLevel)} className={selectCls}>
                  {(Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]).map((a) => (
                    <option key={a} value={a}>
                      {t(`activities.${a}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("goal")}>
                <select value={goal} onChange={(e) => setGoal(e.target.value as Goal)} className={selectCls}>
                  <option value="loss">{t("goals.loss")}</option>
                  <option value="maintain">{t("goals.maintain")}</option>
                  <option value="gain">{t("goals.gain")}</option>
                </select>
              </Field>
            </div>

            <Field label={t("formula")}>
              <select value={formula} onChange={(e) => setFormula(e.target.value as BmrFormula)} className={selectCls}>
                <option value="mifflin">Mifflin-St Jeor</option>
                <option value="harris">Harris-Benedict</option>
              </select>
            </Field>

            {/* Results */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <Result label={t("bmr")} value={bmrVal} unit="kcal" />
              <Result label={t("tdee")} value={tdeeVal} unit="kcal" />
              <Result label={t("target")} value={target} unit="kcal" highlight />
            </div>

            {bmiVal != null && (
              <p className="text-center text-xs text-muted-foreground">
{t("bmi")} {bmiVal} · {t(`bmiClass.${bmiClass(bmiVal)}`)}
              </p>
            )}

            {/* Macro split */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label>{t("macros")}</Label>
                <span className={`text-xs ${pctSum === 100 ? "text-muted-foreground" : "text-destructive"}`}>
                  {pctSum}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <MacroInput label={t("protein")} pct={p} setPct={setP} />
                <MacroInput label={t("carbs")} pct={c} setPct={setC} />
                <MacroInput label={t("fat")} pct={f} setPct={setF} />
              </div>
              {m && (
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                  <MacroResult grams={m.protein.grams} gPerKg={m.protein.gPerKg} />
                  <MacroResult grams={m.carbs.grams} gPerKg={m.carbs.gPerKg} />
                  <MacroResult grams={m.fat.grams} gPerKg={m.fat.gPerKg} />
                </div>
              )}
            </div>

            {(!weightKg || !heightCm || !age) && (
              <p className="text-xs italic text-muted-foreground">{t("needData")}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const selectCls = "flex h-8 w-full rounded-md border border-input bg-card px-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px]">{label}</Label>
      {children}
    </div>
  );
}

function Result({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value?: number;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-md p-2 ${highlight ? "bg-brand-50" : "bg-muted/50"}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-serif text-lg font-semibold ${highlight ? "text-brand-600" : ""}`}>
        {value ?? "—"}
      </p>
      <p className="text-[10px] text-muted-foreground">{unit}</p>
    </div>
  );
}

function MacroInput({ label, pct, setPct }: { label: string; pct: number; setPct: (n: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] normal-case">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          value={pct}
          onChange={(e) => setPct(Number(e.target.value) || 0)}
          className="h-8 pr-5 text-center"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          %
        </span>
      </div>
    </div>
  );
}

function MacroResult({ grams, gPerKg }: { grams: number; gPerKg?: number }) {
  return (
    <div className="rounded-md bg-muted/50 p-1.5">
      <p className="font-medium">{grams}g</p>
      {gPerKg != null && <p className="text-[10px] text-muted-foreground">{gPerKg} g/kg</p>}
    </div>
  );
}
