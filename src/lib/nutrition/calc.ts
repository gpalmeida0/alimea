// ---------------------------------------------------------------------------
// Nutrition calculators — reproduces the formulas from the nutritionist's Excel.
// All standard, validated equations. Inputs in kg / cm / years.
// ---------------------------------------------------------------------------

export type Sex = "female" | "male";
export type Goal = "loss" | "maintain" | "gain";
export type BmrFormula = "mifflin" | "harris" | "cunningham";

/** Physical Activity Level multipliers (TDEE = BMR × PAL). */
export const ACTIVITY_LEVELS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
} as const;
export type ActivityLevel = keyof typeof ACTIVITY_LEVELS;

/** Goal adjustment applied to TDEE to get the plan target (kcal). */
export const GOAL_ADJUSTMENT: Record<Goal, number> = {
  loss: -0.2, // −20%
  maintain: 0,
  gain: 0.15, // +15%
};

export interface BmrInput {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
  fatFreeMassKg?: number; // for Cunningham
}

/** Basal Metabolic Rate (kcal/day). */
export function bmr(input: BmrInput, formula: BmrFormula = "mifflin"): number | undefined {
  const { sex, weightKg: w, heightCm: h, ageYears: a, fatFreeMassKg: ffm } = input;
  if (!w || !h || !a) return undefined;
  let v: number;
  switch (formula) {
    case "harris": // Harris–Benedict (original)
      v =
        sex === "male"
          ? 66.5 + 13.75 * w + 5 * h - 6.78 * a
          : 655.0955 + 9.5634 * w + 1.8496 * h - 4.6756 * a;
      break;
    case "cunningham": // requires fat-free mass
      if (!ffm) return undefined;
      v = 21.6 * ffm + 370;
      break;
    case "mifflin":
    default: // Mifflin–St Jeor (default — most accurate for general population)
      v = 10 * w + 6.25 * h - 5 * a + (sex === "male" ? 5 : -161);
  }
  return Math.round(v);
}

export function tdee(bmrValue: number, activity: ActivityLevel): number {
  return Math.round(bmrValue * ACTIVITY_LEVELS[activity]);
}

export function targetKcal(tdeeValue: number, goal: Goal): number {
  return Math.round(tdeeValue * (1 + GOAL_ADJUSTMENT[goal]));
}

export interface MacroSplit {
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}

export const DEFAULT_MACROS: MacroSplit = { proteinPct: 30, carbsPct: 40, fatPct: 30 };

export interface MacroResult {
  kcal: number;
  grams: number;
  gPerKg?: number;
}

/** Splits target kcal into protein/carbs/fat (kcal, grams, g/kg) — Excel logic. */
export function macros(
  targetKcalValue: number,
  split: MacroSplit,
  weightKg?: number,
): { protein: MacroResult; carbs: MacroResult; fat: MacroResult } {
  const make = (pct: number, kcalPerG: number): MacroResult => {
    const kcal = (pct / 100) * targetKcalValue;
    const grams = kcal / kcalPerG;
    return {
      kcal: Math.round(kcal),
      grams: Math.round(grams),
      gPerKg: weightKg ? Math.round((grams / weightKg) * 10) / 10 : undefined,
    };
  };
  return {
    protein: make(split.proteinPct, 4),
    carbs: make(split.carbsPct, 4),
    fat: make(split.fatPct, 9),
  };
}

export function bmi(weightKg?: number, heightCm?: number): number | undefined {
  if (!weightKg || !heightCm) return undefined;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

/** WHO BMI classification key (translate in UI). */
export function bmiClass(value: number | undefined): string {
  if (value == null) return "unknown";
  if (value < 18.5) return "underweight";
  if (value < 25) return "normal";
  if (value < 30) return "overweight";
  if (value < 35) return "obese1";
  if (value < 40) return "obese2";
  return "obese3";
}
