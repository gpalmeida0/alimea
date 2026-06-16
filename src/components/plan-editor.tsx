"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Plus,
  Trash2,
  Download,
  Save,
  Loader2,
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  LayoutTemplate,
  Wand2,
  X,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea, Label } from "@/components/ui/input";
import { duplicateCurrentPlanAction, saveAsTemplateAction, savePlanAction } from "@/app/actions";
import { EnergyCalculator } from "@/components/energy-calculator";
import { FoodPicker } from "@/components/food-picker";
import { optionTotals, planTotals, roundTotals, hasItems } from "@/lib/nutrition/items";
import { cn } from "@/lib/utils";
import type {
  Consultation,
  DbFood,
  FoodItem,
  Meal,
  Measurements,
  PlanLanguage,
  Recipe,
  RecommendationCategory,
} from "@/lib/types";

interface RecLite {
  id: string;
  title: string;
  category: RecommendationCategory;
  content: { "pt-PT": string; en: string };
}

interface TemplateLite {
  id: string;
  name: string;
  meals: Meal[];
  supplementation: string;
  notes: string;
}

interface Props {
  planId: string;
  clientId: string;
  clientName: string;
  templates: TemplateLite[];
  initialMeals: Meal[];
  initialLanguage: PlanLanguage;
  initialSupplementation: string;
  initialNotes: string;
  initialQuote: string;
  initialNextAppointment: string;
  initialPdfTemplateId: string;
  pdfTemplates: { id: string; name: string }[];
  clientAge?: number;
  consultation?: Consultation;
  recommendations: RecLite[];
  suggestions: string[];
  prefilled: boolean;
  /** Database foods + recipes available in the food picker (BOO-66). */
  dbFoods?: DbFood[];
  recipes?: Recipe[];
  /** Plan calorie/macro target from the consultation's Macros tab (BOO-65). */
  targetOverride?: { kcal: number; protein: number; carbs: number; fat: number };
  /** When embedded in the consultation workspace, the workspace owns the
   *  consultation clinical data, so the plan editor must not edit/save it. */
  hideConsultation?: boolean;
}

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function PlanEditor(props: Props) {
  const t = useTranslations("plan");
  const tc = useTranslations("consultation");
  const tcom = useTranslations("common");
  const tai = useTranslations("ai");
  const locale = useLocale();

  const [meals, setMeals] = useState<Meal[]>(props.initialMeals);
  const [language, setLanguage] = useState<PlanLanguage>(props.initialLanguage);
  const [supplementation, setSupplementation] = useState(props.initialSupplementation);
  const [notes, setNotes] = useState(props.initialNotes);
  const [quote, setQuote] = useState(props.initialQuote);
  const [nextAppt, setNextAppt] = useState(props.initialNextAppointment);
  const [pdfTemplateId, setPdfTemplateId] = useState(props.initialPdfTemplateId);
  const [meas, setMeas] = useState<Measurements>(
    props.consultation?.measurements ?? { perimeters: {}, skinfolds: {} },
  );
  const [consultNotes, setConsultNotes] = useState(props.consultation?.notes ?? "");
  const [consultDate, setConsultDate] = useState(props.consultation?.date ?? "");

  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [improving, setImproving] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [pickerFor, setPickerFor] = useState<{ mealId: string; optId: string } | null>(null);
  const [nutritionTarget, setNutritionTarget] = useState<
    { kcal: number; protein: number; carbs: number; fat: number } | undefined
  >(undefined);

  // A recommendation is "selected" whenever its text is present in the plan's
  // notes/supplementation. Deriving it (instead of separate state) keeps the
  // selection correct after applying a template, translating, or manual edits.
  const selectedRecs = useMemo(() => {
    const text = `${notes}\n${supplementation}`;
    return new Set(
      props.recommendations
        .filter((r) => {
          const t = r.content[language] || r.content["pt-PT"];
          return t.trim() !== "" && text.includes(t.trim());
        })
        .map((r) => r.id),
    );
  }, [notes, supplementation, language, props.recommendations]);

  async function ai(task: "translate" | "improve", text: string): Promise<string> {
    if (!text.trim()) return text;
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, text, targetLanguage: language }),
      });
      const data = (await res.json()) as { result?: string };
      return data.result ?? text;
    } catch {
      return text;
    }
  }

  async function translateAll() {
    setTranslating(true);
    try {
      const translated = await Promise.all(
        meals.map(async (m) => ({
          ...m,
          name: await ai("translate", m.name),
          options: await Promise.all(
            m.options.map(async (o) => ({ ...o, content: await ai("translate", o.content) })),
          ),
        })),
      );
      setMeals(translated);
      setSupplementation(await ai("translate", supplementation));
      setNotes(await ai("translate", notes));
    } finally {
      setTranslating(false);
    }
  }

  function payload() {
    return {
      meals,
      language,
      pdfTemplateId,
      supplementation,
      notes,
      motivationalQuote: quote,
      nextAppointment: nextAppt,
      consultation:
        props.consultation && !props.hideConsultation
          ? { id: props.consultation.id, date: consultDate, notes: consultNotes, measurements: meas }
          : undefined,
    };
  }

  async function save() {
    setSaved(false);
    await savePlanAction(locale, props.planId, payload());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function generate() {
    setGenerating(true);
    await savePlanAction(locale, props.planId, payload());
    window.open(`/api/pdf/${props.planId}?lang=${language}`, "_blank");
    setGenerating(false);
  }

  // --- meal helpers ---
  const addMeal = () =>
    setMeals((m) => [...m, { id: uid(), name: "", options: [{ id: uid(), content: "" }] }]);
  const removeMeal = (id: string) => setMeals((m) => m.filter((x) => x.id !== id));
  const patchMeal = (id: string, patch: Partial<Meal>) =>
    setMeals((m) => m.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const addOption = (mealId: string) =>
    setMeals((m) =>
      m.map((x) =>
        x.id === mealId ? { ...x, options: [...x.options, { id: uid(), content: "" }] } : x,
      ),
    );
  const removeOption = (mealId: string, optId: string) =>
    setMeals((m) =>
      m.map((x) =>
        x.id === mealId ? { ...x, options: x.options.filter((o) => o.id !== optId) } : x,
      ),
    );
  const patchOption = (mealId: string, optId: string, content: string) =>
    setMeals((m) =>
      m.map((x) =>
        x.id === mealId
          ? { ...x, options: x.options.map((o) => (o.id === optId ? { ...o, content } : o)) }
          : x,
      ),
    );
  const mutateOption = (
    mealId: string,
    optId: string,
    fn: (o: import("@/lib/types").MealOption) => import("@/lib/types").MealOption,
  ) =>
    setMeals((m) =>
      m.map((x) =>
        x.id === mealId
          ? { ...x, options: x.options.map((o) => (o.id === optId ? fn(o) : o)) }
          : x,
      ),
    );
  const addFoodItem = (mealId: string, optId: string, item: FoodItem) =>
    mutateOption(mealId, optId, (o) => ({ ...o, items: [...(o.items ?? []), item] }));
  const setItemQty = (mealId: string, optId: string, itemId: string, qtyG: number) =>
    mutateOption(mealId, optId, (o) => ({
      ...o,
      items: (o.items ?? []).map((it) => (it.id === itemId ? { ...it, qtyG } : it)),
    }));
  const removeFoodItem = (mealId: string, optId: string, itemId: string) =>
    mutateOption(mealId, optId, (o) => ({
      ...o,
      items: (o.items ?? []).filter((it) => it.id !== itemId),
    }));
  const moveMeal = (index: number, dir: -1 | 1) =>
    setMeals((m) => {
      const next = [...m];
      const target = index + dir;
      if (target < 0 || target >= next.length) return m;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const duplicateMeal = (index: number) =>
    setMeals((m) => {
      const src = m[index];
      const clone: Meal = {
        ...src,
        id: uid(),
        options: src.options.map((o) => ({ id: uid(), content: o.content })),
      };
      return [...m.slice(0, index + 1), clone, ...m.slice(index + 1)];
    });

  /** Load a reusable template's content into the editor (fresh ids). */
  function applyTemplate(tpl: TemplateLite) {
    const fresh = tpl.meals.map((mm) => ({
      ...mm,
      id: uid(),
      options: mm.options.map((o) => ({ id: uid(), content: o.content })),
    }));
    setMeals((prev) => [...prev.filter((p) => p.options.some((o) => o.content.trim())), ...fresh]);
    if (tpl.supplementation) setSupplementation((s) => (s ? `${s}\n${tpl.supplementation}` : tpl.supplementation));
    if (tpl.notes) setNotes((n) => (n ? `${n}\n${tpl.notes}` : tpl.notes));
  }

  async function improveField(
    value: string,
    setter: (v: string) => void,
    key: string,
  ) {
    if (!value.trim()) return;
    setImproving(key);
    try {
      setter(await ai("improve", value));
    } finally {
      setImproving(null);
    }
  }

  const recText = (rec: RecLite) => rec.content[language] || rec.content["pt-PT"];
  const removeLine = (block: string, text: string) => {
    const t = text.trim();
    return block
      .split("\n")
      .filter((line) => line.trim() !== t)
      .join("\n")
      .split(t)
      .join("") // strip any inline remnants
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  /** Toggle a reusable recommendation: select → insert text, deselect → remove it. */
  function toggleRecommendation(rec: RecLite) {
    const text = recText(rec);
    const setter = rec.category === "supplementation" ? setSupplementation : setNotes;
    if (selectedRecs.has(rec.id)) {
      setter((cur) => removeLine(cur, text));
    } else {
      setter((cur) => {
        if (cur.includes(text.trim())) return cur; // guard against double-insert
        return cur.trim() ? `${cur}\n${text}` : text;
      });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* LEFT: meals + clinical text */}
      <div className="space-y-6">
        {props.prefilled && (
          <div className="rounded-md border border-brand-100 bg-brand-50 px-4 py-2.5 text-sm text-brand-600">
            {tc("prefilledNotice")}
          </div>
        )}

        <datalist id="meal-suggestions">
          {props.suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold">{t("meals")}</h2>
            <div className="flex gap-2">
              {props.templates.length > 0 && (
                <div className="relative">
                  <Button variant="outline" size="sm" onClick={() => setShowTemplates((v) => !v)}>
                    <LayoutTemplate /> {t("useTemplate")}
                  </Button>
                  {showTemplates && (
                    <div className="absolute right-0 z-10 mt-1 w-64 rounded-md border border-border bg-card p-1 shadow-lg">
                      {props.templates.map((tpl) => (
                        <button
                          key={tpl.id}
                          onClick={() => {
                            applyTemplate(tpl);
                            setShowTemplates(false);
                          }}
                          className="w-full rounded px-2 py-2 text-left text-sm hover:bg-muted"
                        >
                          <p className="font-medium">{tpl.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {tpl.meals.length} {t("meals").toLowerCase()}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={addMeal}>
                <Plus /> {t("addMeal")}
              </Button>
            </div>
          </div>

          {meals.length === 0 && (
            <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {t("emptyMeals")}
            </p>
          )}

          {meals.map((meal, mealIndex) => (
            <Card key={meal.id}>
              <CardHeader className="flex-row flex-wrap items-center gap-1 pb-3">
                <div className="flex flex-col">
                  <button
                    onClick={() => moveMeal(mealIndex, -1)}
                    disabled={mealIndex === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="up"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    onClick={() => moveMeal(mealIndex, 1)}
                    disabled={mealIndex === meals.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="down"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </div>
                <Input
                  value={meal.name}
                  onChange={(e) => patchMeal(meal.id, { name: e.target.value })}
                  placeholder={t("addMealPlaceholder")}
                  className="h-9 min-w-[10rem] flex-1 border-0 bg-transparent px-0 font-serif text-lg font-semibold shadow-none focus-visible:ring-0"
                />
                <Input
                  type="time"
                  value={meal.time ?? ""}
                  onChange={(e) => patchMeal(meal.id, { time: e.target.value })}
                  aria-label={t("mealTime")}
                  className="h-8 w-28 text-sm"
                />
                <Button variant="ghost" size="icon" onClick={() => duplicateMeal(mealIndex)} title={tcom("duplicate")}>
                  <Copy className="text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => removeMeal(meal.id)}>
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {meal.options.map((opt, i) => {
                  const ot = roundTotals(optionTotals(opt));
                  return (
                    <div key={opt.id} className="space-y-1.5">
                      <div className="flex items-start gap-2">
                        <span className="mt-2 w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-brand">
                          {t("option", { n: i + 1 })}
                        </span>
                        <Textarea
                          value={opt.content}
                          onChange={(e) => patchOption(meal.id, opt.id, e.target.value)}
                          placeholder={t("optionPlaceholder")}
                          rows={opt.content.split("\n").length > 2 ? 4 : 2}
                          className="min-h-0 flex-1"
                        />
                        {meal.options.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOption(meal.id, opt.id)}
                          >
                            <Trash2 className="text-muted-foreground" />
                          </Button>
                        )}
                      </div>

                      {/* Structured food items → calorie/macro totals */}
                      <div className="ml-2 space-y-1 sm:ml-[4.5rem]">
                        {(opt.items ?? []).map((it) => {
                          const kcal = Math.round(it.qtyG * it.perG.kcal);
                          return (
                            <div key={it.id} className="flex items-center gap-2 text-xs">
                              <span className="flex-1 truncate">{it.name}</span>
                              <input
                                type="number"
                                value={it.qtyG}
                                min={0}
                                onChange={(e) =>
                                  setItemQty(meal.id, opt.id, it.id, Number(e.target.value) || 0)
                                }
                                className="h-7 w-16 rounded border border-input bg-card px-2 text-right"
                              />
                              <span className="text-muted-foreground">{it.unit ?? "g"}</span>
                              <span className="w-16 text-right font-medium">{kcal} kcal</span>
                              <button
                                onClick={() => removeFoodItem(meal.id, opt.id, it.id)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setPickerFor({ mealId: meal.id, optId: opt.id })}
                            className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
                          >
                            <Utensils className="size-3" /> {t("addFood")}
                          </button>
                          {ot.kcal > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {ot.kcal} kcal · P {ot.protein} · HC {ot.carbs} · G {ot.fat}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <Button variant="ghost" size="sm" onClick={() => addOption(meal.id)}>
                  <Plus /> {t("addOption")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Supplementation & notes */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{t("supplementation")}</Label>
              <ImproveButton
                label={tai("improve")}
                busy={improving === "supp"}
                onClick={() => improveField(supplementation, setSupplementation, "supp")}
              />
            </div>
            <Textarea
              value={supplementation}
              onChange={(e) => setSupplementation(e.target.value)}
              rows={4}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{t("notes")}</Label>
              <ImproveButton
                label={tai("improve")}
                busy={improving === "notes"}
                onClick={() => improveField(notes, setNotes, "notes")}
              />
            </div>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          </div>
        </section>
      </div>

      {/* RIGHT: sticky control panel */}
      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        {/* Language + actions */}
        <Card>
          <CardContent className="space-y-4 pt-5">
            <div className="space-y-1.5">
              <Label>{t("planLanguage")}</Label>
              <div className="inline-flex w-full rounded-md border border-border p-0.5">
                {(["pt-PT", "en"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLanguage(l)}
                    className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                      language === l ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {l === "en" ? "English" : "Português"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("pdfTemplate")}</Label>
              <select
                value={pdfTemplateId}
                onChange={(e) => setPdfTemplateId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
              >
                <option value="classic">{t("pdfTemplateClassic")}</option>
                {props.pdfTemplates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <Button className="w-full" onClick={generate} disabled={generating}>
              {generating ? <Loader2 className="animate-spin" /> : <Download />}
              {generating ? t("generating") : t("generate")}
            </Button>
            <Button variant="outline" className="w-full" onClick={save} disabled={pending}>
              {saved ? <Check /> : <Save />}
              {saved ? tcom("saved") : tcom("save")}
            </Button>
            <button
              onClick={translateAll}
              disabled={translating}
              className="flex w-full items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {translating ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3 text-accent" />}
              {tai("translate")} → {language === "en" ? "EN" : "PT"}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  startTransition(() =>
                    duplicateCurrentPlanAction(locale, props.planId, props.clientId),
                  )
                }
                disabled={pending}
                className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <Copy className="size-3" /> {t("duplicatePlan")}
              </button>
              <button
                onClick={() => {
                  const name = window.prompt(t("saveAsTemplate"));
                  if (name?.trim())
                    startTransition(() =>
                      saveAsTemplateAction(locale, {
                        name,
                        language,
                        meals,
                        supplementation,
                        notes,
                      }),
                    );
                }}
                disabled={pending}
                className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <LayoutTemplate className="size-3" /> {t("saveAsTemplate")}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Reusable recommendations */}
        <RecommendationPicker
          recommendations={props.recommendations}
          language={language}
          selected={selectedRecs}
          onToggle={toggleRecommendation}
          label={t("insertRecommendation")}
          hint={tai("disclaimer")}
        />

        {/* Energy needs + macros calculator */}
        <EnergyCalculator
          weightKg={meas.weightKg}
          heightCm={meas.heightM ? (meas.heightM < 3 ? meas.heightM * 100 : meas.heightM) : undefined}
          initialAge={props.clientAge}
          onResult={setNutritionTarget}
        />

        {/* Plan nutrition summary (representative day vs target) */}
        {hasItems(meals) && (
          <PlanNutritionSummary
            totals={roundTotals(planTotals(meals))}
            target={props.targetOverride ?? nutritionTarget}
          />
        )}

        {/* Plan meta */}
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="space-y-1.5">
              <Label>{t("motivationalQuote")}</Label>
              <Input value={quote} onChange={(e) => setQuote(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("nextAppointment")}</Label>
              <Input value={nextAppt} onChange={(e) => setNextAppt(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Measurements (consultation) */}
        {props.consultation && !props.hideConsultation && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{tc("title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>{tc("date")}</Label>
                <Input
                  type="date"
                  value={consultDate}
                  onChange={(e) => setConsultDate(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumField label={tc("weight")} value={meas.weightKg} onChange={(v) => setMeas((m) => ({ ...m, weightKg: v }))} />
                <NumField label={tc("height")} value={meas.heightM} onChange={(v) => setMeas((m) => ({ ...m, heightM: v }))} />
                <NumField label={tc("bodyFat")} value={meas.bodyFatPct} onChange={(v) => setMeas((m) => ({ ...m, bodyFatPct: v }))} />
                <NumField label={tc("muscleMass")} value={meas.muscleMassKg} onChange={(v) => setMeas((m) => ({ ...m, muscleMassKg: v }))} />
              </div>
              <p className="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {tc("perimeters")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["waist", "arm", "hip", "thigh", "calf"] as const).map((k) => (
                  <NumField
                    key={k}
                    label={tc(k)}
                    value={meas.perimeters[k]}
                    onChange={(v) =>
                      setMeas((m) => ({ ...m, perimeters: { ...m.perimeters, [k]: v } }))
                    }
                  />
                ))}
              </div>
              <div className="space-y-1.5">
                <Label>{tc("notesFromConsult")}</Label>
                <Textarea value={consultNotes} onChange={(e) => setConsultNotes(e.target.value)} rows={2} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {pickerFor && (
        <FoodPicker
          dbFoods={props.dbFoods}
          recipes={props.recipes}
          onPick={(item) => addFoodItem(pickerFor.mealId, pickerFor.optId, item)}
          onClose={() => setPickerFor(null)}
        />
      )}
    </div>
  );
}

function PlanNutritionSummary({
  totals,
  target,
}: {
  totals: { kcal: number; protein: number; carbs: number; fat: number };
  target?: { kcal: number; protein: number; carbs: number; fat: number };
}) {
  const t = useTranslations("plan");
  const row = (label: string, val: number, tgt: number | undefined, unit: string) => {
    const pct = tgt ? Math.min(100, Math.round((val / tgt) * 100)) : 0;
    return (
      <div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">
            {val}
            {tgt ? ` / ${tgt}` : ""} {unit}
          </span>
        </div>
        {tgt ? (
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", pct > 105 ? "bg-accent" : "bg-brand")}
              style={{ width: `${Math.min(100, (val / tgt) * 100)}%` }}
            />
          </div>
        ) : null}
      </div>
    );
  };
  return (
    <Card>
      <CardContent className="space-y-2.5 pt-5">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Utensils className="size-4 text-brand" /> {t("nutritionSummary")}
        </p>
        <p className="text-[11px] text-muted-foreground">{t("dayTotalHint")}</p>
        {row(t("energy"), totals.kcal, target?.kcal, "kcal")}
        {row(t("proteinShort"), totals.protein, target?.protein, "g")}
        {row(t("carbsShort"), totals.carbs, target?.carbs, "g")}
        {row(t("fatShort"), totals.fat, target?.fat, "g")}
      </CardContent>
    </Card>
  );
}

function ImproveButton({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
    >
      {busy ? <Loader2 className="size-3 animate-spin" /> : <Wand2 className="size-3 text-accent" />}
      {label}
    </button>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] normal-case">{label}</Label>
      <Input
        type="number"
        step="0.1"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className="h-8"
      />
    </div>
  );
}

function RecommendationPicker({
  recommendations,
  language,
  selected,
  onToggle,
  label,
  hint,
}: {
  recommendations: RecLite[];
  language: PlanLanguage;
  selected: Set<string>;
  onToggle: (r: RecLite) => void;
  label: string;
  hint: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <CardContent className="pt-5">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" /> {label}
            {selected.size > 0 && (
              <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold text-white">
                {selected.size}
              </span>
            )}
          </span>
          <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="mt-3 space-y-1.5">
            {recommendations.map((r) => {
              const isSel = selected.has(r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => onToggle(r)}
                  aria-pressed={isSel}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    isSel
                      ? "border-brand bg-brand-50"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                      isSel ? "border-brand bg-brand text-white" : "border-muted-foreground/40",
                    )}
                  >
                    {isSel && <Check className="size-3" />}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block font-medium", isSel && "text-brand-600")}>{r.title}</span>
                    <span className="line-clamp-1 block text-xs text-muted-foreground">
                      {r.content[language] || r.content["pt-PT"]}
                    </span>
                  </span>
                </button>
              );
            })}
            <p className="pt-1 text-xs italic text-muted-foreground">{hint}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
