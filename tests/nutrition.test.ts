import { test } from "node:test";
import assert from "node:assert/strict";
import { geb, get, suggestGebFormula, isApplicable, GEB_FORMULAS } from "@/lib/nutrition/energy";
import { bodyFatPercent, muscleMassKg } from "@/lib/nutrition/body-composition";
import { macros, bmi, bmiClass, targetKcal } from "@/lib/nutrition/calc";
import { cloneMeals, planTotals, recipeTotals, formatItem } from "@/lib/nutrition/items";
import { computeBmi, heightCmOf, normalizeMeasurements, sumSkinfolds, byNewest } from "@/lib/types";

const adultMan = { sex: "male" as const, weightKg: 80, heightCm: 180, ageYears: 30 };

test("Harris-Benedict and Mifflin-St Jeor match their published equations", () => {
  assert.equal(geb("harris_benedict_men", adultMan), Math.round(66.5 + 13.75 * 80 + 5 * 180 - 6.78 * 30));
  assert.equal(geb("mifflin_st_jeor", adultMan), 10 * 80 + 6.25 * 180 - 5 * 30 + 5);
  assert.equal(geb("mifflin_st_jeor", { ...adultMan, sex: "female" }), 10 * 80 + 6.25 * 180 - 5 * 30 - 161);
});

test("Ten Haaf and FFM-based formulas", () => {
  assert.equal(geb("ten_haaf", adultMan), Math.round(11.936 * 80 + 587.728 * 1.8 - 8.129 * 30 + 191.027 + 29.279));
  assert.equal(geb("cunningham", { fatFreeMassKg: 65 }), Math.round(21.6 * 65 + 370));
  assert.equal(geb("ten_haaf_ffm", { fatFreeMassKg: 65 }), Math.round(22.771 * 65 + 484.264));
  assert.equal(geb("cunningham", adultMan), undefined, "no FFM → undefined, never NaN");
});

test("formulas return undefined (not NaN) when inputs are missing", () => {
  for (const f of GEB_FORMULAS) {
    const v = geb(f.key, {});
    assert.ok(v === undefined, `${f.key} returned ${v}`);
  }
});

test("GET = GEB × PAL × stress; formula suggestion and applicability", () => {
  assert.equal(get(1800, 1.55), 2790);
  assert.equal(get(1800, 1.55, 1.2), Math.round(1800 * 1.55 * 1.2));
  assert.equal(get(undefined, 1.55), undefined);
  assert.equal(suggestGebFormula({ sex: "female", ageYears: 40 }), "harris_benedict_women");
  assert.equal(suggestGebFormula({ sex: "male", ageYears: 25, athlete: true }), "ten_haaf");
  assert.equal(suggestGebFormula({ sex: "male", ageYears: 8 }), "schofield_3_10_boy");
  const fao30 = GEB_FORMULAS.find((f) => f.key === "fao_30_65_women")!;
  assert.equal(isApplicable(fao30, { sex: "female", ageYears: 40 }), true);
  assert.equal(isApplicable(fao30, { sex: "male", ageYears: 40 }), false);
});

test("body fat: Deurenberg (adult women) and average of available formulas", () => {
  const r = bodyFatPercent({ sex: "female", ageYears: 30, weightKg: 60, heightCm: 165, skinfolds: {}, perimeters: {} });
  const deurenberg = r.results.find((x) => x.key === "deurenberg")!;
  const expected = Math.round((1.2 * (60 / 1.65 ** 2) + 0.23 * 30 - 5.4) * 10) / 10;
  assert.equal(deurenberg.value, expected);
  assert.equal(r.average, expected, "only Deurenberg has data → average equals it");
});

test("Lee weight-based muscle mass uses +1.4 for African-American ethnicity", () => {
  const base = { sex: "male" as const, ageYears: 30, weightKg: 80, heightCm: 180, skinfolds: {}, perimeters: {} };
  const white = muscleMassKg({ ...base, ethnicity: "white" }).results.find((x) => x.key === "lee_weight")!.value!;
  const black = muscleMassKg({ ...base, ethnicity: "black" }).results.find((x) => x.key === "lee_weight")!.value!;
  assert.equal(Math.round((black - white) * 10) / 10, 1.4);
});

test("macro split and BMI helpers", () => {
  const m = macros(2000, { proteinPct: 15, carbsPct: 55, fatPct: 30 }, 80);
  assert.deepEqual([m.protein.grams, m.carbs.grams, m.fat.grams], [75, 275, 67]);
  assert.equal(m.protein.gPerKg, 0.9);
  assert.equal(bmi(80, 180), 24.7);
  assert.equal(bmiClass(24.7), "normal");
  assert.equal(bmiClass(31), "obese1");
  assert.equal(targetKcal(2500, "loss"), 2000);
});

test("height normalisation: legacy metres, cm typed into heightM, canonical cm", () => {
  assert.equal(heightCmOf({ heightM: 1.64 } as never), 164);
  assert.equal(heightCmOf({ heightM: 170 } as never), 170);
  assert.equal(heightCmOf({ heightCm: 178, heightM: 1.5 } as never), 178);
  assert.equal(computeBmi({ weightKg: 54, heightM: 1.64, perimeters: {}, skinfolds: {} }), 20.1);
  assert.equal(computeBmi({ weightKg: 54, heightCm: 164, perimeters: {}, skinfolds: {} }), 20.1);
  const n = normalizeMeasurements({ heightM: 1.7 } as never);
  assert.equal(n.heightCm, 170);
  assert.equal("heightM" in n, false);
  assert.deepEqual(n.perimeters, {});
  assert.equal(sumSkinfolds({ perimeters: {}, skinfolds: { tricipital: 10.2, crural: 5.1 } }), 15.3);
});

test("byNewest sorts by date then creation time (same-day consultations)", () => {
  const list = [
    { id: "a", date: "2026-01-01", createdAt: "2026-01-01T09:00:00Z" },
    { id: "b", date: "2026-03-01", createdAt: "2026-03-01T09:00:00Z" },
    { id: "c", date: "2026-03-01", createdAt: "2026-03-01T15:00:00Z" },
  ].sort(byNewest);
  assert.deepEqual(list.map((x) => x.id), ["c", "b", "a"]);
});

test("cloneMeals gives fresh ids and keeps food items (duplicating used to drop them)", () => {
  const meals = [
    {
      id: "m1",
      name: "Almoço",
      time: "13:00",
      options: [{ id: "o1", content: "x", items: [{ id: "i1", name: "Arroz", qtyG: 100, perG: { kcal: 1.3, protein: 0.03, carbs: 0.28, fat: 0 } }] }],
    },
  ];
  const copy = cloneMeals(meals);
  assert.notEqual(copy[0].id, "m1");
  assert.notEqual(copy[0].options[0].id, "o1");
  assert.notEqual(copy[0].options[0].items![0].id, "i1");
  assert.equal(copy[0].time, "13:00");
  assert.equal(planTotals(copy).kcal, 130);
  copy[0].options[0].items![0].perG.kcal = 99;
  assert.equal(meals[0].options[0].items[0].perG.kcal, 1.3, "deep copy");
  assert.equal(formatItem(meals[0].options[0].items[0]), "100 g Arroz");
});

test("recipe totals per portion", () => {
  const foods = [{ id: "f", nutritionistId: "n", name: "Aveia", baseUnit: "g" as const, refQty: 100, kcal: 389, protein: 17, carbs: 66, fat: 7, createdAt: "" }];
  const { total, perPortion } = recipeTotals(
    { id: "r", nutritionistId: "n", name: "Papas", servings: 2, items: [{ id: "i", foodId: "f", name: "Aveia", qty: 80 }], createdAt: "" },
    foods,
  );
  assert.equal(Math.round(total.kcal), 311);
  assert.equal(Math.round(perPortion.kcal), 156);
});
