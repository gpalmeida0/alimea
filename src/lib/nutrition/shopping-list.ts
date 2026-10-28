// ---------------------------------------------------------------------------
// Shopping list — everything a plan needs for a number of days, added up and
// grouped by food group. Recipes are expanded into their ingredients.
// ---------------------------------------------------------------------------

import type { DbFood, FoodUnit, Meal, Recipe } from "@/lib/types";
import { normalizeSearch } from "@/lib/utils";
import type { Food } from "./foods";

export interface ShoppingLine {
  name: string;
  qty: number;
  unit: FoodUnit;
}

export interface ShoppingGroup {
  /** Food group; "" for foods without one. */
  group: string;
  lines: ShoppingLine[];
}

export interface ShoppingOptions {
  days: number;
  /**
   * "first": the first option of each meal, every day.
   * "all": the client alternates between a meal's options, so each one is
   * bought for its share of the days.
   */
  scope: "first" | "all";
  dbFoods?: DbFood[];
  recipes?: Recipe[];
  staticFoods?: Food[];
}

/** Round up to something that can be bought or weighed. */
function roundUp(qty: number, unit: FoodUnit): number {
  if (unit === "porção") return Math.ceil(qty * 2) / 2;
  return qty > 10 ? Math.ceil(qty / 5) * 5 : Math.ceil(qty);
}

export function shoppingList(meals: Meal[], { days, scope, dbFoods = [], recipes = [], staticFoods = [] }: ShoppingOptions): ShoppingGroup[] {
  const foodsById = new Map(dbFoods.map((f) => [f.id, f]));
  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  const staticGroups = new Map(staticFoods.map((f) => [normalizeSearch(f.name), f.group]));
  const lines = new Map<string, ShoppingLine & { group: string }>();

  const add = (name: string, unit: FoodUnit, qty: number, group: string | undefined) => {
    if (!(qty > 0)) return;
    const key = `${normalizeSearch(name)}|${unit}`;
    const line = lines.get(key);
    if (line) line.qty += qty;
    else lines.set(key, { name, unit, qty, group: group?.trim() ?? "" });
  };

  for (const meal of meals) {
    const options = (scope === "first" ? meal.options.slice(0, 1) : meal.options).filter((o) => o.items?.length);
    for (const option of options) {
      const times = days / options.length;
      for (const item of option.items!) {
        const recipe = item.kind === "recipe" ? recipesById.get(item.refId ?? "") : undefined;
        if (recipe) {
          // item.qtyG is a number of portions.
          const batches = (item.qtyG * times) / (recipe.servings > 0 ? recipe.servings : 1);
          for (const ingredient of recipe.items) {
            const food = foodsById.get(ingredient.foodId);
            add(food?.name ?? ingredient.name, food?.baseUnit ?? "g", ingredient.qty * batches, food?.category);
          }
          continue;
        }
        const group = foodsById.get(item.refId ?? "")?.category ?? staticGroups.get(normalizeSearch(item.name));
        add(item.name, item.unit ?? "g", item.qtyG * times, group);
      }
    }
  }

  const groups = new Map<string, ShoppingLine[]>();
  for (const { group, ...line } of lines.values()) {
    const list = groups.get(group) ?? [];
    list.push({ ...line, qty: roundUp(line.qty, line.unit) });
    groups.set(group, list);
  }
  return [...groups.entries()]
    .map(([group, list]) => ({ group, lines: list.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => Number(!a.group) - Number(!b.group) || a.group.localeCompare(b.group));
}

/** "250 g", "1,5 kg", "2 L", "3 porções". */
export function formatQuantity(qty: number, unit: FoodUnit, locale: string, portionWord: (count: number) => string = () => "porção"): string {
  const n = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(v);
  if (unit === "porção") return `${n(qty)} ${portionWord(qty)}`;
  if (qty >= 1000) return `${n(qty / 1000)} ${unit === "g" ? "kg" : "L"}`;
  return `${n(qty)} ${unit}`;
}

/** Plain text for the clipboard (WhatsApp, email, notes). */
export function shoppingListText(
  groups: ShoppingGroup[],
  opts: { title: string; otherGroup: string; locale: string; portionWord?: (count: number) => string },
): string {
  const blocks = groups.map((g) =>
    [`${(g.group || opts.otherGroup).toUpperCase()}`, ...g.lines.map((l) => `☐ ${l.name} — ${formatQuantity(l.qty, l.unit, opts.locale, opts.portionWord)}`)].join("\n"),
  );
  return [opts.title, ...blocks].join("\n\n");
}
