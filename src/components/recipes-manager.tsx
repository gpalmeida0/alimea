"use client";

import { useId, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChefHat, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback";
import { Field, Input, Label, NumberInput, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { Link } from "@/i18n/routing";
import { useServerAction } from "@/hooks/use-server-action";
import { deleteRecipeAction, saveRecipeAction } from "@/app/actions";
import { builtInFoods } from "@/lib/nutrition/foods";
import { portionWeight, recipeTotals, roundTotals, type Totals } from "@/lib/nutrition/items";
import type { DbFood, Recipe, RecipeItem } from "@/lib/types";
import { newId, normalizeSearch } from "@/lib/utils";

type Draft = { id?: string; name: string; servings?: number; preparation: string; items: RecipeItem[] };

const macroLine = (x: Totals) => `${x.kcal} kcal · P ${x.protein}g · HC ${x.carbs}g · G ${x.fat}g`;

/** `foods` must include archived foods so existing recipes keep their totals. */
export function RecipesManager({ recipes, foods }: { recipes: Recipe[]; foods: DbFood[] }) {
  const t = useTranslations("nutrition");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { confirm } = useFeedback();
  const { run, pending } = useServerAction();
  const [editing, setEditing] = useState<Draft | null>(null);
  // The built-in table, minus foods the account already has under the same name.
  const library = useMemo(() => {
    const own = new Set(foods.filter((f) => !f.archived).map((f) => f.name));
    return builtInFoods().filter((f) => !own.has(f.name)) as unknown as DbFood[];
  }, [foods]);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing({ name: "", servings: 1, preparation: "", items: [] })}>
          <Plus /> {t("addRecipe")}
        </Button>
      </div>

      {recipes.length === 0 ? (
        <EmptyState icon={<ChefHat />} title={t("noRecipes")} description={t("noRecipesHint")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => {
            const { total, perPortion } = recipeTotals(r, foods);
            return (
              <Card key={r.id} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-3 pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-serif text-lg font-semibold">
                        <ChefHat className="size-4 shrink-0 text-brand" /> <span className="truncate">{r.name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("servingsCount", { n: r.servings })} · {t("ingredientsCount", { n: r.items.length })}
                      </p>
                    </div>
                    <div className="flex shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={tc("edit")}
                        onClick={() => setEditing({ id: r.id, name: r.name, servings: r.servings, preparation: r.preparation ?? "", items: r.items.map((it) => ({ ...it })) })}
                      >
                        <Pencil className="text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={tc("delete")}
                        onClick={async () => {
                          if (await confirm({ title: t("deleteRecipeTitle", { name: r.name }), destructive: true })) {
                            run(() => deleteRecipeAction(locale, r.id), { success: tc("deleted") });
                          }
                        }}
                      >
                        <Trash2 className="text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{r.items.map((i) => i.name).join(", ") || "—"}</p>
                  <div className="mt-auto rounded-lg bg-muted/60 p-2.5 text-xs">
                    <p className="font-medium">{t("perPortion")}</p>
                    <p className="lining-nums tabular-nums text-muted-foreground">{macroLine(roundTotals(perPortion))}</p>
                    <p className="mt-1 text-[11px] lining-nums tabular-nums text-muted-foreground">
                      {t("totals")}: {roundTotals(total).kcal} kcal
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <RecipeDialog
          draft={editing}
          setDraft={setEditing}
          foods={foods}
          library={library}
          pending={pending}
          onClose={() => setEditing(null)}
          onSave={() =>
            run(
              () =>
                saveRecipeAction(locale, {
                  id: editing.id,
                  name: editing.name.trim(),
                  servings: editing.servings || 1,
                  preparation: editing.preparation,
                  items: editing.items.filter((it) => it.foodId),
                }),
              { success: tc("saved"), onDone: () => setEditing(null) },
            )
          }
        />
      )}
    </div>
  );
}

function RecipeDialog({
  draft,
  setDraft,
  foods,
  library,
  onSave,
  onClose,
  pending,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  foods: DbFood[];
  /** Built-in foods; copied into the account's foods when the recipe is saved. */
  library: DbFood[];
  onSave: () => void;
  onClose: () => void;
  pending: boolean;
}) {
  const t = useTranslations("nutrition");
  const tc = useTranslations("common");
  const active = foods.filter((f) => !f.archived);
  const preview: Recipe = { id: "preview", nutritionistId: "", name: draft.name, servings: draft.servings || 1, items: draft.items, createdAt: "" };
  const all = useMemo(() => [...foods, ...library], [foods, library]);
  const { total, perPortion } = recipeTotals(preview, all);
  const setItem = (id: string, patch: Partial<RecipeItem>) =>
    setDraft({ ...draft, items: draft.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });

  return (
    <Dialog title={draft.id ? t("editRecipe") : t("addRecipe")} onClose={onClose} size="lg">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.name.trim()) onSave();
        }}
      >
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label={t("recipeName")} htmlFor="r-name">
            <Input id="r-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          </Field>
          <Field label={t("servings")} htmlFor="r-servings">
            <NumberInput id="r-servings" value={draft.servings} onValueChange={(v) => setDraft({ ...draft, servings: v })} min={1} />
          </Field>
        </div>

        <div className="space-y-2">
          <Label>{t("ingredients")}</Label>
          {draft.items.length === 0 && <p className="text-sm text-muted-foreground">{t("noIngredients")}</p>}
          {draft.items.map((it) => {
            const food = all.find((f) => f.id === it.foodId);
            const base = food && food.refQty > 0 ? food.refQty : 100;
            const grams = food ? portionWeight(food.refQty, food.category) : undefined;
            const portions = Math.round(((it.qty || 0) / base) * 100) / 100;
            return (
              <div key={it.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm" title={it.name}>
                  {food?.name ?? it.name ?? "—"}
                  {food?.archived ? <span className="text-muted-foreground"> ({t("archived")})</span> : null}
                </span>
                <NumberInput
                  value={portions}
                  onValueChange={(v) => setItem(it.id, { qty: (v ?? 0) * base })}
                  min={0}
                  className="w-16 text-right"
                  aria-label={`${it.name} — ${t("portions")}`}
                />
                <span className="w-10 text-xs text-muted-foreground">{t("porcao")}</span>
                <span className="hidden w-14 text-right text-xs lining-nums tabular-nums text-muted-foreground sm:inline">
                  {grams ? `${Math.round(portions * grams)} ${food?.baseUnit ?? "g"}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, items: draft.items.filter((x) => x.id !== it.id) })}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={tc("remove")}
                >
                  <X className="size-4" />
                </button>
              </div>
            );
          })}
          <IngredientSearch
            foods={active}
            library={library}
            onPick={(f) => setDraft({ ...draft, items: [...draft.items, { id: newId("ri"), foodId: f.id, name: f.name, qty: f.refQty > 0 ? f.refQty : 100 }] })}
          />
          <p className="text-[11px] text-muted-foreground">{t("ingredientPortionsHint")}</p>
        </div>

        <div className="grid gap-2 rounded-lg bg-muted/60 p-3 text-xs sm:grid-cols-2">
          <div>
            <p className="font-medium">{t("totals")}</p>
            <p className="lining-nums tabular-nums text-muted-foreground">{macroLine(roundTotals(total))}</p>
          </div>
          <div>
            <p className="font-medium">{t("perPortion")}</p>
            <p className="lining-nums tabular-nums text-muted-foreground">{macroLine(roundTotals(perPortion))}</p>
          </div>
        </div>

        <Field label={t("preparation")} htmlFor="r-prep">
          <Textarea id="r-prep" value={draft.preparation} onChange={(e) => setDraft({ ...draft, preparation: e.target.value })} rows={3} />
        </Field>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" loading={pending} disabled={!draft.name.trim()}>
            {tc("save")}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

/** Type-to-search over the account's foods and the built-in table (↑↓ + Enter to add). */
function IngredientSearch({ foods, library, onPick }: { foods: DbFood[]; library: DbFood[]; onPick: (f: DbFood) => void }) {
  const t = useTranslations("nutrition");
  const tf = useTranslations("foods");
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const results = useMemo(() => {
    const nq = normalizeSearch(q.trim());
    if (!nq) return [];
    const match = (f: DbFood) => normalizeSearch(`${f.name} ${f.brand ?? ""}`).includes(nq);
    return [...foods.filter(match).map((f) => ({ f, own: true })), ...library.filter(match).map((f) => ({ f, own: false }))].slice(0, 40);
  }, [q, foods, library]);

  const pick = (f: DbFood | undefined) => {
    if (!f) return;
    onPick(f);
    setQ("");
    setActive(0);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2.5">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault(); // never submit the recipe form from here
              pick(results[active]?.f);
            } else if (e.key === "Escape" && q) {
              e.preventDefault();
              e.stopPropagation();
              setQ("");
            }
          }}
          placeholder={t("searchIngredient")}
          aria-label={t("addIngredient")}
          role="combobox"
          aria-controls={listId}
          aria-expanded={results.length > 0}
          className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {q.trim() && (
        <div id={listId} role="listbox" className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-lg scroll-thin">
          {results.length === 0 && <p className="px-3 py-3 text-center text-sm text-muted-foreground">{tf("noResults")}</p>}
          {results.map(({ f, own }, i) => (
            <button
              type="button"
              key={f.id}
              role="option"
              aria-selected={i === active}
              onMouseMove={() => setActive(i)}
              onClick={() => pick(f)}
              className={`flex w-full items-center justify-between gap-3 rounded px-2.5 py-1.5 text-left text-sm ${i === active ? "bg-brand-50" : ""}`}
            >
              <span className="min-w-0">
                <span className="block truncate">{f.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[own ? t("myFoods") : f.category, portionWeight(f.refQty, f.category) ? `${f.refQty} ${f.baseUnit}` : ""].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="shrink-0 text-xs font-medium lining-nums tabular-nums text-brand-600">{Math.round(f.kcal)} kcal</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
