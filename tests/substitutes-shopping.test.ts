import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS, searchFoods, type Food } from "@/lib/nutrition/foods";
import { foodToItem, itemTotals } from "@/lib/nutrition/items";
import { candidatePool, findSubstitutes, substituteToItem } from "@/lib/nutrition/substitutes";
import { formatQuantity, shoppingList, shoppingListText } from "@/lib/nutrition/shopping-list";
import type { DbFood, FoodItem, Meal, Recipe } from "@/lib/types";

const food = (name: string, group: string, qtyG: number, kcal: number, protein: number, carbs: number, fat: number): Food => ({
  group, name, portion: "", qtyG, kcal, protein, carbs, fat, sugar: null, satFat: null, fibre: null,
});
const db = (over: Partial<DbFood>): DbFood =>
  ({ id: "d1", nutritionistId: "n", name: "Quinoa", baseUnit: "g", refQty: 100, kcal: 368, protein: 14, carbs: 64, fat: 6, category: "Cereais", createdAt: "2026-01-01", ...over }) as DbFood;

const rice = food("Arroz", "Cereais", 100, 350, 7, 78, 1);
const TABLE = [
  rice,
  food("Arroz (chávena)", "Cereais", 180, 630, 12.6, 140.4, 1.8), // same food, another serving
  food("Massa", "Cereais", 100, 355, 12, 72, 1.5),
  food("Batata", "Tubérculos", 100, 80, 2, 17, 0.1),
  food("Frango", "Carne", 100, 110, 23, 0, 2),
  food("Azeite", "Gorduras", 10, 90, 0, 0, 10),
  food("Água", "Bebidas", 100, 0, 0, 0, 0),
  food("Sem dados", "", 0, null as never, null as never, null as never, null as never),
];

test("candidatePool: the account's foods first, archived ones excluded, values per gram", () => {
  const pool = candidatePool([db({}), db({ id: "d2", name: "Velho", archived: true }), db({ id: "d3", name: "Leite", baseUnit: "mL", refQty: 0, category: "" })], TABLE);
  assert.deepEqual(pool.slice(0, 2).map((c) => [c.name, c.refId, c.unit, c.group]), [["Quinoa", "d1", "g", "Cereais"], ["Leite", "d3", "mL", undefined]]);
  assert.equal(pool[0].per.kcal, 3.68);
  assert.equal(pool.length, 2 + TABLE.length);
  assert.equal(pool.find((c) => c.name === "Azeite")!.per.fat, 1);
  assert.deepEqual(pool.find((c) => c.name === "Sem dados")!.per, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
});

test("findSubstitutes: similar macro profile, same energy, never the food itself", () => {
  const item = foodToItem(rice, 60); // 210 kcal
  const subs = findSubstitutes(item, candidatePool([db({})], TABLE));
  const names = subs.map((s) => s.candidate.name);
  assert.deepEqual(names, ["Massa", "Batata", "Quinoa"], "closest macro profile first; same group and similar serving break ties");
  assert.ok(!names.includes("Arroz") && !names.includes("Arroz (chávena)"), "other servings of the same food are not substitutes");
  assert.ok(!names.includes("Frango") && !names.includes("Azeite"), "different macro profile");

  for (const s of subs) {
    assert.ok(Math.abs(s.totals.kcal - 210) <= 12, `${s.candidate.name}: ${s.totals.kcal} kcal`);
    assert.equal(s.qty % 5, 0);
    assert.equal(Math.round(s.delta.kcal), Math.round(s.totals.kcal - 210));
  }
  assert.equal(subs.find((s) => s.candidate.name === "Batata")!.qty, 265);
  assert.equal(findSubstitutes(item, candidatePool([db({})], TABLE), 1).length, 1);
});

test("findSubstitutes: small servings use whole units; nothing for recipes, empty or unmeasurable items", () => {
  const pool = candidatePool([], TABLE);
  const spoon = findSubstitutes(foodToItem(rice, 4), pool).find((s) => s.candidate.name === "Massa")!;
  assert.equal(spoon.qty, 4);

  const item = foodToItem(rice, 60);
  assert.deepEqual(findSubstitutes({ ...item, kind: "recipe" }, pool), []);
  assert.deepEqual(findSubstitutes({ ...item, qtyG: 0 }, pool), []);
  assert.deepEqual(findSubstitutes({ ...item, perG: { kcal: 0, protein: 0, carbs: 0, fat: 0 } }, pool), []);
  // 5 g of rice would need under 1 g of nothing, and 2 kg of rice over 1 kg of potato.
  assert.ok(!findSubstitutes(foodToItem(rice, 2000), pool).some((s) => s.candidate.name === "Batata"));
});

test("findSubstitutes: an item linked by id excludes its own database food even if renamed", () => {
  const pool = candidatePool([db({})], TABLE);
  const item: FoodItem = { id: "i", name: "Quinoa real", qtyG: 50, unit: "g", kind: "food", refId: "d1", perG: pool[0].per };
  assert.ok(!findSubstitutes(item, pool).some((s) => s.candidate.refId === "d1"));
});

test("substituteToItem keeps the item's place and carries the new food's values", () => {
  const item = foodToItem(rice, 60);
  const [best] = findSubstitutes(item, candidatePool([db({})], TABLE));
  const next = substituteToItem(item, best);
  assert.equal(next.id, item.id);
  assert.deepEqual([next.name, next.qtyG, next.unit, next.kind, next.refId], ["Massa", 60, "g", "food", undefined]);
  assert.equal(itemTotals(next).kcal, best.totals.kcal);
});

test("findSubstitutes on the real food table returns sensible bread swaps", () => {
  const bread = searchFoods("Pão de trigo")[0];
  const subs = findSubstitutes(foodToItem(bread), candidatePool([], FOODS));
  assert.ok(subs.length >= 3);
  assert.ok(subs.every((s) => Math.abs(s.delta.kcal) < 15));
});

// --- Shopping list -----------------------------------------------------------
const item = (name: string, qtyG: number, over: Partial<FoodItem> = {}): FoodItem => ({ id: name, name, qtyG, unit: "g", kind: "food", perG: { kcal: 1, protein: 0, carbs: 0, fat: 0 }, ...over });
const yogurt = db({ id: "y", name: "Iogurte", baseUnit: "g", category: "Lácteos" });
const milk = db({ id: "m", name: "Leite", baseUnit: "mL", category: "Lácteos" });
const pancakes = { id: "r1", name: "Panquecas", servings: 4, items: [{ id: "a", foodId: "m", name: "Leite", qty: 200 }, { id: "b", foodId: "gone", name: "Ovo", qty: 120 }] } as Recipe;
const meals = [
  {
    id: "m1",
    name: "PA",
    options: [
      { id: "o1", content: "", items: [item("Arroz", 60), item("iogurte", 125, { refId: "y" }), item("Panquecas", 2, { kind: "recipe", refId: "r1", unit: "porção" })] },
      { id: "o2", content: "", items: [item("Massa", 70)] },
      { id: "o3", content: "só texto" },
    ],
  },
  { id: "m2", name: "Jantar", options: [{ id: "o4", content: "", items: [item("Arroz", 43), item("Mistério", 3, { kind: "recipe", refId: "zz", unit: "porção" }), item("Nada", 0)] }] },
  { id: "m3", name: "Ceia", options: [] },
] as unknown as Meal[];
const ctx = { dbFoods: [yogurt, milk], recipes: [pancakes], staticFoods: TABLE };
const flat = (groups: ReturnType<typeof shoppingList>) => Object.fromEntries(groups.flatMap((g) => g.lines.map((l) => [l.name, `${l.qty} ${l.unit} @${g.group}`])));

test("shoppingList: adds up the first option of each meal, expands recipes, groups and rounds up", () => {
  const groups = shoppingList(meals, { days: 7, scope: "first", ...ctx });
  assert.deepEqual(groups.map((g) => g.group), ["Cereais", "Lácteos", ""], "ungrouped foods come last");
  assert.deepEqual(flat(groups), {
    Arroz: "725 g @Cereais", // (60 + 43) × 7 = 721 → 725
    iogurte: "875 g @Lácteos",
    Leite: "700 mL @Lácteos", // 2 portions × 7 days ÷ 4 servings × 200 mL
    Ovo: "420 g @", // ingredient no longer in the database: snapshot name, grams
    Mistério: "21 porção @", // recipe no longer exists: kept as portions
  });
});

test("shoppingList: alternating options splits the days between them", () => {
  const groups = shoppingList(meals, { days: 7, scope: "all", ...ctx });
  const lines = flat(groups);
  assert.equal(lines.Massa, "245 g @Cereais"); // 70 × 3.5
  assert.equal(lines.Arroz, "515 g @Cereais"); // 60 × 3.5 + 43 × 7 = 511 → 515
  assert.equal(lines.Leite, "350 mL @Lácteos");
  assert.deepEqual(shoppingList([], { days: 7, scope: "first" }), []);
  assert.deepEqual(shoppingList(meals.slice(2), { days: 7, scope: "all" }), []);
  // Without the databases everything still lists, ungrouped.
  assert.deepEqual(shoppingList(meals, { days: 1, scope: "first" }).map((g) => g.group), [""]);
  // Small quantities round up to whole units, portions to halves.
  const small = [{ id: "m", name: "x", options: [{ id: "o", content: "", items: [item("Sal", 1.2), item("Bolo", 0.3, { unit: "porção" })] }] }] as unknown as Meal[];
  assert.deepEqual(flat(shoppingList(small, { days: 1, scope: "first" })), { Sal: "2 g @", Bolo: "0.5 porção @" });
  // A recipe with no servings set counts as one serving.
  const single = shoppingList([{ id: "m", name: "x", options: [{ id: "o", content: "", items: [item("P", 1, { kind: "recipe", refId: "r1", unit: "porção" })] }] }] as unknown as Meal[], {
    days: 1,
    scope: "first",
    dbFoods: [milk],
    recipes: [{ ...pancakes, servings: 0 }],
  });
  assert.equal(flat(single).Leite, "200 mL @Lácteos");
});

test("formatQuantity and shoppingListText", () => {
  assert.equal(formatQuantity(250, "g", "pt-PT"), "250 g");
  assert.equal(formatQuantity(1500, "g", "pt-PT"), "1,5 kg");
  assert.equal(formatQuantity(2000, "mL", "en"), "2 L");
  assert.equal(formatQuantity(3, "porção", "pt-PT"), "3 porção");
  assert.equal(formatQuantity(1.5, "porção", "en", (n) => (n === 1 ? "portion" : "portions")), "1.5 portions");

  const text = shoppingListText(shoppingList(meals, { days: 7, scope: "first", ...ctx }), { title: "Lista — 7 dias", otherGroup: "Outros", locale: "pt-PT" });
  assert.ok(text.startsWith("Lista — 7 dias\n\nCEREAIS\n☐ Arroz — 725 g\n\nLÁCTEOS\n☐ iogurte — 875 g\n☐ Leite — 700 mL\n\nOUTROS\n"));
  assert.match(text, /☐ Mistério — 21 porção/);
});
