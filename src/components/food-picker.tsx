"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChefHat, Database, Search, X } from "lucide-react";
import { searchFoods } from "@/lib/nutrition/foods";
import { dbFoodToItem, foodToItem, recipeToItem } from "@/lib/nutrition/items";
import type { DbFood, FoodItem, Recipe } from "@/lib/types";
import { cn, normalizeSearch } from "@/lib/utils";

type Row =
  | { kind: "recipe"; recipe: Recipe }
  | { kind: "db"; food: DbFood }
  | { kind: "static"; food: ReturnType<typeof searchFoods>[number] };

/**
 * Searchable picker over the nutritionist's recipes (per portion), their own
 * foods and the built-in food composition table. Arrow keys + Enter to pick;
 * Shift+Enter keeps the picker open to add several items in a row. (BOO-66)
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
  const [active, setActive] = useState(0);
  const [added, setAdded] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const rows = useMemo<Row[]>(() => {
    const nq = normalizeSearch(q.trim());
    const recipeRows = recipes.filter((r) => !nq || normalizeSearch(r.name).includes(nq)).map((recipe) => ({ kind: "recipe" as const, recipe }));
    const dbRows = dbFoods
      .filter((f) => !f.archived && (!nq || normalizeSearch(`${f.name} ${f.brand ?? ""}`).includes(nq)))
      .map((food) => ({ kind: "db" as const, food }));
    const staticRows = searchFoods(q, undefined, 50).map((food) => ({ kind: "static" as const, food }));
    return [...recipeRows, ...dbRows, ...staticRows].slice(0, 120);
  }, [q, dbFoods, recipes]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function pick(row: Row | undefined, keepOpen = false) {
    if (!row) return;
    if (row.kind === "recipe") onPick(recipeToItem(row.recipe, dbFoods, 1));
    else if (row.kind === "db") onPick(dbFoodToItem(row.food));
    else onPick(foodToItem(row.food));
    if (keepOpen) setAdded((n) => n + 1);
    else onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/30 p-4 pt-[10vh] backdrop-blur-[2px] animate-in fade-in-0"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={tn("pickItem")} className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95">
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, rows.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                pick(rows[active], e.shiftKey);
              }
            }}
            placeholder={tn("pickItem")}
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {added > 0 && <span className="whitespace-nowrap text-xs text-brand-600">+{added}</span>}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div ref={listRef} role="listbox" className="max-h-96 overflow-y-auto p-1 scroll-thin">
          {rows.map((row, i) => {
            const meta =
              row.kind === "recipe"
                ? { key: `r-${row.recipe.id}`, name: row.recipe.name, sub: tn("recipe"), kcal: undefined, icon: <ChefHat className="size-3.5 text-brand" /> }
                : row.kind === "db"
                  ? {
                      key: `d-${row.food.id}`,
                      name: row.food.name,
                      sub: `${tn("myFoods")} · ${row.food.refQty}${row.food.baseUnit}${row.food.brand ? ` · ${row.food.brand}` : ""}`,
                      kcal: row.food.kcal,
                      icon: <Database className="size-3.5 text-brand" />,
                    }
                  : {
                      key: `s-${i}-${row.food.name}`,
                      name: row.food.name,
                      sub: `${row.food.group}${row.food.qtyG ? ` · ${row.food.qtyG}g` : ""}`,
                      kcal: row.food.kcal ?? undefined,
                      icon: null,
                    };
            return (
              <button
                key={meta.key}
                data-index={i}
                role="option"
                aria-selected={i === active}
                onMouseMove={() => setActive(i)}
                onClick={(e) => pick(row, e.shiftKey)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm",
                  i === active && "bg-brand-50",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {meta.icon}
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{meta.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{meta.sub}</span>
                  </span>
                </span>
                <span className="shrink-0 text-xs font-medium lining-nums tabular-nums text-brand-600">
                  {meta.kcal != null ? `${Math.round(meta.kcal)} kcal` : tn("porcao")}
                </span>
              </button>
            );
          })}
          {rows.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("noResults")}</p>}
        </div>
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">{tn("pickerHint")}</p>
      </div>
    </div>
  );
}
