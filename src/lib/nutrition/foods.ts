import foodsData from "./foods.json";

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

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Case/accent-insensitive search by name, optionally filtered by group. */
export function searchFoods(query: string, group?: string, limit = 100): Food[] {
  const q = normalize(query.trim());
  return FOODS.filter(
    (f) => (!group || f.group === group) && (!q || normalize(f.name).includes(q)),
  ).slice(0, limit);
}
