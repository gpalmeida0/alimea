// ---------------------------------------------------------------------------
// Shared nutrition calculators: plan goal adjustment, macro split and BMI.
// Energy expenditure formulas (GEB/GET) live in ./energy.ts.
// ---------------------------------------------------------------------------

export type Sex = "female" | "male";
export type Goal = "loss" | "maintain" | "gain";

/** Goal adjustment applied to TDEE to get the plan target (kcal). */
export const GOAL_ADJUSTMENT: Record<Goal, number> = {
  loss: -0.2, // −20%
  maintain: 0,
  gain: 0.15, // +15%
};

export function targetKcal(tdeeValue: number, goal: Goal): number {
  return Math.round(tdeeValue * (1 + GOAL_ADJUSTMENT[goal]));
}

export interface MacroSplit {
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}

export interface MacroResult {
  kcal: number;
  grams: number;
  gPerKg?: number;
}

export type MacroBreakdown = { protein: MacroResult; carbs: MacroResult; fat: MacroResult };

/** Splits target kcal into protein/carbs/fat (kcal, grams, g/kg) — Excel logic. */
export function macros(targetKcalValue: number, split: MacroSplit, weightKg?: number): MacroBreakdown {
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

export type BmiClass = "underweight" | "normal" | "overweight" | "obese1" | "obese2" | "obese3" | "unknown";

/** WHO BMI classification key (translate in UI). */
export function bmiClass(value: number | undefined): BmiClass {
  if (value == null) return "unknown";
  if (value < 18.5) return "underweight";
  if (value < 25) return "normal";
  if (value < 30) return "overweight";
  if (value < 35) return "obese1";
  if (value < 40) return "obese2";
  return "obese3";
}
