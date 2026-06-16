"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X, ChefHat } from "lucide-react";
import { searchFoods } from "@/lib/nutrition/foods";
import { dbFoodToItem, foodToItem, recipeToItem } from "@/lib/nutrition/items";
import type { DbFood, FoodItem, Recipe } from "@/lib/types";

/**
 * Searchable picker over three sources: the nutritionist's database foods,
 * her recipes (counted per portion), and the built-in static food database.
 * Always returns a ready-to-use FoodItem. (BOO-66)
 */
export function FoodPicker({
  onPick,
  onClose,
  dbFoods = [],
  recipes = [],
}: {
  onPick: (item: FoodItem) => void;
  onClose: () => void;
  dbFoods?: DbFood[];
  recipes?: Recipe[];
}) {
  const t = useTranslations("foods");
  const tn = useTranslations("nutrition");
  const [q, setQ] = useState("");

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const results = useMemo(() => {
    const nq = norm(q.trim());
    const recipeRows = recipes
      .filter((r) => !nq || norm(r.name).includes(nq))
      .map((r) => ({ kind: "recipe" as const, recipe: r }));
    const dbRows = dbFoods
      .filter((f) => !f.archived && (!nq || norm(f.name).includes(nq)))
      .map((f) => ({ kind: "db" as const, food: f }));
    const staticRows = searchFoods(q, undefined, 40).map((f) => ({ kind: "static" as const, food: f }));
    return [...recipeRows, ...dbRows, ...staticRows].slice(0, 80);
  }, [q, dbFoods, recipes]);

  function pick(row: (typeof results)[number]) {
    if (row.kind === "recipe") onPick(recipeToItem(row.recipe, dbFoods, 1));
    else if (row.kind === "db") onPick(dbFoodToItem(row.food));
    else onPick(foodToItem(row.food));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-[12vh]" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tn("pickItem")}
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto scroll-thin p-1">
          {results.map((row, i) => {
            if (row.kind === "recipe") {
              return (
                <button
                  key={`r-${i}`}
                  onClick={() => pick(row)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ChefHat className="size-3.5 shrink-0 text-brand" />
                    <span className="block truncate font-medium">{row.recipe.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{tn("porcao")}</span>
                </button>
              );
            }
            const meta =
              row.kind === "db"
                ? { name: row.food.name, kcal: row.food.kcal, source: tn("myFoods"), unit: row.food.baseUnit, ref: row.food.refQty }
                : { name: row.food.name, kcal: row.food.kcal, source: row.food.group, unit: "g", ref: row.food.qtyG };
            return (
              <button
                key={`f-${i}`}
                onClick={() => pick(row)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{meta.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {meta.source}
                    {meta.ref ? ` · ${meta.ref}${meta.unit}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-medium text-brand-600">{meta.kcal ?? "—"} kcal</span>
              </button>
            );
          })}
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("noResults")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
