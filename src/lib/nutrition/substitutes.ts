// ---------------------------------------------------------------------------
// Food substitutions — "what can I have instead of this?"
//
// A substitute is a food with a similar macronutrient profile (share of energy
// from protein / carbohydrate / fat), served in the quantity that provides the
// same energy as the original. No AI: it is a nearest-neighbour search over
// the nutritionist's own foods and the built-in composition table.
// ---------------------------------------------------------------------------

import type { DbFood, FoodItem } from "@/lib/types";
import { normalizeSearch } from "@/lib/utils";
import type { Food } from "./foods";
import { itemTotals, type Totals } from "./items";

type PerUnit = FoodItem["perG"];

export interface Candidate {
  name: string;
  /** Food group / category, when known. */
  group?: string;
  unit: "g" | "mL";
  /** Nutrition per 1 g (or mL). */
  per: PerUnit;
  /** Id in the nutritionist's food database, when it comes from there. */
  refId?: string;
}

export interface Substitute {
  candidate: Candidate;
  /** Quantity that matches the original's energy. */
  qty: number;
  totals: Totals;
  /** Substitute minus original. */
  delta: Totals;
  /** 0 = identical macro profile; lower is better. */
  score: number;
}

const perUnit = (f: { kcal?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null }, base: number): PerUnit => ({
  kcal: (f.kcal ?? 0) / base,
  protein: (f.protein ?? 0) / base,
  carbs: (f.carbs ?? 0) / base,
  fat: (f.fat ?? 0) / base,
});

/** Everything a food can be swapped for: the account's own foods first, then the built-in table. */
export function candidatePool(dbFoods: DbFood[], staticFoods: Food[]): Candidate[] {
  return [
    ...dbFoods
      .filter((f) => !f.archived)
      .map((f) => ({ name: f.name, group: f.category || undefined, unit: f.baseUnit, per: perUnit(f, f.refQty > 0 ? f.refQty : 100), refId: f.id })),
    ...staticFoods.map((f) => ({ name: f.name, group: f.group || undefined, unit: "g" as const, per: perUnit(f, f.qtyG && f.qtyG > 0 ? f.qtyG : 100) })),
  ];
}

/** Share of energy from protein, carbohydrate and fat (sums to 1). */
function shares(per: PerUnit): [number, number, number] | undefined {
  const [p, c, f] = [per.protein * 4, per.carbs * 4, per.fat * 9];
  const sum = p + c + f;
  return sum > 0 ? [p / sum, c / sum, f / sum] : undefined;
}

/** Same food, whatever the serving: per-100 values rounded to the unit. */
const profileKey = (per: PerUnit) => [per.kcal, per.protein, per.carbs, per.fat].map((v) => Math.round(v * 100)).join("|");

/** Quantities people can measure: steps of 5 above 20, whole units below. */
const practical = (qty: number) => (qty >= 20 ? Math.round(qty / 5) * 5 : Math.round(qty));

const MAX_DISTANCE = 0.2;

/**
 * Foods that can replace `item`, best match first. Each comes with the
 * quantity that gives the same energy. Recipes and foods without energy have
 * no substitutes.
 */
export function findSubstitutes(item: FoodItem, pool: Candidate[], limit = 8): Substitute[] {
  const original = itemTotals(item);
  const target = shares(item.perG);
  if (item.kind === "recipe" || !target || original.kcal <= 0 || item.qtyG <= 0) return [];

  const name = normalizeSearch(item.name);
  const self = pool.find((c) => (item.refId && c.refId === item.refId) || normalizeSearch(c.name) === name);
  const seen = new Set([profileKey(item.perG)]);
  const found: Substitute[] = [];

  for (const candidate of pool) {
    const profile = shares(candidate.per);
    if (!profile || candidate.per.kcal <= 0 || candidate === self) continue;
    const distance = profile.reduce((sum, share, i) => sum + Math.abs(share - target[i]), 0) / 2;
    if (distance > MAX_DISTANCE) continue;
    const qty = practical(original.kcal / candidate.per.kcal);
    if (qty < 1 || qty > 1000) continue;
    const key = profileKey(candidate.per);
    if (seen.has(key)) continue;
    seen.add(key);

    const totals = itemTotals({ ...item, qtyG: qty, perG: candidate.per });
    // Prefer the same food group, and servings of a similar size.
    const sameGroup = Boolean(self?.group && candidate.group === self.group);
    const score = distance + 0.03 * Math.abs(Math.log(qty / item.qtyG)) - (sameGroup ? 0.05 : 0);
    found.push({
      candidate,
      qty,
      totals,
      delta: { kcal: totals.kcal - original.kcal, protein: totals.protein - original.protein, carbs: totals.carbs - original.carbs, fat: totals.fat - original.fat },
      score,
    });
  }
  return found.sort((a, b) => a.score - b.score || a.candidate.name.localeCompare(b.candidate.name)).slice(0, limit);
}

/** The plan item that replaces `original` with `substitute` (same position, same id). */
export function substituteToItem(original: FoodItem, substitute: Substitute): FoodItem {
  const { candidate, qty } = substitute;
  return { id: original.id, name: candidate.name, qtyG: qty, unit: candidate.unit, kind: "food", refId: candidate.refId, perG: candidate.per };
}
