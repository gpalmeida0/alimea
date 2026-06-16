"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Loader2, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { deleteRecipeAction, saveRecipeAction } from "@/app/actions";
import { recipeTotals, roundTotals } from "@/lib/nutrition/items";
import type { DbFood, Recipe, RecipeItem } from "@/lib/types";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

type Draft = {
  id?: string;
  name: string;
  servings: number;
  preparation: string;
  items: RecipeItem[];
};

export function RecipesManager({ recipes, foods }: { recipes: Recipe[]; foods: DbFood[] }) {
  const t = useTranslations("nutrition");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [pending, start] = useTransition();

  function openNew() {
    setEditing({ name: "", servings: 1, preparation: "", items: [] });
  }
  function openEdit(r: Recipe) {
    setEditing({
      id: r.id,
      name: r.name,
      servings: r.servings,
      preparation: r.preparation ?? "",
      items: r.items.map((it) => ({ ...it })),
    });
  }

  function submit() {
    if (!editing || !editing.name.trim()) return;
    start(async () => {
      await saveRecipeAction(locale, {
        id: editing.id,
        name: editing.name.trim(),
        servings: editing.servings || 1,
        preparation: editing.preparation || undefined,
        items: editing.items.filter((it) => it.foodId),
      });
      setEditing(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      await deleteRecipeAction(locale, id);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={openNew} disabled={foods.length === 0}>
          <Plus /> {t("addRecipe")}
        </Button>
      </div>

      {foods.length === 0 && (
        <p className="mb-4 rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          {t("noFoodsYet")}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recipes.map((r) => {
          const { total, perPortion } = recipeTotals(r, foods);
          const pp = roundTotals(perPortion);
          const tt = roundTotals(total);
          return (
            <Card key={r.id}>
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-serif text-lg font-semibold">
                      <ChefHat className="size-4 text-brand" /> <span className="truncate">{r.name}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.servings} {t("servings").toLowerCase()} · {r.items.length} {t("ingredients").toLowerCase()}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => openEdit(r)} className="rounded p-1 text-muted-foreground hover:text-foreground">
                      <Pencil className="size-4" />
                    </button>
                    <button onClick={() => remove(r.id)} className="rounded p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="rounded-md bg-muted/50 p-2 text-xs">
                  <p className="font-medium">{t("perPortion")}</p>
                  <p className="text-muted-foreground">
                    {pp.kcal} kcal · P {pp.protein} · HC {pp.carbs} · G {pp.fat}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t("totals")}: {tt.kcal} kcal
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {recipes.length === 0 && (
          <p className="col-span-full rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {t("noRecipes")}
          </p>
        )}
      </div>

      {editing && (
        <RecipeEditor
          draft={editing}
          setDraft={setEditing}
          foods={foods}
          onSave={submit}
          onClose={() => setEditing(null)}
          pending={pending}
          t={t}
          tc={tc}
        />
      )}
    </div>
  );
}

function RecipeEditor({
  draft,
  setDraft,
  foods,
  onSave,
  onClose,
  pending,
  t,
  tc,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  foods: DbFood[];
  onSave: () => void;
  onClose: () => void;
  pending: boolean;
  t: (k: string, v?: Record<string, string | number>) => string;
  tc: (k: string) => string;
}) {
  const preview: Recipe = {
    id: "preview",
    nutritionistId: "",
    name: draft.name,
    servings: draft.servings,
    items: draft.items,
    createdAt: "",
  };
  const { total, perPortion } = recipeTotals(preview, foods);
  const pp = roundTotals(perPortion);
  const tt = roundTotals(total);

  const addItem = () =>
    setDraft({ ...draft, items: [...draft.items, { id: uid(), foodId: foods[0]?.id ?? "", name: foods[0]?.name ?? "", qty: 100 }] });
  const setItem = (id: string, patch: Partial<RecipeItem>) =>
    setDraft({ ...draft, items: draft.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  const removeItem = (id: string) => setDraft({ ...draft, items: draft.items.filter((it) => it.id !== id) });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 py-[6vh]" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-5 shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg font-semibold">{draft.id ? t("editRecipe") : t("addRecipe")}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="space-y-1.5">
              <Label>{t("recipeName")}</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>{t("servings")}</Label>
              <Input
                type="number"
                min={1}
                value={draft.servings}
                onChange={(e) => setDraft({ ...draft, servings: Number(e.target.value) || 1 })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("ingredients")}</Label>
            {draft.items.map((it) => {
              const food = foods.find((f) => f.id === it.foodId);
              return (
                <div key={it.id} className="flex items-center gap-2">
                  <select
                    value={it.foodId}
                    onChange={(e) => {
                      const f = foods.find((x) => x.id === e.target.value);
                      setItem(it.id, { foodId: e.target.value, name: f?.name ?? "" });
                    }}
                    className="h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-sm"
                  >
                    {foods.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min={0}
                    value={it.qty}
                    onChange={(e) => setItem(it.id, { qty: Number(e.target.value) || 0 })}
                    className="h-9 w-20 text-right"
                  />
                  <span className="w-6 text-xs text-muted-foreground">{food?.baseUnit ?? "g"}</span>
                  <button onClick={() => removeItem(it.id)} className="text-muted-foreground hover:text-destructive">
                    <X className="size-4" />
                  </button>
                </div>
              );
            })}
            <Button variant="ghost" size="sm" onClick={addItem} disabled={foods.length === 0}>
              <Plus /> {t("addIngredient")}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/50 p-3 text-xs">
            <div>
              <p className="font-medium">{t("totals")}</p>
              <p className="text-muted-foreground">
                {tt.kcal} kcal · P {tt.protein} · HC {tt.carbs} · G {tt.fat}
              </p>
            </div>
            <div>
              <p className="font-medium">{t("perPortion")}</p>
              <p className="text-muted-foreground">
                {pp.kcal} kcal · P {pp.protein} · HC {pp.carbs} · G {pp.fat}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("preparation")}</Label>
            <Textarea value={draft.preparation} onChange={(e) => setDraft({ ...draft, preparation: e.target.value })} rows={3} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button onClick={onSave} disabled={pending || !draft.name.trim()}>
              {pending ? <Loader2 className="animate-spin" /> : null} {tc("save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
