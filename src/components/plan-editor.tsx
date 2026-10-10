"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  LayoutTemplate,
  Plus,
  Sparkles,
  Trash2,
  Utensils,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback";
import { Field, Input, Label, NumberInput, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/misc";
import { FoodPicker } from "@/components/food-picker";
import { useServerAction } from "@/hooks/use-server-action";
import { deletePlanAction, duplicateCurrentPlanAction, saveAsTemplateAction } from "@/app/actions";
import { cloneMeals, optionTotals, planTotals, roundTotals, hasItems, type Totals } from "@/lib/nutrition/items";
import { cn, newId } from "@/lib/utils";
import type { DbFood, FoodItem, Meal, MealOption, PlanLanguage, Recipe, RecommendationCategory } from "@/lib/types";

// ---------------------------------------------------------------------------
// Meal plan editor. Controlled: the parent owns the draft and persistence
// (standalone page or the consultation workspace), the editor only edits.
// ---------------------------------------------------------------------------

export interface PlanDraft {
  meals: Meal[];
  language: PlanLanguage;
  pdfTemplateId: string;
  supplementation: string;
  notes: string;
  motivationalQuote: string;
  nextAppointment: string;
}

export interface RecLite {
  id: string;
  title: string;
  category: RecommendationCategory;
  content: { "pt-PT": string; en: string };
}

export interface TemplateLite {
  id: string;
  name: string;
  meals: Meal[];
  supplementation: string;
  notes: string;
}

export interface PlanEditorContext {
  planId: string;
  clientId: string;
  /** Plans attached to a consultation are deleted with the consultation. */
  standalone: boolean;
  templates: TemplateLite[];
  recommendations: RecLite[];
  suggestions: string[];
  pdfTemplates: { id: string; name: string }[];
  dbFoods: DbFood[];
  recipes: Recipe[];
}

type Updater = (d: PlanDraft) => PlanDraft;

const STANDARD_DAY: Record<PlanLanguage, string[]> = {
  "pt-PT": ["Pequeno-almoço", "Merenda da manhã", "Almoço", "Merenda da tarde", "Jantar"],
  en: ["Breakfast", "Morning snack", "Lunch", "Afternoon snack", "Dinner"],
};

const blankOption = (): MealOption => ({ id: newId("opt"), content: "" });
const blankMeal = (name = ""): Meal => ({ id: newId("meal"), name, options: [blankOption()] });

export function PlanEditor({
  draft,
  update,
  ctx,
  target,
  ensureSaved,
  aside,
}: {
  draft: PlanDraft;
  update: (fn: Updater) => void;
  ctx: PlanEditorContext;
  /** Daily calorie/macro target (from the consultation's energy/macros tabs). */
  target?: Totals;
  /** Persist pending changes; resolves false if saving failed. */
  ensureSaved: () => Promise<boolean>;
  /** Extra sidebar content (e.g. the standalone energy calculator). */
  aside?: React.ReactNode;
}) {
  const t = useTranslations("plan");
  const tcom = useTranslations("common");
  const tai = useTranslations("ai");
  const locale = useLocale();
  const { toast, confirm } = useFeedback();
  const { run, pending } = useServerAction();

  const [picker, setPicker] = useState<{ mealId: string; optId: string } | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [templateDialog, setTemplateDialog] = useState<"apply" | "save" | null>(null);

  const set = <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) => update((d) => ({ ...d, [key]: value }));
  const setMeals = (fn: (meals: Meal[]) => Meal[]) => update((d) => ({ ...d, meals: fn(d.meals) }));
  const patchMeal = (id: string, patch: Partial<Meal>) =>
    setMeals((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const patchOption = (mealId: string, optId: string, fn: (o: MealOption) => MealOption) =>
    setMeals((ms) =>
      ms.map((m) => (m.id === mealId ? { ...m, options: m.options.map((o) => (o.id === optId ? fn(o) : o)) } : m)),
    );

  const moveMeal = (index: number, dir: -1 | 1) =>
    setMeals((ms) => {
      const j = index + dir;
      if (j < 0 || j >= ms.length) return ms;
      const next = [...ms];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

  async function removeMeal(meal: Meal) {
    const hasContent = meal.options.some((o) => o.content.trim() || o.items?.length);
    if (hasContent && !(await confirm({ title: t("removeMealTitle", { name: meal.name || "—" }), destructive: true }))) return;
    setMeals((ms) => ms.filter((m) => m.id !== meal.id));
  }

  // --- Recommendations: selected ⇔ its text is present in notes/supplementation.
  const recText = (r: RecLite) => (r.content[draft.language] || r.content["pt-PT"]).trim();
  const selectedRecs = useMemo(() => {
    const text = `${draft.notes}\n${draft.supplementation}`;
    return new Set(ctx.recommendations.filter((r) => recText(r) && text.includes(recText(r))).map((r) => r.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.notes, draft.supplementation, draft.language, ctx.recommendations]);

  function toggleRecommendation(rec: RecLite) {
    const text = recText(rec);
    const key = rec.category === "supplementation" ? "supplementation" : "notes";
    update((d) => {
      const cur = d[key];
      const next = selectedRecs.has(rec.id)
        ? cur
            .split(text)
            .join("")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
        : cur.trim()
          ? `${cur.trimEnd()}\n${text}`
          : text;
      return { ...d, [key]: next };
    });
  }

  // --- Templates
  function applyTemplate(tpl: TemplateLite, mode: "append" | "replace") {
    update((d) => ({
      ...d,
      meals: [
        ...(mode === "replace" ? [] : d.meals.filter((m) => m.name.trim() || m.options.some((o) => o.content.trim() || o.items?.length))),
        ...cloneMeals(tpl.meals),
      ],
      supplementation: mode === "replace" ? tpl.supplementation : [d.supplementation.trim(), tpl.supplementation].filter(Boolean).join("\n"),
      notes: mode === "replace" ? tpl.notes : [d.notes.trim(), tpl.notes].filter(Boolean).join("\n"),
    }));
    setTemplateDialog(null);
    toast(t("templateApplied", { name: tpl.name }));
  }

  // --- AI (translate / improve) ---------------------------------------------
  async function ai(task: "translate" | "improve", text: string): Promise<string> {
    if (!text.trim()) return text;
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, text, targetLanguage: draft.language }),
    });
    const data = (await res.json().catch(() => ({}))) as { result?: string; configured?: boolean; error?: string };
    if (!res.ok) throw new Error(data.error ?? "AI error");
    if (data.configured === false) throw Object.assign(new Error("not-configured"), { notConfigured: true });
    return data.result ?? text;
  }

  async function withAi(key: string, fn: () => Promise<void>) {
    setAiBusy(key);
    try {
      await fn();
    } catch (e) {
      toast((e as { notConfigured?: boolean }).notConfigured ? tai("notConfigured") : tai("failed"), "error");
    } finally {
      setAiBusy(null);
    }
  }

  const translateAll = () =>
    withAi("translate", async () => {
      const snapshot = draft;
      const meals = await Promise.all(
        snapshot.meals.map(async (m) => ({
          ...m,
          name: await ai("translate", m.name),
          options: await Promise.all(m.options.map(async (o) => ({ ...o, content: await ai("translate", o.content) }))),
        })),
      );
      const [supplementation, notes, motivationalQuote] = await Promise.all([
        ai("translate", snapshot.supplementation),
        ai("translate", snapshot.notes),
        ai("translate", snapshot.motivationalQuote),
      ]);
      update((d) => ({ ...d, meals, supplementation, notes, motivationalQuote }));
      toast(tai("translated"));
    });

  const improve = (key: "supplementation" | "notes") =>
    withAi(key, async () => {
      const result = await ai("improve", draft[key]);
      set(key, result);
    });

  // --- PDF ----------------------------------------------------------------------
  const pdfUrl = (inline: boolean) => `/api/pdf/${ctx.planId}?lang=${draft.language}${inline ? "&inline=1" : ""}`;

  async function preview() {
    // Open the tab synchronously (popup blockers), then point it at the PDF once saved.
    const win = window.open("about:blank", "_blank");
    if (!(await ensureSaved())) {
      win?.close();
      toast(tcom("error"), "error");
      return;
    }
    if (win) win.location.href = pdfUrl(true);
    else window.location.href = pdfUrl(true);
  }

  async function download() {
    if (!(await ensureSaved())) return toast(tcom("error"), "error");
    const a = document.createElement("a");
    a.href = pdfUrl(false);
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const totals = useMemo(() => roundTotals(planTotals(draft.meals)), [draft.meals]);
  const showTotals = hasItems(draft.meals);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      {/* LEFT: meals + clinical text */}
      <div className="min-w-0 space-y-5">
        <datalist id="meal-names">
          {STANDARD_DAY[draft.language].map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-2xl font-semibold">{t("meals")}</h2>
          <div className="flex flex-wrap gap-2">
            {ctx.templates.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setTemplateDialog("apply")}>
                <LayoutTemplate /> {t("useTemplate")}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setMeals((ms) => [...ms, blankMeal()])}>
              <Plus /> {t("addMeal")}
            </Button>
          </div>
        </div>

        {draft.meals.length === 0 && (
          <EmptyState
            icon={<Utensils />}
            title={t("emptyMeals")}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" onClick={() => setMeals(() => STANDARD_DAY[draft.language].map((n) => blankMeal(n)))}>
                  <Plus /> {t("standardDay")}
                </Button>
                {ctx.templates.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => setTemplateDialog("apply")}>
                    <LayoutTemplate /> {t("useTemplate")}
                  </Button>
                )}
              </div>
            }
          />
        )}

        {draft.meals.map((meal, i) => (
          <MealCard
            key={meal.id}
            meal={meal}
            index={i}
            count={draft.meals.length}
            suggestions={ctx.suggestions}
            onPatch={(p) => patchMeal(meal.id, p)}
            onOption={(optId, fn) => patchOption(meal.id, optId, fn)}
            onMove={(dir) => moveMeal(i, dir)}
            onDuplicate={() => setMeals((ms) => [...ms.slice(0, i + 1), ...cloneMeals([meal]), ...ms.slice(i + 1)])}
            onRemove={() => removeMeal(meal)}
            onAddFood={(optId) => setPicker({ mealId: meal.id, optId })}
          />
        ))}

        <div className="grid gap-4 sm:grid-cols-2">
          {(["supplementation", "notes"] as const).map((key) => (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor={`plan-${key}`}>{t(key)}</Label>
                <button
                  type="button"
                  onClick={() => improve(key)}
                  disabled={aiBusy !== null || !draft[key].trim()}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  <Wand2 className={cn("size-3 text-accent", aiBusy === key && "animate-pulse")} />
                  {tai("improve")}
                </button>
              </div>
              <Textarea id={`plan-${key}`} value={draft[key]} onChange={(e) => set(key, e.target.value)} rows={5} />
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: sticky control panel */}
      <div className="order-first grid gap-4 sm:grid-cols-2 xl:order-none xl:sticky xl:top-36 xl:block xl:max-h-[calc(100vh-10rem)] xl:space-y-4 xl:self-start xl:overflow-y-auto xl:pb-4 scroll-thin">
        <Card>
          <CardContent className="space-y-4 pt-5">
            <Field label={t("planLanguage")}>
              <Segmented
                value={draft.language}
                onChange={(v) => set("language", v)}
                items={[
                  { value: "pt-PT", label: "Português" },
                  { value: "en", label: "English" },
                ]}
                className="flex w-full [&>button]:flex-1 [&>button]:justify-center"
              />
            </Field>
            {ctx.pdfTemplates.length > 0 && (
              <Field label={t("pdfTemplate")} htmlFor="pdf-template">
                <Select id="pdf-template" value={draft.pdfTemplateId} onChange={(e) => set("pdfTemplateId", e.target.value)}>
                  <option value="classic">{t("pdfTemplateClassic")}</option>
                  {ctx.pdfTemplates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={download} className="col-span-2">
                <Download /> {t("generate")}
              </Button>
              <Button variant="outline" size="sm" onClick={preview}>
                <Eye /> {t("preview")}
              </Button>
              <Button variant="outline" size="sm" onClick={translateAll} loading={aiBusy === "translate"} disabled={aiBusy !== null}>
                <Sparkles className="text-accent" /> {tai("translateTo", { lang: draft.language === "en" ? "EN" : "PT" })}
              </Button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3 text-xs">
              <button
                type="button"
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
                disabled={pending}
                onClick={async () => {
                  if (await ensureSaved()) run(() => duplicateCurrentPlanAction(locale, ctx.planId, ctx.clientId));
                }}
              >
                <Copy className="size-3.5" /> {t("duplicatePlan")}
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => setTemplateDialog("save")}
              >
                <LayoutTemplate className="size-3.5" /> {t("saveAsTemplate")}
              </button>
              {ctx.standalone && (
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-destructive/80 hover:text-destructive"
                  onClick={async () => {
                    if (await confirm({ title: t("deletePlan"), body: t("deletePlanBody"), destructive: true })) {
                      run(() => deletePlanAction(locale, ctx.planId, ctx.clientId));
                    }
                  }}
                >
                  <Trash2 className="size-3.5" /> {t("deletePlan")}
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {(showTotals || target) && <NutritionSummary totals={totals} target={target} hasItems={showTotals} />}

        {aside}

        {ctx.recommendations.length > 0 && (
          <RecommendationPicker
            recommendations={ctx.recommendations}
            language={draft.language}
            selected={selectedRecs}
            onToggle={toggleRecommendation}
          />
        )}

        <Card>
          <CardContent className="space-y-3 pt-5">
            <Field label={t("motivationalQuote")} htmlFor="plan-quote">
              <Input id="plan-quote" value={draft.motivationalQuote} onChange={(e) => set("motivationalQuote", e.target.value)} />
            </Field>
            <Field label={t("nextAppointment")} htmlFor="plan-next" hint={t("nextAppointmentHint")}>
              <Input id="plan-next" value={draft.nextAppointment} onChange={(e) => set("nextAppointment", e.target.value)} />
            </Field>
          </CardContent>
        </Card>
      </div>

      {picker && (
        <FoodPicker
          dbFoods={ctx.dbFoods}
          recipes={ctx.recipes}
          onPick={(item: FoodItem) => patchOption(picker.mealId, picker.optId, (o) => ({ ...o, items: [...(o.items ?? []), item] }))}
          onClose={() => setPicker(null)}
        />
      )}

      {templateDialog === "apply" && (
        <ApplyTemplateDialog
          templates={ctx.templates}
          hasMeals={draft.meals.some((m) => m.name.trim() || m.options.some((o) => o.content.trim()))}
          onApply={applyTemplate}
          onClose={() => setTemplateDialog(null)}
        />
      )}
      {templateDialog === "save" && (
        <SaveTemplateDialog
          onClose={() => setTemplateDialog(null)}
          onSave={(name) =>
            run(
              () =>
                saveAsTemplateAction(locale, {
                  name,
                  language: draft.language,
                  meals: draft.meals,
                  supplementation: draft.supplementation,
                  notes: draft.notes,
                }),
              { success: t("templateSaved"), onDone: () => setTemplateDialog(null) },
            )
          }
          pending={pending}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One meal block
// ---------------------------------------------------------------------------
function MealCard({
  meal,
  index,
  count,
  suggestions,
  onPatch,
  onOption,
  onMove,
  onDuplicate,
  onRemove,
  onAddFood,
}: {
  meal: Meal;
  index: number;
  count: number;
  suggestions: string[];
  onPatch: (p: Partial<Meal>) => void;
  onOption: (optId: string, fn: (o: MealOption) => MealOption) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onAddFood: (optId: string) => void;
}) {
  const t = useTranslations("plan");
  const tcom = useTranslations("common");

  return (
    <Card>
      <div className="flex items-center gap-1 border-b border-border px-3 py-2 sm:px-4">
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="text-muted-foreground hover:text-foreground disabled:opacity-25"
            aria-label={t("moveUp")}
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            className="text-muted-foreground hover:text-foreground disabled:opacity-25"
            aria-label={t("moveDown")}
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
        <Input
          value={meal.name}
          list="meal-names"
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder={t("addMealPlaceholder")}
          aria-label={t("mealName")}
          className="h-9 min-w-0 flex-1 border-transparent bg-transparent px-1 font-serif text-xl font-semibold shadow-none hover:border-border focus-visible:border-ring"
        />
        <Input
          type="time"
          value={meal.time ?? ""}
          onChange={(e) => onPatch({ time: e.target.value || undefined })}
          aria-label={t("mealTime")}
          className="h-8 w-[5.75rem] shrink-0 px-2 text-sm"
        />
        <Button variant="ghost" size="icon-sm" onClick={onDuplicate} aria-label={tcom("duplicate")} title={tcom("duplicate")}>
          <Copy className="text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={tcom("delete")} title={tcom("delete")}>
          <Trash2 className="text-muted-foreground" />
        </Button>
      </div>
      <CardContent className="space-y-4 pt-4">
        {meal.options.map((opt, i) => {
          const ot = roundTotals(optionTotals(opt));
          return (
            <div key={opt.id} className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="mt-2 w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-brand">
                  {t("option", { n: i + 1 })}
                </span>
                <Textarea
                  value={opt.content}
                  onChange={(e) => onOption(opt.id, (o) => ({ ...o, content: e.target.value }))}
                  placeholder={t("optionPlaceholder")}
                  rows={Math.min(8, Math.max(2, opt.content.split("\n").length + 1))}
                  className="min-h-0 flex-1"
                  aria-label={t("option", { n: i + 1 })}
                />
                {meal.options.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onPatch({ options: meal.options.filter((o) => o.id !== opt.id) })}
                    aria-label={tcom("remove")}
                  >
                    <X className="text-muted-foreground" />
                  </Button>
                )}
              </div>

              {!opt.content.trim() && suggestions.length > 0 && (
                <div className="sm:ml-[4.5rem]">
                  <Select
                    value=""
                    onChange={(e) => e.target.value && onOption(opt.id, (o) => ({ ...o, content: e.target.value }))}
                    className="h-8 text-xs text-muted-foreground"
                    aria-label={t("fromHistory")}
                  >
                    <option value="">{t("fromHistory")}</option>
                    {suggestions.map((sug) => (
                      <option key={sug} value={sug}>
                        {sug.length > 80 ? `${sug.slice(0, 80)}…` : sug}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <div className="space-y-1 sm:ml-[4.5rem]">
                {(opt.items ?? []).map((it) => (
                  <div key={it.id} className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1 text-xs">
                    <span className="min-w-0 flex-1 truncate">{it.name}</span>
                    <NumberInput
                      value={it.qtyG}
                      min={0}
                      onValueChange={(v) =>
                        onOption(opt.id, (o) => ({
                          ...o,
                          items: (o.items ?? []).map((x) => (x.id === it.id ? { ...x, qtyG: v ?? 0 } : x)),
                        }))
                      }
                      className="h-7 w-16 px-2 text-right text-xs"
                      aria-label={`${it.name} — ${t("quantity")}`}
                    />
                    <span className="w-10 text-muted-foreground">{it.unit === "porção" ? t("portion") : (it.unit ?? "g")}</span>
                    <span className="w-16 text-right font-medium lining-nums tabular-nums">{Math.round(it.qtyG * it.perG.kcal)} kcal</span>
                    <button
                      type="button"
                      onClick={() => onOption(opt.id, (o) => ({ ...o, items: (o.items ?? []).filter((x) => x.id !== it.id) }))}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={tcom("remove")}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => onAddFood(opt.id)}
                    className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                  >
                    <Utensils className="size-3" /> {t("addFood")}
                  </button>
                  {ot.kcal > 0 && (
                    <span className="text-xs lining-nums tabular-nums text-muted-foreground">
                      {ot.kcal} kcal · P {ot.protein}g · HC {ot.carbs}g · G {ot.fat}g
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <Button variant="ghost" size="sm" onClick={() => onPatch({ options: [...meal.options, blankOption()] })}>
          <Plus /> {t("addOption")}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sidebar widgets
// ---------------------------------------------------------------------------
function NutritionSummary({ totals, target, hasItems }: { totals: Totals; target?: Totals; hasItems: boolean }) {
  const t = useTranslations("plan");
  const row = (label: string, val: number, tgt: number | undefined, unit: string) => {
    const ratio = tgt ? val / tgt : 0;
    return (
      <div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium lining-nums tabular-nums">
            {hasItems ? val : "—"}
            {tgt ? ` / ${tgt}` : ""} {unit}
          </span>
        </div>
        {tgt ? (
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", ratio > 1.05 ? "bg-accent" : ratio < 0.9 ? "bg-brand-200" : "bg-brand")}
              style={{ width: `${Math.min(100, ratio * 100)}%` }}
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
        <p className="text-[11px] text-muted-foreground">{hasItems ? t("dayTotalHint") : t("noItemsHint")}</p>
        {row(t("energy"), totals.kcal, target?.kcal, "kcal")}
        {row(t("proteinShort"), totals.protein, target?.protein, "g")}
        {row(t("carbsShort"), totals.carbs, target?.carbs, "g")}
        {row(t("fatShort"), totals.fat, target?.fat, "g")}
      </CardContent>
    </Card>
  );
}

function RecommendationPicker({
  recommendations,
  language,
  selected,
  onToggle,
}: {
  recommendations: RecLite[];
  language: PlanLanguage;
  selected: Set<string>;
  onToggle: (r: RecLite) => void;
}) {
  const t = useTranslations("plan");
  const tai = useTranslations("ai");
  const [open, setOpen] = useState(true);
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
            <Sparkles className="size-4 text-accent" /> {t("insertRecommendation")}
            {selected.size > 0 && (
              <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold text-primary-foreground">{selected.size}</span>
            )}
          </span>
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="mt-3 space-y-1.5">
            {recommendations.map((r) => {
              const isSel = selected.has(r.id);
              return (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => onToggle(r)}
                  aria-pressed={isSel}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    isSel ? "border-brand/40 bg-brand-50" : "border-border hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                      isSel ? "border-brand bg-brand text-primary-foreground" : "border-muted-foreground/40",
                    )}
                  >
                    {isSel && <Check className="size-3" />}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block font-medium", isSel && "text-brand-700")}>{r.title}</span>
                    <span className="line-clamp-1 block text-xs text-muted-foreground">
                      {r.content[language] || r.content["pt-PT"]}
                    </span>
                  </span>
                </button>
              );
            })}
            <p className="pt-1 text-[11px] italic text-muted-foreground">{tai("disclaimer")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ApplyTemplateDialog({
  templates,
  hasMeals,
  onApply,
  onClose,
}: {
  templates: TemplateLite[];
  hasMeals: boolean;
  onApply: (tpl: TemplateLite, mode: "append" | "replace") => void;
  onClose: () => void;
}) {
  const t = useTranslations("plan");
  const [mode, setMode] = useState<"append" | "replace">("append");
  return (
    <Dialog title={t("useTemplate")} onClose={onClose}>
      {hasMeals && (
        <Segmented
          value={mode}
          onChange={setMode}
          size="sm"
          className="mb-3"
          items={[
            { value: "append", label: t("templateAppend") },
            { value: "replace", label: t("templateReplace") },
          ]}
        />
      )}
      <div className="max-h-80 space-y-1.5 overflow-y-auto scroll-thin">
        {templates.map((tpl) => (
          <button
            type="button"
            key={tpl.id}
            onClick={() => onApply(tpl, hasMeals ? mode : "replace")}
            className="w-full rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:border-brand/40 hover:bg-brand-50"
          >
            <p className="text-sm font-medium">{tpl.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {tpl.meals.map((m) => m.name).filter(Boolean).join(" · ") || "—"}
            </p>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

function SaveTemplateDialog({
  onSave,
  onClose,
  pending,
}: {
  onSave: (name: string) => void;
  onClose: () => void;
  pending: boolean;
}) {
  const t = useTranslations("plan");
  const tcom = useTranslations("common");
  const [name, setName] = useState("");
  return (
    <Dialog title={t("saveAsTemplate")} description={t("saveAsTemplateHint")} onClose={onClose} size="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim());
        }}
      >
        <Field label={t("templateName")} htmlFor="tpl-name">
          <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {tcom("cancel")}
          </Button>
          <Button type="submit" loading={pending} disabled={!name.trim()}>
            {tcom("save")}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
