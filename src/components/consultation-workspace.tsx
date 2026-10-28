"use client";

import { useCallback, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
  Calculator,
  Check,
  ClipboardList,
  Cloud,
  Flame,
  Loader2,
  PieChart,
  Plus,
  Ruler,
  Save,
  Utensils,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Label, NumberInput, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/misc";
import { PlanEditor, type PlanDraft, type PlanEditorContext } from "@/components/plan-editor";
import { saveWorkspaceAction } from "@/app/actions";
import { useAutosave, type SaveState } from "@/hooks/use-autosave";
import { bmiClass, GOAL_ADJUSTMENT, macros as macroSplit, type Goal, type MacroBreakdown } from "@/lib/nutrition/calc";
import { bodyFatPercent, muscleMassKg, type FormulaResult } from "@/lib/nutrition/body-composition";
import {
  DEFAULT_PAL,
  FFM_FORMULAS,
  GEB_FORMULAS,
  PAL_OPTIONS,
  geb as computeGeb,
  get as computeGet,
  isApplicable,
  suggestGebFormula,
} from "@/lib/nutrition/energy";
import {
  bodyFatOf,
  computeBmi,
  DEFAULT_MACRO_CONFIG,
  heightCmOf,
  sumPerimeters,
  sumSkinfolds,
  type Anamnesis,
  type Consultation,
  type EnergyConfig,
  type Ethnicity,
  type FoodHistory,
  type FoodHistoryMeal,
  type MacroConfig,
  type Measurements,
  type Sex,
} from "@/lib/types";
import { ageFromBirth, cn, formatDate, formatNumber, newId } from "@/lib/utils";

type Tab = "anamnese" | "antropometria" | "resultados" | "necessidades" | "macros" | "plano";
type T = ReturnType<typeof useTranslations>;

interface ClientState {
  birthDate?: string;
  sex?: Sex;
  ethnicity?: Ethnicity;
  profession?: string;
  anamnesis: Anamnesis;
}

interface ConsultState {
  date: string;
  notes: string;
  measurements: Measurements;
  foodHistory: FoodHistory;
  energy: EnergyConfig;
  macros: MacroConfig;
}

interface Props {
  clientId: string;
  initialClient: ClientState;
  consultation: Consultation;
  previous?: Consultation;
  initialPlan: PlanDraft;
  planCtx: PlanEditorContext;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function ConsultationWorkspace({ clientId, initialClient, consultation, previous, initialPlan, planCtx }: Props) {
  const t = useTranslations("nutrition");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>("anamnese");

  const [client, setClient] = useState<ClientState>(initialClient);
  const [consult, setConsult] = useState<ConsultState>({
    date: consultation.date,
    notes: consultation.notes ?? "",
    measurements: consultation.measurements,
    foodHistory: consultation.foodHistory ?? {},
    energy: consultation.energy ?? {},
    macros: consultation.macros ?? DEFAULT_MACRO_CONFIG,
  });
  const [plan, setPlan] = useState<PlanDraft>(initialPlan);

  const patchConsult = useCallback((p: Partial<ConsultState>) => setConsult((c) => ({ ...c, ...p })), []);
  const setMeas = useCallback((fn: (m: Measurements) => Measurements) => setConsult((c) => ({ ...c, measurements: fn(c.measurements) })), []);

  // --- persistence ------------------------------------------------------------
  const snapshot = useMemo(() => ({ client, consult, plan }), [client, consult, plan]);
  const { state, savedAt, saveNow } = useAutosave(snapshot, async (s) => {
    await saveWorkspaceAction(locale, {
      clientId,
      client: s.client,
      consultationId: consultation.id,
      consultation: s.consult,
      planId: planCtx.planId,
      plan: s.plan,
    });
  });

  // --- derived: anthropometry ---------------------------------------------------
  const meas = consult.measurements;
  const age = ageFromBirth(client.birthDate, consult.date);
  const heightCm = heightCmOf(meas);
  const bmi = computeBmi(meas);

  // --- derived: body composition -------------------------------------------------
  const bodyInput = {
    sex: client.sex,
    ethnicity: client.ethnicity,
    ageYears: age,
    weightKg: meas.weightKg,
    heightCm,
    bmi,
    skinfolds: meas.skinfolds,
    perimeters: meas.perimeters,
  };
  const fat = bodyFatPercent(bodyInput);
  const muscle = muscleMassKg(bodyInput);

  // --- derived: energy -------------------------------------------------------------
  const fatPct = bodyFatOf(meas) ?? fat.average;
  const ffm =
    meas.leanMassKg ?? (meas.weightKg && fatPct != null ? r1(meas.weightKg * (1 - fatPct / 100)) : undefined);
  const energyInput = { sex: client.sex, weightKg: meas.weightKg, heightCm, ageYears: age, fatFreeMassKg: ffm };
  const suggestedKey = suggestGebFormula({ sex: client.sex, ageYears: age, athlete: client.anamnesis.isAthlete });
  const gebKey = consult.energy.gebFormula ?? suggestedKey;
  const gebValue = computeGeb(gebKey, energyInput);
  const pal = consult.energy.pal ?? DEFAULT_PAL;
  const getValue = computeGet(gebValue, pal, consult.energy.stressFactor ?? 1);
  const targetKcal = consult.energy.targetKcal ?? getValue;

  // --- derived: macros -------------------------------------------------------------
  const macroResult = targetKcal ? macroSplit(targetKcal, consult.macros, meas.weightKg) : undefined;
  const target =
    targetKcal && macroResult
      ? { kcal: targetKcal, protein: macroResult.protein.grams, carbs: macroResult.carbs.grams, fat: macroResult.fat.grams }
      : undefined;

  const tabs: { value: Tab; label: string; icon: React.ReactNode }[] = [
    { value: "anamnese", label: t("tabs.anamnese"), icon: <ClipboardList /> },
    { value: "antropometria", label: t("tabs.antropometria"), icon: <Ruler /> },
    { value: "resultados", label: t("tabs.resultados"), icon: <Calculator /> },
    { value: "necessidades", label: t("tabs.necessidades"), icon: <Flame /> },
    { value: "macros", label: t("tabs.macros"), icon: <PieChart /> },
    { value: "plano", label: t("tabs.plano"), icon: <Utensils /> },
  ];

  return (
    <div>
      <div className="sticky top-16 z-20 -mx-4 mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <Segmented value={tab} onChange={setTab} items={tabs} />
        <div className="flex items-center gap-3">
          <SaveIndicator state={state} savedAt={savedAt} locale={locale} />
          <Button onClick={() => void saveNow()} loading={state === "saving"} variant={state === "dirty" || state === "error" ? "default" : "outline"} size="sm">
            {state === "saved" ? <Check /> : <Save />} {state === "saved" ? tc("saved") : tc("save")}
          </Button>
        </div>
      </div>

      {tab === "anamnese" && (
        <AnamneseTab
          t={t}
          client={client}
          setClient={setClient}
          consult={consult}
          patchConsult={patchConsult}
          isFirst={(consultation.consultationNumber ?? 1) <= 1}
          age={age}
        />
      )}
      {tab === "antropometria" && (
        <AntropometriaTab t={t} meas={meas} setMeas={setMeas} previous={previous} locale={locale} consultNumber={consultation.consultationNumber ?? 1} />
      )}
      {tab === "resultados" && (
        <ResultadosTab
          t={t}
          locale={locale}
          fat={fat}
          muscle={muscle}
          meas={meas}
          sex={client.sex}
          bmi={bmi}
          missing={[!client.sex && t("sex"), age == null && t("birthDate"), !meas.weightKg && t("weightKg"), !heightCm && t("heightCm")].filter(Boolean) as string[]}
          onApply={(p) => setMeas((m) => ({ ...m, ...p }))}
        />
      )}
      {tab === "necessidades" && (
        <NecessidadesTab
          t={t}
          locale={locale}
          energy={consult.energy}
          setEnergy={(energy) => patchConsult({ energy })}
          gebKey={gebKey}
          suggestedKey={suggestedKey}
          input={energyInput}
          gebValue={gebValue}
          getValue={getValue}
          pal={pal}
          targetKcal={targetKcal}
        />
      )}
      {tab === "macros" && (
        <MacrosTab t={t} cfg={consult.macros} setCfg={(macros) => patchConsult({ macros })} targetKcal={targetKcal} result={macroResult} weightKg={meas.weightKg} />
      )}
      {tab === "plano" && (
        <PlanEditor draft={plan} update={(fn) => setPlan(fn)} ctx={planCtx} target={target} ensureSaved={saveNow} />
      )}
    </div>
  );
}

function SaveIndicator({ state, savedAt, locale }: { state: SaveState; savedAt: Date | null; locale: string }) {
  const t = useTranslations("common");
  const content = {
    saving: [<Loader2 key="i" className="size-3.5 animate-spin" />, t("saving")],
    dirty: [<Cloud key="i" className="size-3.5" />, t("unsaved")],
    error: [<AlertCircle key="i" className="size-3.5 text-destructive" />, t("saveFailed")],
    saved: [
      <Check key="i" className="size-3.5 text-brand" />,
      savedAt ? t("savedAt", { time: savedAt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) }) : t("allSaved"),
    ],
  }[state];
  return (
    <span aria-live="polite" className={cn("hidden items-center gap-1.5 text-xs sm:flex", state === "error" ? "text-destructive" : "text-muted-foreground")}>
      {content}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ANAMNESE (BOO-51 + BOO-52)
// ---------------------------------------------------------------------------
function AnamneseTab({
  t,
  client,
  setClient,
  consult,
  patchConsult,
  isFirst,
  age,
}: {
  t: T;
  client: ClientState;
  setClient: React.Dispatch<React.SetStateAction<ClientState>>;
  consult: ConsultState;
  patchConsult: (p: Partial<ConsultState>) => void;
  isFirst: boolean;
  age?: number;
}) {
  const a = client.anamnesis;
  const patchA = (p: Partial<Anamnesis>) => setClient((c) => ({ ...c, anamnesis: { ...c.anamnesis, ...p } }));
  const fh = consult.foodHistory;
  const setFh = (p: Partial<FoodHistory>) => patchConsult({ foodHistory: { ...fh, ...p } });
  const fhMeals = fh.meals ?? [];
  const defaultNames = t.raw("defaultMeals") as string[];
  const patchFhMeal = (id: string, p: Partial<FoodHistoryMeal>) =>
    setFh({ meals: fhMeals.map((m) => (m.id === id ? { ...m, ...p } : m)) });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("personalData")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("consultationDate")} htmlFor="c-date">
              <Input id="c-date" type="date" value={consult.date} onChange={(e) => e.target.value && patchConsult({ date: e.target.value })} />
            </Field>
            <Field label={t("birthDate")} htmlFor="c-birth" hint={age != null ? t("ageYears", { age }) : t("ageNeeded")}>
              <Input
                id="c-birth"
                type="date"
                value={client.birthDate ?? ""}
                max={consult.date}
                onChange={(e) => setClient((c) => ({ ...c, birthDate: e.target.value || undefined }))}
              />
            </Field>
            <Field label={t("sex")} htmlFor="c-sex">
              <Select id="c-sex" value={client.sex ?? ""} onChange={(e) => setClient((c) => ({ ...c, sex: (e.target.value || undefined) as Sex }))}>
                <option value="">—</option>
                <option value="female">{t("female")}</option>
                <option value="male">{t("male")}</option>
              </Select>
            </Field>
            <Field label={t("ethnicity")} htmlFor="c-eth">
              <Select
                id="c-eth"
                value={client.ethnicity ?? ""}
                onChange={(e) => setClient((c) => ({ ...c, ethnicity: (e.target.value || undefined) as Ethnicity }))}
              >
                <option value="">—</option>
                <option value="white">{t("ethnicities.white")}</option>
                <option value="black">{t("ethnicities.black")}</option>
                <option value="other">{t("ethnicities.other")}</option>
              </Select>
            </Field>
          </div>
          <Field label={t("profession")} htmlFor="c-prof">
            <Input id="c-prof" value={client.profession ?? ""} onChange={(e) => setClient((c) => ({ ...c, profession: e.target.value }))} />
          </Field>
          <TextArea label={t("reason")} value={a.reason ?? ""} onChange={(v) => patchA({ reason: v })} />
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-brand"
                checked={!!a.previousFollowUp}
                onChange={(e) => patchA({ previousFollowUp: e.target.checked })}
              />
              {t("previousFollowUp")}
            </label>
            {a.previousFollowUp && (
              <Input
                value={a.previousFollowUpDetail ?? ""}
                onChange={(e) => patchA({ previousFollowUpDetail: e.target.value })}
                placeholder={t("detail")}
              />
            )}
          </div>
          <Field label={t("allergies")} htmlFor="c-allergies">
            <Input id="c-allergies" value={a.allergies ?? ""} onChange={(e) => patchA({ allergies: e.target.value })} />
          </Field>
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <Field label={t("sport")} htmlFor="c-sport">
              <Input id="c-sport" value={a.sport ?? ""} onChange={(e) => patchA({ sport: e.target.value })} />
            </Field>
            <label className="flex h-9 items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-brand" checked={!!a.isAthlete} onChange={(e) => patchA({ isAthlete: e.target.checked })} />
              {t("isAthlete")}
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("observations")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(["dislikedFoods", "bowelFunction", "menstrualCycle", "medication", "sleepQuality", "stressLevel"] as const).map((k) => (
            <TextArea key={k} label={t(k)} value={a[k] ?? ""} onChange={(v) => patchA({ [k]: v })} />
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">{t("foodHistory")}</CardTitle>
          <p className="text-xs text-muted-foreground">{isFirst ? t("firstConsultDetailed") : t("followUpSimplified")}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {isFirst ? (
            <>
              {fhMeals.map((m) => (
                <div key={m.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_2fr_2fr_auto]">
                  <div className="space-y-1.5">
                    <Input value={m.name} onChange={(e) => patchFhMeal(m.id, { name: e.target.value })} placeholder={t("meal")} className="font-medium" aria-label={t("meal")} />
                    <Input value={m.timePlace ?? ""} onChange={(e) => patchFhMeal(m.id, { timePlace: e.target.value })} placeholder={t("timePlace")} className="h-8 text-xs" aria-label={t("timePlace")} />
                  </div>
                  <Textarea value={m.content ?? ""} onChange={(e) => patchFhMeal(m.id, { content: e.target.value })} placeholder={t("content")} rows={3} aria-label={t("content")} />
                  <Textarea value={m.advice ?? ""} onChange={(e) => patchFhMeal(m.id, { advice: e.target.value })} placeholder={t("advice")} rows={3} aria-label={t("advice")} />
                  <button
                    type="button"
                    onClick={() => setFh({ meals: fhMeals.filter((x) => x.id !== m.id) })}
                    className="self-start rounded p-1 text-muted-foreground hover:text-destructive"
                    aria-label={t("removeMeal")}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setFh({ meals: [...fhMeals, { id: newId("fh"), name: defaultNames[fhMeals.length] ?? "" }] })}>
                  <Plus /> {t("addMealBlock")}
                </Button>
                {fhMeals.length === 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setFh({ meals: defaultNames.map((name) => ({ id: newId("fh"), name })) })}>
                    {t("addStandardMeals")}
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <TextArea label={t("hydration")} value={fh.hydration ?? ""} onChange={(v) => setFh({ hydration: v })} />
                <TextArea label={t("adviceObservations")} value={fh.adviceObservations ?? ""} onChange={(v) => setFh({ adviceObservations: v })} />
                <TextArea label={t("draft")} value={fh.draft ?? ""} onChange={(v) => setFh({ draft: v })} />
              </div>
            </>
          ) : (
            <Textarea value={fh.followUpNote ?? ""} onChange={(e) => setFh({ followUpNote: e.target.value })} rows={8} placeholder={t("followUpNote")} aria-label={t("followUpNote")} />
          )}
          <TextArea label={t("consultationNotes")} value={consult.notes} onChange={(v) => patchConsult({ notes: v })} rows={3} />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ANTROPOMETRIA (BOO-53) — with the previous consultation's values alongside
// ---------------------------------------------------------------------------
type PerimeterKey = keyof Measurements["perimeters"];
type SkinfoldKey = keyof Measurements["skinfolds"];

const PERIMETERS: PerimeterKey[] = ["waist", "abdominal", "hip", "chest", "arm", "thigh", "calf"];
const SKINFOLDS: SkinfoldKey[] = ["tricipital", "subscapular", "bicipital", "iliocristal", "supraspinal", "abdominal", "geminal", "crural", "peitoral"];

function AntropometriaTab({
  t,
  meas,
  setMeas,
  previous,
  locale,
  consultNumber,
}: {
  t: T;
  meas: Measurements;
  setMeas: (fn: (m: Measurements) => Measurements) => void;
  previous?: Consultation;
  locale: string;
  consultNumber: number;
}) {
  const tc = useTranslations("consultation");
  const prev = previous?.measurements;
  const heightCm = heightCmOf(meas);
  const bmi = computeBmi(meas);

  const num = (label: string, value: number | undefined, prevValue: number | undefined, onChange: (v?: number) => void, unit?: string) => (
    <MeasureField key={label} label={label} value={value} prev={prevValue} onChange={onChange} locale={locale} unit={unit} />
  );

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        {t("consultationN", { n: consultNumber })}
        {previous ? ` · ${t("comparedWith", { date: formatDate(previous.date, locale) })}` : ""}
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("evaluation")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {num(t("weightKg"), meas.weightKg, prev?.weightKg, (v) => setMeas((m) => ({ ...m, weightKg: v })))}
          {num(t("heightCm"), heightCm, heightCmOf(prev), (v) => setMeas((m) => ({ ...m, heightCm: v, heightM: undefined })))}
          <ReadOnly label={tc("bmi")} value={bmi} locale={locale} hint={bmi ? t(`bmiClass.${bmiClass(bmi)}`) : undefined} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{tc("perimeters")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {PERIMETERS.map((k) =>
            num(tc(k === "abdominal" ? "abdominalPerimeter" : k === "chest" ? "chest" : k), meas.perimeters[k], prev?.perimeters[k], (v) =>
              setMeas((m) => ({ ...m, perimeters: { ...m.perimeters, [k]: v } })),
            ),
          )}
          <ReadOnly label={tc("sumPerimeters")} value={sumPerimeters(meas)} locale={locale} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{tc("skinfolds")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SKINFOLDS.map((k) =>
            num(tc(k === "abdominal" ? "abdominalSkinfold" : k), meas.skinfolds[k], prev?.skinfolds[k], (v) =>
              setMeas((m) => ({ ...m, skinfolds: { ...m.skinfolds, [k]: v } })),
            ),
          )}
          <ReadOnly label={tc("sumSkinfolds")} value={sumSkinfolds(meas)} locale={locale} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("bioimpedance")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {num(tc("bodyFat"), meas.bodyFatPct, prev?.bodyFatPct, (v) => setMeas((m) => ({ ...m, bodyFatPct: v })))}
          {num(t("leanMass"), meas.leanMassKg, prev?.leanMassKg, (v) => setMeas((m) => ({ ...m, leanMassKg: v })))}
          {num(t("waterPct"), meas.waterPct, prev?.waterPct, (v) => setMeas((m) => ({ ...m, waterPct: v })))}
          {num(t("visceralFat"), meas.visceralFat, prev?.visceralFat, (v) => setMeas((m) => ({ ...m, visceralFat: v })))}
        </CardContent>
      </Card>
    </div>
  );
}

function MeasureField({
  label,
  value,
  prev,
  onChange,
  locale,
  unit,
}: {
  label: string;
  value?: number;
  prev?: number;
  onChange: (v?: number) => void;
  locale: string;
  unit?: string;
}) {
  const delta = value != null && prev != null ? r1(value - prev) : undefined;
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <NumberInput value={value} onValueChange={onChange} min={0} aria-label={label} />
      {prev != null && (
        <p className="text-[11px] lining-nums tabular-nums text-muted-foreground">
          {formatNumber(prev, locale)}
          {unit}
          {delta != null && delta !== 0 && (
            <span className={cn("ml-1.5 font-medium", delta < 0 ? "text-brand-600" : "text-accent-700")}>
              {delta > 0 ? "+" : ""}
              {formatNumber(delta, locale)}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

function ReadOnly({ label, value, locale, hint, highlight }: { label: string; value?: number; locale: string; hint?: string; highlight?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div
        className={cn(
          "flex h-9 items-center rounded-md border px-3 text-sm font-semibold lining-nums tabular-nums",
          highlight ? "border-brand-100 bg-brand-50 text-brand-700" : "border-border bg-muted/50",
        )}
      >
        {value != null ? formatNumber(value, locale) : "—"}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RESULTADOS (BOO-54/60/61/62)
// ---------------------------------------------------------------------------
function ResultadosTab({
  t,
  locale,
  fat,
  muscle,
  meas,
  sex,
  bmi,
  missing,
  onApply,
}: {
  t: T;
  locale: string;
  fat: { results: FormulaResult[]; average?: number };
  muscle: { results: FormulaResult[]; average?: number };
  meas: Measurements;
  sex?: Sex;
  bmi?: number;
  missing: string[];
  onApply: (p: Partial<Measurements>) => void;
}) {
  const waist = meas.perimeters.waist;
  const hip = meas.perimeters.hip;
  const whr = waist && hip ? Math.round((waist / hip) * 100) / 100 : undefined;
  const whrRisk = whr != null && sex ? whr > (sex === "male" ? 0.9 : 0.85) : undefined;
  const fatPct = bodyFatOf(meas) ?? fat.average;
  const fatKg = meas.weightKg && fatPct != null ? r1((meas.weightKg * fatPct) / 100) : undefined;

  return (
    <div className="space-y-6">
      {missing.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-accent/25 bg-accent/5 px-4 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-accent" />
          {t("missingInputsList", { fields: missing.join(", ") })}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryTile label={t("bmiLabel")} value={bmi} locale={locale} hint={bmi ? t(`bmiClass.${bmiClass(bmi)}`) : undefined} />
        <SummaryTile
          label={t("whr")}
          value={whr}
          locale={locale}
          hint={whrRisk == null ? t("whrNeeds") : whrRisk ? t("whrRisk") : t("whrOk")}
          warn={whrRisk}
        />
        <SummaryTile label={t("fatMassKg")} value={fatKg} locale={locale} unit="kg" hint={fatPct != null ? `${formatNumber(fatPct, locale)}%` : undefined} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ResultsCard
          t={t}
          locale={locale}
          title={t("bodyFatTitle")}
          unit="%"
          data={fat}
          current={meas.results?.bodyFatPct}
          onUse={(v) => onApply({ results: { ...meas.results, bodyFatPct: v } })}
        />
        <ResultsCard t={t} locale={locale} title={t("muscleMassTitle")} unit="kg" data={muscle} current={meas.results?.muscleMassKg} onUse={(v) => onApply({ results: { ...meas.results, muscleMassKg: v } })} />
      </div>
    </div>
  );
}

function SummaryTile({ label, value, locale, unit, hint, warn }: { label: string; value?: number; locale: string; unit?: string; hint?: string; warn?: boolean }) {
  return (
    <div className="card-surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold lining-nums tabular-nums">
        {value != null ? formatNumber(value, locale, 2) : "—"}
        {value != null && unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
      </p>
      {hint && <p className={cn("mt-0.5 text-xs", warn ? "font-medium text-accent-700" : "text-muted-foreground")}>{hint}</p>}
    </div>
  );
}

function ResultsCard({
  t,
  locale,
  title,
  unit,
  data,
  note,
  current,
  onUse,
}: {
  t: T;
  locale: string;
  title: string;
  unit: string;
  data: { results: FormulaResult[]; average?: number };
  note?: string;
  current?: number;
  onUse: (v: number) => void;
}) {
  const fmt = (v?: number) => (v != null ? `${formatNumber(v, locale)} ${unit}` : "—");
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-lg">{title}</CardTitle>
        {note && <Badge>{note}</Badge>}
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-1.5 font-medium">{t("formula")}</th>
              <th className="py-1.5 text-right font-medium">{t("value")}</th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {data.results.map((r) => (
              <tr key={r.key} className="border-b border-border/50">
                <td className="py-2">{r.label}</td>
                <td className="py-2 text-right font-medium lining-nums tabular-nums">{fmt(r.value)}</td>
                <td className="py-2 text-right">
                  {r.value != null && (
                    <button type="button" onClick={() => onUse(r.value!)} className="text-xs text-brand-600 hover:underline">
                      {t("use")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            <tr className="bg-brand-50/70">
              <td className="rounded-l-md py-2 pl-2 font-semibold text-brand-700">{t("average")}</td>
              <td className="py-2 text-right font-semibold lining-nums tabular-nums text-brand-700">{fmt(data.average)}</td>
              <td className="rounded-r-md py-2 pr-2 text-right">
                {data.average != null && (
                  <button type="button" onClick={() => onUse(data.average!)} className="text-xs font-medium text-brand-700 hover:underline">
                    {t("use")}
                  </button>
                )}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted-foreground">
          {current != null ? t("currentRecorded", { value: fmt(current) }) : t("useHint")}
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// NECESSIDADES ENERGÉTICAS (BOO-55/63/64)
// ---------------------------------------------------------------------------
function NecessidadesTab({
  t,
  locale,
  energy,
  setEnergy,
  gebKey,
  suggestedKey,
  input,
  gebValue,
  getValue,
  pal,
  targetKcal,
}: {
  t: T;
  locale: string;
  energy: EnergyConfig;
  setEnergy: (e: EnergyConfig) => void;
  gebKey?: string;
  suggestedKey?: string;
  input: { sex?: Sex; weightKg?: number; heightCm?: number; ageYears?: number; fatFreeMassKg?: number };
  gebValue?: number;
  getValue?: number;
  pal: number;
  targetKcal?: number;
}) {
  const applicable = GEB_FORMULAS.filter((f) => isApplicable(f, input));
  const others = GEB_FORMULAS.filter((f) => !isApplicable(f, input));
  const label = (key: string, l: string) => `${l}${key === suggestedKey ? ` — ${t("suggested")}` : ""}`;
  const needsFfm = gebKey ? FFM_FORMULAS.has(gebKey) : false;
  const goals: Goal[] = ["loss", "maintain", "gain"];

  const inputs = [
    [t("weightKg"), input.weightKg],
    [t("heightCm"), input.heightCm],
    [t("ageLabel"), input.ageYears],
    [t("ffm"), input.fatFreeMassKg],
  ] as const;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("gebTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label={t("gebFormula")} htmlFor="geb-formula">
            <Select id="geb-formula" value={gebKey ?? ""} onChange={(e) => setEnergy({ ...energy, gebFormula: e.target.value })}>
              <optgroup label={t("applicable")}>
                {applicable.map((f) => (
                  <option key={f.key} value={f.key}>
                    {label(f.key, f.label)}
                  </option>
                ))}
              </optgroup>
              {others.length > 0 && (
                <optgroup label={t("otherFormulas")}>
                  {others.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
          </Field>
          <div className="grid grid-cols-4 gap-2 rounded-lg bg-muted/50 p-3 text-center">
            {inputs.map(([l, v]) => (
              <div key={l}>
                <p className="text-[10px] text-muted-foreground">{l}</p>
                <p className="text-sm font-medium lining-nums tabular-nums">{v != null ? formatNumber(v, locale) : "—"}</p>
              </div>
            ))}
          </div>
          {gebValue == null && (
            <p className="text-xs text-accent-700">{needsFfm ? t("needsFfm") : t("missingInputs")}</p>
          )}
          <ReadOnly label={t("gebKcal")} value={gebValue} locale={locale} highlight />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("getTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <Field label={t("pal")} htmlFor="pal">
              <Select id="pal" value={pal} onChange={(e) => setEnergy({ ...energy, pal: Number(e.target.value) })}>
                {PAL_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {t(`palOptions.${p.labelKey.split(".")[1]}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("stressFactor")} htmlFor="stress">
              <NumberInput
                id="stress"
                value={energy.stressFactor}
                onValueChange={(v) => setEnergy({ ...energy, stressFactor: v })}
                placeholder="1.0"
                min={0.5}
                max={3}
              />
            </Field>
          </div>
          <ReadOnly label={t("getKcal")} value={getValue} locale={locale} highlight />
          <div className="space-y-1.5">
            <Label htmlFor="target">{t("planTarget")}</Label>
            <div className="flex flex-wrap gap-2">
              <NumberInput
                id="target"
                value={energy.targetKcal}
                onValueChange={(v) => setEnergy({ ...energy, targetKcal: v })}
                placeholder={getValue ? String(getValue) : ""}
                className="w-32"
              />
              {goals.map((g) => (
                <Button
                  key={g}
                  variant="outline"
                  size="sm"
                  disabled={!getValue}
                  onClick={() => setEnergy({ ...energy, targetKcal: Math.round(getValue! * (1 + GOAL_ADJUSTMENT[g])) })}
                >
                  {t(`goalShortcut.${g}`)}
                </Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {energy.targetKcal != null ? t("targetManual") : t("targetFollowsGet")}
              {energy.targetKcal != null && (
                <button type="button" className="ml-2 text-brand-600 hover:underline" onClick={() => setEnergy({ ...energy, targetKcal: undefined })}>
                  {t("resetToGet")}
                </button>
              )}
            </p>
          </div>
          {targetKcal != null && (
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
              {t("targetSummary", { kcal: formatNumber(targetKcal, locale, 0) })}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DISTRIBUIÇÃO MACROS (BOO-56)
// ---------------------------------------------------------------------------
function MacrosTab({
  t,
  cfg,
  setCfg,
  targetKcal,
  result,
  weightKg,
}: {
  t: T;
  cfg: MacroConfig;
  setCfg: (m: MacroConfig) => void;
  targetKcal?: number;
  result?: MacroBreakdown;
  weightKg?: number;
}) {
  const pctSum = cfg.proteinPct + cfg.carbsPct + cfg.fatPct;
  const rows = [
    { key: "proteinPct", label: t("protein"), res: result?.protein, color: "bg-brand" },
    { key: "carbsPct", label: t("carbs"), res: result?.carbs, color: "bg-brand-200" },
    { key: "fatPct", label: t("fat"), res: result?.fat, color: "bg-accent" },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("macroDistribution")}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("planTarget")}: <span className="font-semibold text-foreground">{targetKcal ?? "—"} kcal</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
          {rows.map((r) => (
            <div key={r.key} className={cn("h-full transition-all", r.color)} style={{ width: `${Math.max(0, (cfg[r.key] / Math.max(pctSum, 100)) * 100)}%` }} />
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium">{t("macronutrient")}</th>
                <th className="py-2 text-right font-medium">{t("vetPct")}</th>
                <th className="py-2 text-right font-medium">kcal</th>
                <th className="py-2 text-right font-medium">{t("grams")}</th>
                <th className="py-2 text-right font-medium">{t("gramsPerKg")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-border/50 last:border-0">
                  <td className="py-2">
                    <span className="flex items-center gap-2">
                      <span className={cn("size-2.5 rounded-full", row.color)} />
                      {row.label}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <NumberInput
                      value={cfg[row.key]}
                      onValueChange={(v) => setCfg({ ...cfg, [row.key]: v ?? 0 })}
                      min={0}
                      max={100}
                      className="ml-auto h-8 w-16 text-right"
                      aria-label={`${row.label} %`}
                    />
                  </td>
                  <td className="py-2 text-right lining-nums tabular-nums">{row.res ? row.res.kcal : "—"}</td>
                  <td className="py-2 text-right font-medium lining-nums tabular-nums">{row.res ? `${row.res.grams} g` : "—"}</td>
                  <td className="py-2 text-right lining-nums tabular-nums text-muted-foreground">
                    {row.res?.gPerKg ?? (weightKg ? "—" : t("needsWeight"))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={cn("text-sm", pctSum === 100 ? "text-muted-foreground" : "font-medium text-destructive")}>
            {pctSum === 100 ? t("sumOk") : t("sumWarning", { sum: pctSum })}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setCfg(DEFAULT_MACRO_CONFIG)}>
            {t("resetMacros")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// --- shared field helper ----------------------------------------------------
function TextArea({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  const id = `ta-${label.replace(/\W+/g, "-")}`;
  return (
    <Field label={label} htmlFor={id}>
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} />
    </Field>
  );
}
