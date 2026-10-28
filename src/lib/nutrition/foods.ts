import foodsData from "./foods.json";
import { normalizeSearch as normalize } from "@/lib/utils";

export interface Food {
  group: string;
  name: string;
  portion: string;
  qtyG: number | null;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  sugar: number | null;
  satFat: number | null;
  fibre: number | null;
}

// Food composition database imported from the nutritionist's Excel.
export const FOODS = foodsData as Food[];

export function foodGroups(): string[] {
  return [...new Set(FOODS.map((f) => f.group).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}


/** Case/accent-insensitive search by name, optionally filtered by group. */
export function searchFoods(query: string, group?: string, limit = 100): Food[] {
  const q = normalize(query.trim());
  return FOODS.filter(
    (f) => (!group || f.group === group) && (!q || normalize(f.name).includes(q)),
  ).slice(0, limit);
}

// --- Built-in foods as recipe ingredients ----------------------------------------
type NewDbFood = { name: string; baseUnit: "g"; refQty: number; kcal: number; protein: number; carbs: number; fat: number; category?: string };

/** Ids of built-in foods offered next to the account's own foods. */
export const BUILT_IN_PREFIX = "builtin:";

/** The built-in table in the shape of the account's foods (only entries with energy data). */
export function builtInFoods(): (NewDbFood & { id: string })[] {
  return FOODS.flatMap((f, i) =>
    f.kcal == null
      ? []
      : [{ id: `${BUILT_IN_PREFIX}${i}`, name: f.name, baseUnit: "g" as const, refQty: f.qtyG && f.qtyG > 0 ? f.qtyG : 100, kcal: f.kcal, protein: f.protein ?? 0, carbs: f.carbs ?? 0, fat: f.fat ?? 0, category: f.group || undefined }],
  );
}

/** The built-in food behind an id from builtInFoods(), ready to be saved as an own food. */
export function builtInFood(id: string): NewDbFood | undefined {
  if (!id.startsWith(BUILT_IN_PREFIX)) return undefined;
  const hit = builtInFoods().find((f) => f.id === id);
  if (!hit) return undefined;
  const { id: _id, ...food } = hit;
  return food;
}
