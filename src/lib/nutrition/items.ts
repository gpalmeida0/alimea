import type { DbFood, FoodItem, Meal, MealOption, Recipe } from "@/lib/types";
import type { Food } from "./foods";

export interface Totals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

const ZERO: Totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());

/** Build a FoodItem from a static (JSON) database food + chosen grams. */
export function foodToItem(food: Food, qtyG?: number): FoodItem {
  const base = food.qtyG && food.qtyG > 0 ? food.qtyG : 100;
  const perG = {
    kcal: (food.kcal ?? 0) / base,
    protein: (food.protein ?? 0) / base,
    carbs: (food.carbs ?? 0) / base,
    fat: (food.fat ?? 0) / base,
  };
  return { id: newId(), name: food.name, qtyG: qtyG ?? base, unit: "g", kind: "food", perG };
}

/** Build a FoodItem from a nutritionist's database food (BOO-57). */
export function dbFoodToItem(food: DbFood, qty?: number): FoodItem {
  const base = food.refQty && food.refQty > 0 ? food.refQty : 100;
  const perG = {
    kcal: (food.kcal ?? 0) / base,
    protein: (food.protein ?? 0) / base,
    carbs: (food.carbs ?? 0) / base,
    fat: (food.fat ?? 0) / base,
  };
  return {
    id: newId(),
    name: food.name,
    qtyG: qty ?? base,
    unit: food.baseUnit,
    kind: "food",
    refId: food.id,
    perG,
  };
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
