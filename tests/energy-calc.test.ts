import { test } from "node:test";
import assert from "node:assert/strict";
import { FFM_FORMULAS, GEB_FORMULAS, geb, get, getGebFormula, isApplicable, suggestGebFormula } from "@/lib/nutrition/energy";
import { bmi, bmiClass, macros, targetKcal } from "@/lib/nutrition/calc";
import { computeBmi, emptyMeasurements, heightCmOf, normalizeMeasurements, sumPerimeters, sumSkinfolds, byNewest } from "@/lib/types";

test("every GEB formula gives a plausible value with complete data, for both sexes", () => {
  for (const sex of ["male", "female"] as const) {
    for (const f of GEB_FORMULAS) {
      const ageYears = f.minAge != null && f.minAge < 18 ? Math.max(f.minAge, 8) : 35;
      const young = ageYears < 18;
      const v = geb(f.key, { sex, ageYears, weightKg: young ? 35 : 70, heightCm: young ? 135 : 172, fatFreeMassKg: 55 });
      assert.ok(typeof v === "number" && v > 600 && v < 3000, `${f.key} (${sex}) → ${v}`);
      assert.equal(v, Math.round(v));
    }
  }
});

test("GEB formulas need every input they use (and a sex where the equation has one)", () => {
  const full = { weightKg: 70, heightCm: 172, ageYears: 35 };
  assert.equal(geb("mifflin_st_jeor", full), undefined);
  assert.equal(geb("ten_haaf", full), undefined);
  assert.equal(geb("mifflin_st_jeor", { ...full, sex: "male", weightKg: 0 }), undefined);
  assert.equal(geb("harris_benedict_men", { ...full, heightCm: Number.NaN }), undefined);
  assert.equal(geb("no_such_formula", full), undefined);
  assert.equal(geb(undefined, full), undefined);
  assert.equal(getGebFormula("cunningham")?.group, "adult");
  for (const key of FFM_FORMULAS) assert.equal(geb(key, full), undefined, `${key} needs fat-free mass`);
});

test("formula suggestion covers adults, athletes and both young age bands", () => {
  assert.equal(suggestGebFormula({}), "harris_benedict_women");
  assert.equal(suggestGebFormula({ sex: "male" }), "harris_benedict_men");
  assert.equal(suggestGebFormula({ athlete: true }), "ten_haaf");
  assert.equal(suggestGebFormula({ sex: "female", ageYears: 6 }), "schofield_3_10_girl");
  assert.equal(suggestGebFormula({ sex: "male", ageYears: 14 }), "schofield_10_18_boy");
  assert.equal(suggestGebFormula({ sex: "female", ageYears: 14 }), "schofield_10_18_girl");
  for (const i of [{}, { sex: "male" as const, ageYears: 6 }, { sex: "female" as const, ageYears: 14, athlete: true }]) {
    assert.ok(getGebFormula(suggestGebFormula(i)), "suggestion must be a real formula");
  }
});

test("applicability: age bands and sex; unknown age or sex never excludes", () => {
  const young = getGebFormula("schofield_3_10_boy")!;
  assert.equal(isApplicable(young, { sex: "male", ageYears: 5 }), true);
  assert.equal(isApplicable(young, { sex: "male", ageYears: 2 }), false);
  assert.equal(isApplicable(young, { sex: "male", ageYears: 11 }), false);
  assert.equal(isApplicable(young, { sex: "female", ageYears: 5 }), false);
  assert.equal(isApplicable(young, {}), true);
  assert.equal(isApplicable(getGebFormula("mifflin_st_jeor")!, { sex: "female", ageYears: 80 }), true);
  assert.equal(isApplicable(getGebFormula("mifflin_st_jeor")!, { ageYears: 12 }), false);
});

test("GET defaults: light activity, no stress factor", () => {
  assert.equal(get(1600), 2200);
  assert.equal(get(1600, 1.2, 0), 1920);
});

test("plan target, macro split and BMI classes", () => {
  assert.equal(targetKcal(2000, "loss"), 1600);
  assert.equal(targetKcal(2000, "maintain"), 2000);
  assert.equal(targetKcal(2000, "gain"), 2300);

  const split = { proteinPct: 20, carbsPct: 50, fatPct: 30 };
  assert.equal(macros(2000, split).protein.gPerKg, undefined);
  assert.equal(macros(2000, split, 80).protein.gPerKg, 1.3);
  assert.equal(macros(2000, split, 80).fat.kcal, 600);

  assert.equal(bmi(undefined, 170), undefined);
  assert.equal(bmi(70, undefined), undefined);
  assert.equal(bmi(70, 175), 22.9);
  assert.deepEqual(
    [undefined, 17, 22, 27, 32, 37, 42].map(bmiClass),
    ["unknown", "underweight", "normal", "overweight", "obese1", "obese2", "obese3"],
  );
});

test("measurement helpers tolerate missing and legacy data", () => {
  assert.equal(heightCmOf(undefined), undefined);
  assert.equal(heightCmOf({}), undefined);
  assert.equal(heightCmOf({ heightCm: 0, heightM: 0 }), undefined);
  assert.equal(heightCmOf({ heightM: 1.72 }), 172);
  assert.equal(heightCmOf({ heightM: 172 }), 172);
  assert.deepEqual(normalizeMeasurements(null), { heightCm: undefined, perimeters: {}, skinfolds: {} });
  assert.deepEqual(normalizeMeasurements({ weightKg: 70, heightM: 1.7, perimeters: { waist: 80 } }), {
    weightKg: 70,
    heightCm: 170,
    perimeters: { waist: 80 },
    skinfolds: {},
  });
  assert.equal(computeBmi(undefined), undefined);
  assert.equal(computeBmi({ weightKg: 70 }), undefined);
  assert.equal(computeBmi({ heightCm: 170 }), undefined);
  assert.equal(computeBmi({ weightKg: 70, heightCm: 175 }), 22.9);

  const m = { ...emptyMeasurements(), perimeters: { waist: 80.25, hip: 95, arm: undefined }, skinfolds: { tricipital: Number.NaN } };
  assert.equal(sumPerimeters(m), 175.3);
  assert.equal(sumSkinfolds(m), undefined);
  assert.equal(sumSkinfolds(emptyMeasurements()), undefined);

  const rows = [{ date: "2026-01-01" }, { date: "2026-02-01", createdAt: "b" }, { date: "2026-02-01", createdAt: "c" }, { date: "2026-02-01" }];
  assert.deepEqual([...rows].sort(byNewest).map((r) => r.createdAt ?? r.date), ["c", "b", "2026-02-01", "2026-01-01"]);
});
