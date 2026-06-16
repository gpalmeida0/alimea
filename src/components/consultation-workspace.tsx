"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Ruler,
  Calculator,
  Flame,
  PieChart,
  Utensils,
  Save,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PlanEditor } from "@/components/plan-editor";
import { saveConsultationAction } from "@/app/actions";
import { macros as macroSplit } from "@/lib/nutrition/calc";
import {
  bodyFatPercent,
  muscleMassKg,
  type BodyCompInput,
  type FormulaResult,
} from "@/lib/nutrition/body-composition";
import {
  GEB_FORMULAS,
  geb as computeGeb,
  get as computeGet,
  PAL_OPTIONS,
  DEFAULT_PAL,
  suggestGebFormula,
} from "@/lib/nutrition/energy";
import {
  DEFAULT_MACRO_CONFIG,
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

type Tab = "anamnese" | "antropometria" | "resultados" | "necessidades" | "macros" | "plano";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

const r1 = (v: number) => Math.round(v * 10) / 10;

interface Props {
  clientId: string;
  age?: number;
  initialClient: { sex?: Sex; ethnicity?: Ethnicity; profession?: string; anamnesis?: Anamnesis };
  consultation: Consultation;
  planEditorProps: Omit<React.ComponentProps<typeof PlanEditor>, "hideConsultation" | "targetOverride">;
}

const DEFAULT_MEAL_NAMES = ["Pequeno-almoço", "Merenda da manhã", "Almoço", "Merenda da tarde", "Jantar"];

export function ConsultationWorkspace({ clientId, age, initialClient, consultation, planEditorProps }: Props) {
  const t = useTranslations("nutrition");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("anamnese");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  // Client-level (anamnese) state
  const [sex, setSex] = useState<Sex | undefined>(initialClient.sex);
  const [ethnicity, setEthnicity] = useState<Ethnicity | undefined>(initialClient.ethnicity);
  const [profession, setProfession] = useState(initialClient.profession ?? "");
  const [anamnesis, setAnamnesis] = useState<Anamnesis>(initialClient.anamnesis ?? {});

  // Consultation-level state
  const [meas, setMeas] = useState<Measurements>(
    consultation.measurements ?? { perimeters: {}, skinfolds: {} },
  );
  const [foodHistory, setFoodHistory] = useState<FoodHistory>(consultation.foodHistory ?? {});
  const [energy, setEnergy] = useState<EnergyConfig>(consultation.energy ?? {});
  const [macroCfg, setMacroCfg] = useState<MacroConfig>(consultation.macros ?? DEFAULT_MACRO_CONFIG);

  const consultNumber = consultation.consultationNumber ?? 1;
  const isFirst = consultNumber <= 1;

  // --- derived antropometria ---
  const heightCm = meas.heightCm ?? (meas.heightM ? meas.heightM * 100 : undefined);
  const bmi =
    meas.weightKg && heightCm ? r1(meas.weightKg / Math.pow(heightCm / 100, 2)) : undefined;
  const sumPerimeters = useMemo(() => {
    const v = Object.values(meas.perimeters).filter((x): x is number => typeof x === "number");
    return v.length ? r1(v.reduce((a, b) => a + b, 0)) : undefined;
  }, [meas.perimeters]);
  const sumSkinfolds = useMemo(() => {
    const v = Object.values(meas.skinfolds).filter((x): x is number => typeof x === "number");
    return v.length ? r1(v.reduce((a, b) => a + b, 0)) : undefined;
  }, [meas.skinfolds]);

  // --- derived resultados ---
  const bodyCompInput: BodyCompInput = {
    sex,
    ethnicity,
    ageYears: age,
    weightKg: meas.weightKg,
    heightCm,
    bmi,
    skinfolds: meas.skinfolds,
    perimeters: meas.perimeters,
  };
  const fat = bodyFatPercent(bodyCompInput, { athlete: anamnesis.isAthlete });
  const muscle = muscleMassKg(bodyCompInput);

  // --- derived necessidades ---
  const gebFormulaKey = energy.gebFormula ?? suggestGebFormula({ sex, ageYears: age });
  const energyInput = {
    sex,
    weightKg: meas.weightKg,
    heightCm,
    ageYears: age,
    fatFreeMassKg:
      meas.weightKg && meas.bodyFatPct ? meas.weightKg * (1 - meas.bodyFatPct / 100) : meas.leanMassKg,
  };
  const gebValue = computeGeb(gebFormulaKey, energyInput);
  const pal = energy.pal ?? DEFAULT_PAL;
  const getValue = computeGet(gebValue, pal, energy.stressFactor ?? 1);
  const targetKcal = energy.targetKcal ?? getValue;

  // --- derived macros ---
  const macroResult = targetKcal
    ? macroSplit(targetKcal, macroCfg, meas.weightKg)
    : undefined;
  const pctSum = macroCfg.proteinPct + macroCfg.carbsPct + macroCfg.fatPct;
  const targetOverride = targetKcal && macroResult
    ? {
        kcal: targetKcal,
        protein: macroResult.protein.grams,
        carbs: macroResult.carbs.grams,
        fat: macroResult.fat.grams,
      }
    : undefined;

  function save() {
    setSaved(false);
    start(async () => {
      await saveConsultationAction(locale, {
        clientId,
        client: { sex, ethnicity, profession: profession || undefined, anamnesis },
        consultationId: consultation.id,
        consultation: {
          measurements: { ...meas, heightCm, heightM: heightCm ? heightCm / 100 : meas.heightM },
          foodHistory,
          energy: { ...energy, gebFormula: gebFormulaKey, pal, targetKcal },
          macros: macroCfg,
        },
      });
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    });
  }

  const tabs: { key: Tab; label: string; icon: typeof ClipboardList }[] = [
    { key: "anamnese", label: t("tabs.anamnese"), icon: ClipboardList },
    { key: "antropometria", label: t("tabs.antropometria"), icon: Ruler },
    { key: "resultados", label: t("tabs.resultados"), icon: Calculator },
    { key: "necessidades", label: t("tabs.necessidades"), icon: Flame },
    { key: "macros", label: t("tabs.macros"), icon: PieChart },
    { key: "plano", label: t("tabs.plano"), icon: Utensils },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap gap-0.5 rounded-md border border-border bg-card p-0.5">
          {tabs.map((tb) => {
            const Icon = tb.icon;
            return (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={cn(
                  "flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === tb.key ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" /> {tb.label}
              </button>
            );
          })}
        </div>
        {tab !== "plano" && (
          <Button onClick={save} disabled={pending}>
            {saved ? <Check /> : pending ? <Loader2 className="animate-spin" /> : <Save />}
            {saved ? tc("saved") : t("save")}
          </Button>
        )}
      </div>

      {tab === "anamnese" && (
        <AnamneseTab
          t={t}
          sex={sex}
          setSex={setSex}
          ethnicity={ethnicity}
          setEthnicity={setEthnicity}
          profession={profession}
          setProfession={setProfession}
          anamnesis={anamnesis}
          setAnamnesis={setAnamnesis}
          foodHistory={foodHistory}
          setFoodHistory={setFoodHistory}
          isFirst={isFirst}
        />
      )}
      {tab === "antropometria" && (
        <AntropometriaTab
          t={t}
          meas={meas}
          setMeas={setMeas}
          heightCm={heightCm}
          bmi={bmi}
          sumPerimeters={sumPerimeters}
          sumSkinfolds={sumSkinfolds}
          consultNumber={consultNumber}
        />
      )}
      {tab === "resultados" && (
        <ResultadosTab t={t} fat={fat} muscle={muscle} athlete={!!anamnesis.isAthlete} ready={!!(sex && meas.weightKg)} />
      )}
      {tab === "necessidades" && (
        <NecessidadesTab
          t={t}
          gebFormulaKey={gebFormulaKey}
          suggestedKey={suggestGebFormula({ sex, ageYears: age })}
          energy={energy}
          setEnergy={setEnergy}
          gebValue={gebValue}
          getValue={getValue}
          pal={pal}
        />
      )}
      {tab === "macros" && (
        <MacrosTab
          t={t}
          macroCfg={macroCfg}
          setMacroCfg={setMacroCfg}
          targetKcal={targetKcal}
          macroResult={macroResult}
          pctSum={pctSum}
        />
      )}
      {tab === "plano" && (
        <PlanEditor {...planEditorProps} hideConsultation targetOverride={targetOverride} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ANAMNESE (BOO-51 + BOO-52)
// ---------------------------------------------------------------------------
function AnamneseTab({
  t,
  sex,
  setSex,
  ethnicity,
  setEthnicity,
  profession,
  setProfession,
  anamnesis,
  setAnamnesis,
  foodHistory,
  setFoodHistory,
  isFirst,
}: {
  t: (k: string, v?: Record<string, string | number>) => string;
  sex?: Sex;
  setSex: (s: Sex) => void;
  ethnicity?: Ethnicity;
  setEthnicity: (e: Ethnicity) => void;
  profession: string;
  setProfession: (s: string) => void;
  anamnesis: Anamnesis;
  setAnamnesis: (a: Anamnesis) => void;
  foodHistory: FoodHistory;
  setFoodHistory: (f: FoodHistory) => void;
  isFirst: boolean;
}) {
  const patch = (p: Partial<Anamnesis>) => setAnamnesis({ ...anamnesis, ...p });
  const fhMeals = foodHistory.meals ?? [];
  const addMeal = () =>
    setFoodHistory({
      ...foodHistory,
      meals: [...fhMeals, { id: uid(), name: DEFAULT_MEAL_NAMES[fhMeals.length] ?? "" }],
    });
  const patchMeal = (id: string, p: Partial<FoodHistoryMeal>) =>
    setFoodHistory({ ...foodHistory, meals: fhMeals.map((m) => (m.id === id ? { ...m, ...p } : m)) });
  const removeMeal = (id: string) =>
    setFoodHistory({ ...foodHistory, meals: fhMeals.filter((m) => m.id !== id) });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("personalData")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("sex")}</Label>
              <select value={sex ?? ""} onChange={(e) => setSex(e.target.value as Sex)} className={selectCls}>
                <option value="">—</option>
                <option value="female">{t("female")}</option>
                <option value="male">{t("male")}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("ethnicity")}</Label>
              <select value={ethnicity ?? ""} onChange={(e) => setEthnicity(e.target.value as Ethnicity)} className={selectCls}>
                <option value="">—</option>
                <option value="white">{t("ethnicities.white")}</option>
                <option value="black">{t("ethnicities.black")}</option>
                <option value="other">{t("ethnicities.other")}</option>
              </select>
            </div>
          </div>
          <TextField label={t("profession")} value={profession} onChange={setProfession} />
          <TextArea label={t("reason")} value={anamnesis.reason ?? ""} onChange={(v) => patch({ reason: v })} />
          <div className="grid grid-cols-[auto_1fr] items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!anamnesis.previousFollowUp}
                onChange={(e) => patch({ previousFollowUp: e.target.checked })}
              />
              {t("previousFollowUp")}
            </label>
            <Input
              value={anamnesis.previousFollowUpDetail ?? ""}
              onChange={(e) => patch({ previousFollowUpDetail: e.target.value })}
              placeholder={t("detail")}
              className="h-9"
            />
          </div>
          <TextField label={t("allergies")} value={anamnesis.allergies ?? ""} onChange={(v) => patch({ allergies: v })} />
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <TextField label={t("sport")} value={anamnesis.sport ?? ""} onChange={(v) => patch({ sport: v })} />
            <label className="flex h-9 items-center gap-2 text-sm">
              <input type="checkbox" checked={!!anamnesis.isAthlete} onChange={(e) => patch({ isAthlete: e.target.checked })} />
              {t("isAthlete")}
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("observations")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <TextArea label={t("dislikedFoods")} value={anamnesis.dislikedFoods ?? ""} onChange={(v) => patch({ dislikedFoods: v })} />
          <TextArea label={t("bowelFunction")} value={anamnesis.bowelFunction ?? ""} onChange={(v) => patch({ bowelFunction: v })} />
          <TextArea label={t("menstrualCycle")} value={anamnesis.menstrualCycle ?? ""} onChange={(v) => patch({ menstrualCycle: v })} />
          <TextArea label={t("medication")} value={anamnesis.medication ?? ""} onChange={(v) => patch({ medication: v })} />
          <TextArea label={t("sleepQuality")} value={anamnesis.sleepQuality ?? ""} onChange={(v) => patch({ sleepQuality: v })} />
          <TextArea label={t("stressLevel")} value={anamnesis.stressLevel ?? ""} onChange={(v) => patch({ stressLevel: v })} />
        </CardContent>
      </Card>

      {/* Food history */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">{t("foodHistory")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{isFirst ? t("firstConsultDetailed") : t("followUpSimplified")}</p>
          {isFirst ? (
            <>
              {fhMeals.map((m) => (
                <div key={m.id} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_2fr_2fr_auto]">
                  <div className="space-y-1.5">
                    <Input value={m.name} onChange={(e) => patchMeal(m.id, { name: e.target.value })} placeholder={t("meal")} className="h-9 font-medium" />
                    <Input value={m.timePlace ?? ""} onChange={(e) => patchMeal(m.id, { timePlace: e.target.value })} placeholder={t("timePlace")} className="h-8 text-xs" />
                  </div>
                  <Textarea value={m.content ?? ""} onChange={(e) => patchMeal(m.id, { content: e.target.value })} placeholder={t("content")} rows={3} />
                  <Textarea value={m.advice ?? ""} onChange={(e) => patchMeal(m.id, { advice: e.target.value })} placeholder={t("advice")} rows={3} />
                  <button onClick={() => removeMeal(m.id)} className="self-start text-muted-foreground hover:text-destructive">✕</button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addMeal}>{t("addMealBlock")}</Button>
              <div className="grid gap-3 sm:grid-cols-3">
                <TextArea label={t("hydration")} value={foodHistory.hydration ?? ""} onChange={(v) => setFoodHistory({ ...foodHistory, hydration: v })} />
                <TextArea label={t("adviceObservations")} value={foodHistory.adviceObservations ?? ""} onChange={(v) => setFoodHistory({ ...foodHistory, adviceObservations: v })} />
                <TextArea label={t("draft")} value={foodHistory.draft ?? ""} onChange={(v) => setFoodHistory({ ...foodHistory, draft: v })} />
              </div>
            </>
          ) : (
            <Textarea
              value={foodHistory.followUpNote ?? ""}
              onChange={(e) => setFoodHistory({ ...foodHistory, followUpNote: e.target.value })}
              rows={8}
              placeholder={t("followUpNote")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ANTROPOMETRIA (BOO-53)
// ---------------------------------------------------------------------------
function AntropometriaTab({
  t,
  meas,
  setMeas,
  heightCm,
  bmi,
  sumPerimeters,
  sumSkinfolds,
  consultNumber,
}: {
  t: (k: string, v?: Record<string, string | number>) => string;
  meas: Measurements;
  setMeas: (m: Measurements) => void;
  heightCm?: number;
  bmi?: number;
  sumPerimeters?: number;
  sumSkinfolds?: number;
  consultNumber: number;
}) {
  const setP = (k: keyof Measurements["perimeters"], v?: number) =>
    setMeas({ ...meas, perimeters: { ...meas.perimeters, [k]: v } });
  const setS = (k: keyof Measurements["skinfolds"], v?: number) =>
    setMeas({ ...meas, skinfolds: { ...meas.skinfolds, [k]: v } });

  const perimeterKeys: { k: keyof Measurements["perimeters"]; label: string }[] = [
    { k: "waist", label: t("abdominalPerimeter") === "Abdominal" ? "Cintura" : "Waist" },
    { k: "abdominal", label: t("abdominalPerimeter") },
    { k: "arm", label: "Braço" },
    { k: "hip", label: "Anca" },
    { k: "thigh", label: "Coxa" },
    { k: "calf", label: "Geminal" },
    { k: "chest", label: t("chest") },
  ];
  const skinfoldKeys: { k: keyof Measurements["skinfolds"]; label: string }[] = [
    { k: "tricipital", label: "Tricipital" },
    { k: "subscapular", label: "Subescapular" },
    { k: "bicipital", label: "Bicipital" },
    { k: "iliocristal", label: "Iliocristal" },
    { k: "supraspinal", label: "Supraespinal" },
    { k: "abdominal", label: "Abdominal" },
    { k: "geminal", label: "Geminal" },
    { k: "crural", label: "Crural" },
    { k: "peitoral", label: t("peitoral") },
  ];

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        {t("consultationN", { n: consultNumber })} · {t("evolutionHint")}
      </p>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("evaluation")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <NumField label="Peso (kg)" value={meas.weightKg} onChange={(v) => setMeas({ ...meas, weightKg: v })} />
          <NumField label={t("heightCm")} value={heightCm} onChange={(v) => setMeas({ ...meas, heightCm: v, heightM: v ? v / 100 : undefined })} />
          <ReadOnly label="IMC" value={bmi} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Perímetros (cm)</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          {perimeterKeys.map((p) => (
            <NumField key={p.k} label={p.label} value={meas.perimeters[p.k]} onChange={(v) => setP(p.k, v)} />
          ))}
          <ReadOnly label={t("perimetersSum")} value={sumPerimeters} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Pregas cutâneas (mm)</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          {skinfoldKeys.map((p) => (
            <NumField key={p.k} label={p.label} value={meas.skinfolds[p.k]} onChange={(v) => setS(p.k, v)} />
          ))}
          <ReadOnly label={t("skinfoldsSum")} value={sumSkinfolds} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("bioimpedance")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <NumField label="% Massa gorda" value={meas.bodyFatPct} onChange={(v) => setMeas({ ...meas, bodyFatPct: v })} />
          <NumField label={t("leanMass")} value={meas.leanMassKg} onChange={(v) => setMeas({ ...meas, leanMassKg: v })} />
          <NumField label={t("waterPct")} value={meas.waterPct} onChange={(v) => setMeas({ ...meas, waterPct: v })} />
          <NumField label={t("visceralFat")} value={meas.visceralFat} onChange={(v) => setMeas({ ...meas, visceralFat: v })} />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RESULTADOS (BOO-54/60/61/62)
// ---------------------------------------------------------------------------
function ResultadosTab({
  t,
  fat,
  muscle,
  athlete,
  ready,
}: {
  t: (k: string, v?: Record<string, string | number>) => string;
  fat: { results: FormulaResult[]; average?: number };
  muscle: { results: FormulaResult[]; average?: number };
  athlete: boolean;
  ready: boolean;
}) {
  if (!ready) {
    return <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">{t("missingInputs")}</p>;
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ResultsCard title={t("bodyFatTitle")} unit="%" data={fat} t={t} note={athlete ? t("athleteFormulas") : undefined} />
      <ResultsCard title={t("muscleMassTitle")} unit="kg" data={muscle} t={t} />
    </div>
  );
}

function ResultsCard({
  title,
  unit,
  data,
  t,
  note,
}: {
  title: string;
  unit: string;
  data: { results: FormulaResult[]; average?: number };
  t: (k: string) => string;
  note?: string;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {note && <p className="mb-2 text-xs text-brand-600">{note}</p>}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-1.5 font-medium">{t("formula")}</th>
              <th className="py-1.5 text-right font-medium">{t("value")}</th>
            </tr>
          </thead>
          <tbody>
            {data.results.map((r) => (
              <tr key={r.key} className="border-b border-border/50 last:border-0">
                <td className="py-1.5">{r.label}</td>
                <td className="py-1.5 text-right font-medium">{r.value != null ? `${r.value} ${unit}` : "—"}</td>
              </tr>
            ))}
            <tr className="bg-brand-50/60">
              <td className="py-2 font-semibold text-brand-600">{t("average")}</td>
              <td className="py-2 text-right font-semibold text-brand-600">
                {data.average != null ? `${data.average} ${unit}` : "—"}
              </td>
            </tr>
          </tbody>
        </table>
        {data.average == null && <p className="mt-2 text-xs italic text-muted-foreground">{t("noData")}</p>}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// NECESSIDADES ENERGÉTICAS (BOO-55/63/64)
// ---------------------------------------------------------------------------
function NecessidadesTab({
  t,
  gebFormulaKey,
  suggestedKey,
  energy,
  setEnergy,
  gebValue,
  getValue,
  pal,
}: {
  t: (k: string, v?: Record<string, string | number>) => string;
  gebFormulaKey?: string;
  suggestedKey?: string;
  energy: EnergyConfig;
  setEnergy: (e: EnergyConfig) => void;
  gebValue?: number;
  getValue?: number;
  pal: number;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">{t("gebTitle")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("gebFormula")}</Label>
            <select
              value={gebFormulaKey ?? ""}
              onChange={(e) => setEnergy({ ...energy, gebFormula: e.target.value })}
              className={selectCls}
            >
              {GEB_FORMULAS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                  {f.key === suggestedKey ? ` (${t("suggested")})` : ""}
                </option>
              ))}
            </select>
          </div>
          <ReadOnly label="GEB (kcal)" value={gebValue} highlight />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("getTitle")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("pal")}</Label>
            <select
              value={pal}
              onChange={(e) => setEnergy({ ...energy, pal: Number(e.target.value) })}
              className={selectCls}
            >
              {PAL_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {t(p.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <ReadOnly label="GET (kcal)" value={getValue} highlight />
          <div className="space-y-1.5">
            <Label>{t("planTarget")}</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={energy.targetKcal ?? ""}
                onChange={(e) => setEnergy({ ...energy, targetKcal: e.target.value === "" ? undefined : Number(e.target.value) })}
                placeholder={getValue ? String(getValue) : ""}
                className="h-9"
              />
              <Button variant="outline" size="sm" disabled={!getValue} onClick={() => setEnergy({ ...energy, targetKcal: getValue })}>
                {t("useGet")}
              </Button>
            </div>
          </div>
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
  macroCfg,
  setMacroCfg,
  targetKcal,
  macroResult,
  pctSum,
}: {
  t: (k: string, v?: Record<string, string | number>) => string;
  macroCfg: MacroConfig;
  setMacroCfg: (m: MacroConfig) => void;
  targetKcal?: number;
  macroResult?: ReturnType<typeof macroSplit>;
  pctSum: number;
}) {
  const rows: { key: keyof MacroConfig; label: string; res?: { kcal: number; grams: number; gPerKg?: number } }[] = [
    { key: "proteinPct", label: t("protein"), res: macroResult?.protein },
    { key: "carbsPct", label: t("carbs"), res: macroResult?.carbs },
    { key: "fatPct", label: t("fat"), res: macroResult?.fat },
  ];
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t("macroDistribution")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {t("planTarget")}: <span className="font-semibold text-foreground">{targetKcal ?? "—"} kcal</span>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 font-medium">{t("macronutrient")}</th>
                <th className="py-1.5 text-right font-medium">{t("vetPct")}</th>
                <th className="py-1.5 text-right font-medium">{t("kcal")}</th>
                <th className="py-1.5 text-right font-medium">{t("grams")}</th>
                <th className="py-1.5 text-right font-medium">{t("gramsPerKg")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5">{row.label}</td>
                  <td className="py-1.5 text-right">
                    <input
                      type="number"
                      value={macroCfg[row.key]}
                      onChange={(e) => setMacroCfg({ ...macroCfg, [row.key]: Number(e.target.value) || 0 })}
                      className="h-8 w-16 rounded border border-input bg-card px-2 text-right"
                    />
                  </td>
                  <td className="py-1.5 text-right">{row.res ? Math.round(row.res.kcal) : "—"}</td>
                  <td className="py-1.5 text-right font-medium">{row.res ? row.res.grams : "—"}</td>
                  <td className="py-1.5 text-right text-muted-foreground">{row.res?.gPerKg ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pctSum !== 100 && <p className="text-sm text-destructive">{t("sumWarning", { sum: pctSum })}</p>}
      </CardContent>
    </Card>
  );
}

// --- shared field helpers ---------------------------------------------------
const selectCls = "flex h-9 w-full rounded-md border border-input bg-card px-2 text-sm";

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9" />
    </div>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} />
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] normal-case">{label}</Label>
      <Input
        type="number"
        step="0.1"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className="h-9"
      />
    </div>
  );
}

function ReadOnly({ label, value, highlight }: { label: string; value?: number; highlight?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] normal-case">{label}</Label>
      <div className={cn("flex h-9 items-center rounded-md border px-3 text-sm font-semibold", highlight ? "border-brand-100 bg-brand-50 text-brand-600" : "border-border bg-muted/40")}>
        {value ?? "—"}
      </div>
    </div>
  );
}
