// ---------------------------------------------------------------------------
// Energy needs — Basal (GEB) + Total (GET) energy expenditure.
// Equations transcribed from the nutritionist's Excel ("Fórmulas" /
// "NECESSIDADES ENERGÉTICAS" sheets). Inputs: kg / cm / years.
// Every formula returns `undefined` when it lacks the data it needs, so the UI
// can render "—" instead of the Excel's #DIV/0! / #NUM! errors. (BOO-55/63/64)
// ---------------------------------------------------------------------------

import type { Sex } from "@/lib/nutrition/calc";

export interface EnergyInput {
  sex?: Sex;
  weightKg?: number;
  heightCm?: number;
  ageYears?: number;
  /** Fat-free / lean mass (kg) — for Cunningham / Tinsley-style formulas. */
  fatFreeMassKg?: number;
}

type Group = "young" | "youngObesity" | "adult";

export interface GebFormula {
  key: string;
  label: string;
  group: Group;
  /** Restrict applicability for auto-suggestion. */
  sex?: Sex;
  minAge?: number;
  maxAge?: number;
  compute: (i: EnergyInput) => number | undefined;
}

const ok = (...xs: (number | undefined)[]) =>
  xs.every((x) => typeof x === "number" && !Number.isNaN(x) && x > 0);

const m = (heightCm?: number) => (heightCm ? heightCm / 100 : undefined);
const KJ_TO_KCAL = 0.2388458966275;

export const GEB_FORMULAS: GebFormula[] = [
  // --- Young 3–18 ----------------------------------------------------------
  {
    key: "schofield_3_10_boy",
    label: "Schofield 3-10 (Rapaz)",
    group: "young",
    sex: "male",
    minAge: 3,
    maxAge: 10,
    compute: ({ weightKg: w, heightCm: h }) =>
      ok(w, h) ? 19.59 * w! + 1.033 * h! + 414.9 : undefined,
  },
  {
    key: "schofield_3_10_girl",
    label: "Schofield 3-10 (Rapariga)",
    group: "young",
    sex: "female",
    minAge: 3,
    maxAge: 10,
    compute: ({ weightKg: w, heightCm: h }) =>
      ok(w, h) ? 16.8 * w! + 1.618 * h! + 371.3 : undefined,
  },
  {
    key: "schofield_10_18_boy",
    label: "Schofield 10-18 (Rapaz)",
    group: "young",
    sex: "male",
    minAge: 10,
    maxAge: 18,
    compute: ({ weightKg: w, heightCm: h }) =>
      ok(w, h) ? 16.25 * w! + 1.373 * h! + 515.5 : undefined,
  },
  {
    key: "schofield_10_18_girl",
    label: "Schofield 10-18 (Rapariga)",
    group: "young",
    sex: "female",
    minAge: 10,
    maxAge: 18,
    compute: ({ weightKg: w, heightCm: h }) =>
      ok(w, h) ? 8.37 * w! + 4.65 * h! + 200 : undefined,
  },
  {
    key: "fao_3_10_boy",
    label: "FAO 3-10 (Rapaz)",
    group: "young",
    sex: "male",
    minAge: 3,
    maxAge: 10,
    compute: ({ weightKg: w }) => (ok(w) ? 22.7 * w! + 495 : undefined),
  },
  {
    key: "fao_3_10_girl",
    label: "FAO 3-10 (Rapariga)",
    group: "young",
    sex: "female",
    minAge: 3,
    maxAge: 10,
    compute: ({ weightKg: w }) => (ok(w) ? 22.5 * w! + 499 : undefined),
  },
  {
    key: "fao_10_18_boy",
    label: "FAO 10-18 (Rapaz)",
    group: "young",
    sex: "male",
    minAge: 10,
    maxAge: 18,
    compute: ({ weightKg: w }) => (ok(w) ? 17.5 * w! + 651 : undefined),
  },
  {
    key: "fao_10_18_girl",
    label: "FAO 10-18 (Rapariga)",
    group: "young",
    sex: "female",
    minAge: 10,
    maxAge: 18,
    compute: ({ weightKg: w }) => (ok(w) ? 12.2 * w! + 746 : undefined),
  },
  // --- Young obesity 3–18 (Lazzer) -----------------------------------------
  {
    key: "lazzer_boy",
    label: "Lazzer Obesidade (Rapaz)",
    group: "youngObesity",
    sex: "male",
    minAge: 3,
    maxAge: 18,
    compute: ({ weightKg: w, heightCm: h, ageYears: a }) =>
      ok(w, h, a)
        ? (892.68 - a! * 115.93 + w! * 54.96 + m(h)! * 1816.23 + 1484.5) * KJ_TO_KCAL
        : undefined,
  },
  {
    key: "lazzer_girl",
    label: "Lazzer Obesidade (Rapariga)",
    group: "youngObesity",
    sex: "female",
    minAge: 3,
    maxAge: 18,
    compute: ({ weightKg: w, heightCm: h, ageYears: a }) =>
      ok(w, h, a)
        ? (0 - a! * 115.93 + w! * 54.96 + m(h)! * 1816.23 + 1484.5) * KJ_TO_KCAL
        : undefined,
  },
  // --- Adults --------------------------------------------------------------
  {
    key: "harris_benedict_men",
    label: "Harris-Benedict (Homens)",
    group: "adult",
    sex: "male",
    minAge: 18,
    compute: ({ weightKg: w, heightCm: h, ageYears: a }) =>
      ok(w, h, a) ? 66.5 + 13.75 * w! + 5 * h! - 6.78 * a! : undefined,
  },
  {
    key: "harris_benedict_women",
    label: "Harris-Benedict (Mulheres)",
    group: "adult",
    sex: "female",
    minAge: 18,
    compute: ({ weightKg: w, heightCm: h, ageYears: a }) =>
      ok(w, h, a) ? 655.0955 + 1.8496 * h! + 9.5634 * w! - 4.6756 * a! : undefined,
  },
  {
    key: "fao_18_29_men",
    label: "FAO 18-29 (Homens)",
    group: "adult",
    sex: "male",
    minAge: 18,
    maxAge: 29,
    compute: ({ weightKg: w, heightCm: h }) =>
      ok(w, h) ? 15.4 * w! - 27 * m(h)! + 717 : undefined,
  },
  {
    key: "fao_18_29_women",
    label: "FAO 18-29 (Mulheres)",
    group: "adult",
    sex: "female",
    minAge: 18,
    maxAge: 29,
    compute: ({ weightKg: w, heightCm: h }) =>
      ok(w, h) ? 13.3 * w! + 334 * m(h)! + 35 : undefined,
  },
  {
    key: "fao_30_65_men",
    label: "FAO 30-65 (Homens)",
    group: "adult",
    sex: "male",
    minAge: 30,
    maxAge: 65,
    compute: ({ weightKg: w, heightCm: h }) =>
      ok(w, h) ? 11.3 * w! + 16 * m(h)! + 901 : undefined,
  },
  {
    key: "fao_30_65_women",
    label: "FAO 30-65 (Mulheres)",
    group: "adult",
    sex: "female",
    minAge: 30,
    maxAge: 65,
    compute: ({ weightKg: w, heightCm: h }) =>
      ok(w, h) ? 8.7 * w! - 25 * m(h)! + 865 : undefined,
  },
  {
    key: "cunningham",
    label: "Cunningham (MLG)",
    group: "adult",
    minAge: 18,
    compute: ({ fatFreeMassKg: ffm }) => (ok(ffm) ? 21.6 * ffm! + 370 : undefined),
  },
];

export function getGebFormula(key: string | undefined): GebFormula | undefined {
  return GEB_FORMULAS.find((f) => f.key === key);
}

/** Pick the most appropriate GEB formula from sex/age (Harris-Benedict default for adults). */
export function suggestGebFormula(i: EnergyInput): string | undefined {
  const { sex, ageYears: a } = i;
  if (!a) return sex === "male" ? "harris_benedict_men" : "harris_benedict_women";
  if (a >= 18) return sex === "male" ? "harris_benedict_men" : "harris_benedict_women";
  // Young
  if (a < 10) return sex === "male" ? "schofield_3_10_boy" : "schofield_3_10_girl";
  return sex === "male" ? "schofield_10_18_boy" : "schofield_10_18_girl";
}

export function geb(key: string | undefined, input: EnergyInput): number | undefined {
  const f = getGebFormula(key);
  if (!f) return undefined;
  const v = f.compute(input);
  return v == null ? undefined : Math.round(v);
}

/** Physical activity level options (PAL Adultos, FAO). */
export const PAL_OPTIONS: { value: number; labelKey: string }[] = [
  { value: 1.2, labelKey: "pal.sedentary" },
  { value: 1.375, labelKey: "pal.light" },
  { value: 1.55, labelKey: "pal.moderate" },
  { value: 1.725, labelKey: "pal.active" },
  { value: 1.9, labelKey: "pal.extreme" },
];

export const DEFAULT_PAL = 1.375;

/** GET = GEB × PAL × stress. */
export function get(
  gebValue: number | undefined,
  pal: number = DEFAULT_PAL,
  stressFactor = 1,
): number | undefined {
  if (gebValue == null) return undefined;
  return Math.round(gebValue * pal * (stressFactor || 1));
}
