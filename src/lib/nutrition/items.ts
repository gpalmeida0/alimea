import type { DbFood, FoodItem, Meal, MealOption, Recipe } from "@/lib/types";
import type { Food } from "./foods";
import { newId as makeId } from "@/lib/utils";

export interface Totals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

const ZERO: Totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

const newId = () => makeId("item");

/**
 * Food group whose "Quantidade" column counts equivalents rather than grams
 * (e.g. "100gr de carne … OU 4 Ovos" = 4), so it has no portion weight.
 */
export const EQUIVALENTS_GROUP = "Equivalentes";

/** Grams (or mL) in one portion, when the table gives a real weight. */
export function portionWeight(qty: number | null | undefined, group?: string | null): number | undefined {
  return qty && qty > 0 && group?.trim() !== EQUIVALENTS_GROUP ? qty : undefined;
}

/**
 * Build a plan item from a built-in (Excel) food. Every row of the table is one
 * portion: the values are per portion and the quantity is a number of
 * portions (1, 1.5, 0.5…), exactly like the Excel's "Quantidade" column.
 */
export function foodToItem(food: Food, portions = 1): FoodItem {
  return {
    id: newId(),
    name: food.name,
    qtyG: portions,
    unit: "porção",
    kind: "food",
    portionG: portionWeight(food.qtyG, food.group),
    portionUnit: "g",
    perG: { kcal: food.kcal ?? 0, protein: food.protein ?? 0, carbs: food.carbs ?? 0, fat: food.fat ?? 0 },
  };
}

/** Build a plan item from one of the nutritionist's foods: 1 portion = its reference quantity (BOO-57). */
export function dbFoodToItem(food: DbFood, portions = 1): FoodItem {
  return {
    id: newId(),
    name: food.name,
    qtyG: portions,
    unit: "porção",
    kind: "food",
    refId: food.id,
    portionG: portionWeight(food.refQty, food.category),
    portionUnit: food.baseUnit,
    perG: { kcal: food.kcal ?? 0, protein: food.protein ?? 0, carbs: food.carbs ?? 0, fat: food.fat ?? 0 },
  };
}

/** A food measured in portions (as opposed to older gram-based items and recipes). */
export const isPortionFood = (item: FoodItem) => item.kind !== "recipe" && item.unit === "porção";

/** Weight of an item in grams/mL, when known. */
export function itemWeight(item: FoodItem): { qty: number; unit: "g" | "mL" } | undefined {
  if (isPortionFood(item)) return item.portionG ? { qty: item.qtyG * item.portionG, unit: item.portionUnit ?? "g" } : undefined;
  if (item.kind !== "recipe" && (item.unit === "g" || item.unit === "mL" || !item.unit)) return { qty: item.qtyG, unit: item.unit === "mL" ? "mL" : "g" };
  return undefined;
}

/** Total and per-portion nutrition of a recipe (BOO-58). */
export function recipeTotals(
  recipe: Recipe,
  foods: DbFood[],
): { total: Totals; perPortion: Totals } {
  const byId = new Map(foods.map((f) => [f.id, f]));
  const total = sumTotals(
    recipe.items.map((it) => {
      const f = byId.get(it.foodId);
      if (!f) return { ...ZERO };
      const base = f.refQty && f.refQty > 0 ? f.refQty : 100;
      const factor = (it.qty || 0) / base;
      return {
        kcal: (f.kcal ?? 0) * factor,
        protein: (f.protein ?? 0) * factor,
        carbs: (f.carbs ?? 0) * factor,
        fat: (f.fat ?? 0) * factor,
      };
    }),
  );
  const servings = recipe.servings && recipe.servings > 0 ? recipe.servings : 1;
  const perPortion = {
    kcal: total.kcal / servings,
    protein: total.protein / servings,
    carbs: total.carbs / servings,
    fat: total.fat / servings,
  };
  return { total, perPortion };
}

/** Build a FoodItem from a recipe (1 unit = 1 portion). */
export function recipeToItem(recipe: Recipe, foods: DbFood[], portions = 1): FoodItem {
  const { perPortion } = recipeTotals(recipe, foods);
  return {
    id: newId(),
    name: recipe.name,
    qtyG: portions,
    unit: "porção",
    kind: "recipe",
    refId: recipe.id,
    perG: perPortion,
  };
}

export function itemTotals(item: FoodItem): Totals {
  return {
    kcal: item.qtyG * item.perG.kcal,
    protein: item.qtyG * item.perG.protein,
    carbs: item.qtyG * item.perG.carbs,
    fat: item.qtyG * item.perG.fat,
  };
}

export function sumTotals(list: Totals[]): Totals {
  return list.reduce(
    (a, b) => ({
      kcal: a.kcal + b.kcal,
      protein: a.protein + b.protein,
      carbs: a.carbs + b.carbs,
      fat: a.fat + b.fat,
    }),
    { ...ZERO },
  );
}

export function optionTotals(option: MealOption): Totals {
  return sumTotals((option.items ?? []).map(itemTotals));
}

/** A meal's nutrition is taken from its first option (options are alternatives). */
export function mealTotals(meal: Meal): Totals {
  return meal.options[0] ? optionTotals(meal.options[0]) : { ...ZERO };
}

/** Plan total = representative day (first option of each meal). */
export function planTotals(meals: Meal[]): Totals {
  return sumTotals(meals.map(mealTotals));
}

export function roundTotals(t: Totals): Totals {
  return {
    kcal: Math.round(t.kcal),
    protein: Math.round(t.protein),
    carbs: Math.round(t.carbs),
    fat: Math.round(t.fat),
  };
}

export function hasItems(meals: Meal[]): boolean {
  return meals.some((m) => m.options.some((o) => (o.items?.length ?? 0) > 0));
}

/** Deep-copy meals with fresh ids everywhere (keeps times, options and food items). */
export function cloneMeals(meals: Meal[]): Meal[] {
  return meals.map((m) => ({
    ...m,
    id: makeId("meal"),
    options: m.options.map((o) => ({
      ...o,
      id: makeId("opt"),
      items: o.items?.map((it) => ({ ...it, id: makeId("item"), perG: { ...it.perG } })),
    })),
  }));
}

const fmtQty = (n: number, decimal = ",") => String(Number.isInteger(n) ? n : Math.round(n * 100) / 100).replace(".", decimal);

/**
 * Human line for a plan item:
 * "1,5 × Pão de mistura (93 g)" (portion foods), "1 porção Panquecas" (recipes),
 * "40 g Aveia" (older gram-based items).
 */
export function formatItem(item: FoodItem, portionWord = "porção", decimal = ","): string {
  if (isPortionFood(item)) {
    const w = itemWeight(item);
    return `${fmtQty(item.qtyG, decimal)} × ${item.name}${w ? ` (${fmtQty(Math.round(w.qty), decimal)} ${w.unit})` : ""}`;
  }
  const unit = item.unit === "porção" ? portionWord : item.unit ?? "g";
  return `${fmtQty(item.qtyG, decimal)} ${unit} ${item.name}`;
}
