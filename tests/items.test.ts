import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dbFoodToItem,
  foodToItem,
  formatItem,
  hasItems,
  itemWeight,
  itemTotals,
  mealTotals,
  optionTotals,
  planTotals,
  recipeToItem,
  recipeTotals,
  roundTotals,
  sumTotals,
} from "@/lib/nutrition/items";
import { FOODS, foodGroups, searchFoods, type Food } from "@/lib/nutrition/foods";
import { METS, metCategories, metKcal, searchMets } from "@/lib/nutrition/mets";
import type { DbFood, Meal, Recipe } from "@/lib/types";

const oats: Food = { group: "Cereais", name: "Aveia", portion: "40 g", qtyG: 40, kcal: 152, protein: 5.2, carbs: 24, fat: 2.8, sugar: null, satFat: null, fibre: null };
const yogurt = { id: "f1", nutritionistId: "n", name: "Iogurte", baseUnit: "g", refQty: 125, kcal: 75, protein: 5, carbs: 6, fat: 3, archived: false, createdAt: "2026-01-01" } as unknown as DbFood;
const dbFood = (over: Partial<DbFood>): DbFood => ({ ...yogurt, ...over });

test("foodToItem: one row of the table is one portion; quantity is a number of portions", () => {
  const item = foodToItem(oats);
  assert.deepEqual([item.qtyG, item.unit, item.kind, item.portionG], [1, "porção", "food", 40]);
  assert.deepEqual(roundTotals(itemTotals(item)), { kcal: 152, protein: 5, carbs: 24, fat: 3 });
  // 1,5 portions = 1,5 × the row's values, like the Excel's "Quantidade" column.
  assert.equal(itemTotals(foodToItem(oats, 1.5)).kcal, 228);
  assert.deepEqual(itemWeight(foodToItem(oats, 1.5)), { qty: 60, unit: "g" });

  const bare = foodToItem({ ...oats, qtyG: null, kcal: null, protein: null, carbs: null, fat: null });
  assert.equal(bare.qtyG, 1);
  assert.equal(bare.portionG, undefined);
  assert.deepEqual(itemTotals(bare), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  // "Equivalentes" count equivalents in the quantity column, not grams.
  const meat = foodToItem({ ...oats, group: "Equivalentes", name: "100gr de carne cozinhada OU 4 Ovos", qtyG: 4, kcal: 169.2 });
  assert.equal(meat.portionG, undefined);
  assert.equal(itemWeight(meat), undefined);
  assert.equal(itemTotals(meat).kcal, 169.2);
});

test("dbFoodToItem: 1 portion = the food's reference quantity; keeps unit and reference id", () => {
  const item = dbFoodToItem(dbFood({}), 2);
  assert.deepEqual([item.refId, item.unit, item.portionG, item.portionUnit], ["f1", "porção", 125, "g"]);
  assert.equal(itemTotals(item).kcal, 150);
  assert.equal(dbFoodToItem(dbFood({})).qtyG, 1);
  assert.deepEqual(itemWeight(dbFoodToItem(dbFood({ baseUnit: "mL" }), 0.5)), { qty: 62.5, unit: "mL" });

  const empty = dbFoodToItem(dbFood({ refQty: 0, kcal: undefined, protein: undefined, carbs: undefined, fat: undefined }));
  assert.equal(empty.portionG, undefined);
  assert.deepEqual(itemTotals(empty), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
});

test("recipes: totals skip unknown foods, portions default to 1, recipeToItem is per portion", () => {
  const foods = [dbFood({}), dbFood({ id: "f2", refQty: 0, kcal: 400, protein: 10, carbs: 60, fat: 12 }), dbFood({ id: "f3", kcal: undefined, protein: undefined, carbs: undefined, fat: undefined })];
  const recipe = {
    id: "r1",
    name: "Papas",
    servings: 2,
    items: [
      { foodId: "f1", qty: 250 },
      { foodId: "f2", qty: 50 },
      { foodId: "f3", qty: 10 },
      { foodId: "missing", qty: 100 },
      { foodId: "f1", qty: 0 },
    ],
  } as unknown as Recipe;
  const { total, perPortion } = recipeTotals(recipe, foods);
  assert.equal(total.kcal, 150 + 200);
  assert.equal(perPortion.kcal, 175);
  assert.equal(recipeTotals({ ...recipe, servings: 0 }, foods).perPortion.kcal, 350);

  const item = recipeToItem(recipe, foods, 2);
  assert.equal(item.kind, "recipe");
  assert.equal(item.unit, "porção");
  assert.equal(itemTotals(item).kcal, 350);
  assert.equal(recipeToItem(recipe, foods).qtyG, 1);
});

test("meal, option and plan totals use the first option of each meal", () => {
  const a = foodToItem(oats);
  const b = dbFoodToItem(dbFood({}));
  const meals = [
    { id: "m1", name: "PA", options: [{ id: "o1", text: "", items: [a, b] }, { id: "o2", text: "", items: [a] }] },
    { id: "m2", name: "Almoço", options: [{ id: "o3", text: "livre" }] },
    { id: "m3", name: "Ceia", options: [] },
  ] as unknown as Meal[];
  assert.equal(Math.round(optionTotals(meals[0].options[0]).kcal), 227);
  assert.equal(Math.round(mealTotals(meals[0]).kcal), 227);
  assert.deepEqual(mealTotals(meals[2]), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  assert.equal(Math.round(planTotals(meals).kcal), 227);
  assert.deepEqual(sumTotals([]), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  assert.equal(hasItems(meals), true);
  assert.equal(hasItems(meals.slice(1)), false);
});

test("formatItem: portions with their weight, recipes, older gram items, decimals", () => {
  const item = foodToItem(oats);
  assert.equal(formatItem(item), "1 × Aveia (40 g)");
  assert.equal(formatItem({ ...item, qtyG: 1.5 }), "1,5 × Aveia (60 g)");
  assert.equal(formatItem({ ...item, qtyG: 1.5 }, "portion", "."), "1.5 × Aveia (60 g)");
  assert.equal(formatItem({ ...item, qtyG: 2, portionG: undefined }), "2 × Aveia");
  assert.equal(formatItem({ ...item, kind: "recipe", qtyG: 2 }, "serving"), "2 serving Aveia");
  // Items saved before portions keep their grams.
  const legacy = { ...item, unit: "g" as const, qtyG: 40, portionG: undefined };
  assert.equal(formatItem(legacy), "40 g Aveia");
  assert.equal(formatItem({ ...legacy, qtyG: 12.345 }, "porção", "."), "12.35 g Aveia");
  assert.equal(formatItem({ ...legacy, unit: undefined }), "40 g Aveia");
  assert.deepEqual(itemWeight(legacy), { qty: 40, unit: "g" });
});

test("food database: groups and accent-insensitive search", () => {
  assert.ok(FOODS.length > 100);
  const groups = foodGroups();
  assert.ok(groups.length > 1);
  assert.deepEqual(groups, [...groups].sort((x, y) => x.localeCompare(y)));
  assert.equal(searchFoods("", undefined, 5).length, 5);
  const inGroup = searchFoods("", groups[0]);
  assert.ok(inGroup.length > 0 && inGroup.every((f) => f.group === groups[0]));
  const target = FOODS.find((f) => /[ãáçé]/.test(f.name))!;
  const plain = target.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  assert.ok(searchFoods(`  ${plain} `).some((f) => f.name === target.name));
  assert.deepEqual(searchFoods("zzzz-no-such-food"), []);
});

test("METs: categories, search by activity or category, and energy spent", () => {
  assert.ok(METS.length > 100);
  const categories = metCategories();
  assert.ok(categories.length > 1);
  assert.equal(searchMets("", undefined, 3).length, 3);
  assert.ok(searchMets("", categories[0]).every((m) => m.category === categories[0]));
  assert.ok(searchMets(METS[0].activity.slice(0, 6)).length > 0);
  assert.ok(searchMets(categories[0]).length > 0);
  assert.deepEqual(searchMets("zzzz-no-such-activity"), []);
  assert.equal(metKcal(8, 70, 30), 280);
});

test("built-in foods can be used as recipe ingredients and copied into the account", async () => {
  const { BUILT_IN_PREFIX, builtInFood, builtInFoods } = await import("@/lib/nutrition/foods");
  const all = builtInFoods();
  assert.ok(all.length > 100 && all.length <= FOODS.length);
  assert.ok(all.every((f) => f.id.startsWith(BUILT_IN_PREFIX) && f.refQty > 0 && typeof f.kcal === "number"));
  const first = all[0];
  const copy = builtInFood(first.id)!;
  assert.deepEqual(copy, { name: first.name, baseUnit: "g", refQty: first.refQty, kcal: first.kcal, protein: first.protein, carbs: first.carbs, fat: first.fat, category: first.category });
  assert.equal("id" in copy, false);
  assert.equal(builtInFood("some-db-id"), undefined);
  assert.equal(builtInFood(`${BUILT_IN_PREFIX}999999`), undefined);
  // Usable directly in recipe totals before the recipe is saved.
  const recipe = { id: "r", name: "x", servings: 1, items: [{ id: "i", foodId: first.id, name: first.name, qty: first.refQty }] } as unknown as Recipe;
  assert.equal(recipeTotals(recipe, all as unknown as DbFood[]).total.kcal, first.kcal);
});
