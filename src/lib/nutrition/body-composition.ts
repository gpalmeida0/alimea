// ---------------------------------------------------------------------------
// Body composition — % body fat and skeletal muscle mass (kg).
// Equations transcribed from the nutritionist's Excel "Fórmulas" sheet
// (only the formulas she highlighted in orange). Inputs: kg / cm / mm / years.
//
// Every formula returns `undefined` when a required measurement is missing, so
// the UI shows "—" instead of the Excel's #DIV/0! / #NUM! errors. (BOO-54/60/61/62)
// ---------------------------------------------------------------------------

import type { Ethnicity, Measurements, Sex } from "@/lib/types";

export interface BodyCompInput {
  sex?: Sex;
  ethnicity?: Ethnicity;
  ageYears?: number;
  weightKg?: number;
  heightCm?: number;
  /** Body mass index (computed from weight/height when omitted). */
  bmi?: number;
  skinfolds: Measurements["skinfolds"]; // mm
  perimeters: Measurements["perimeters"]; // cm
}

export interface FormulaResult {
  key: string;
  label: string;
  value?: number; // rounded to 0.1
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const num = (...xs: (number | undefined)[]) =>
  xs.every((x) => typeof x === "number" && !Number.isNaN(x));
const pos = (...xs: (number | undefined)[]) =>
  xs.every((x) => typeof x === "number" && !Number.isNaN(x) && x > 0);

// Siri equations converting body density (BD) → % fat.
const siri495 = (bd?: number) => (pos(bd) ? (4.95 / bd! - 4.5) * 100 : undefined);

function bmiOf(i: BodyCompInput): number | undefined {
  if (i.bmi) return i.bmi;
  if (pos(i.weightKg, i.heightCm)) {
    const m = i.heightCm! / 100;
    return i.weightKg! / (m * m);
  }
  return undefined;
}

/** Corrected limb girth (cm): circumference − π·skinfold(mm)/10. */
const corrected = (circCm?: number, skinfoldMm?: number) =>
  pos(circCm) && num(skinfoldMm) ? circCm! - (Math.PI * skinfoldMm!) / 10 : undefined;

const sexNum = (s?: Sex) => (s === "male" ? 1 : 0);
const raceNum = (e?: Ethnicity) => (e === "black" ? 1 : 0);

// ---------------------------------------------------------------------------
// % BODY FAT
// ---------------------------------------------------------------------------

/** Adults: the two skinfold equations the practice uses (Evans, Withers). */
function adultFat(i: BodyCompInput): FormulaResult[] {
  const s = i.skinfolds;

  // Evans et al — %BF = 8.9976 + 0.24658·Σ(abd+crural+tri) − 6.343·sex − 1.998·race
  const evans = pos(s.abdominal, s.crural, s.tricipital)
    ? r1(8.9976 + 0.24658 * (s.abdominal! + s.crural! + s.tricipital!) - 6.343 * sexNum(i.sex) - 1.998 * raceNum(i.ethnicity))
    : undefined;

  // Withers et al — BD = 1.0988 − 0.0004·Σ7 → Siri 4.95
  const sum7 = [s.tricipital, s.subscapular, s.bicipital, s.supraspinal, s.abdominal, s.crural, s.geminal];
  const withers = pos(...sum7) ? r1(siri495(1.0988 - 0.0004 * sum7.reduce((a, b) => a! + b!, 0)!)!) : undefined;

  return [
    { key: "evans", label: "Evans et al", value: evans },
    { key: "whiters", label: "Withers et al", value: withers },
  ];
}

function youngFat(i: BodyCompInput): FormulaResult[] {
  const s = i.skinfolds;
  const age = i.ageYears;
  const bmi = bmiOf(i);
  const out: FormulaResult[] = [];
  const male = i.sex === "male";

  // Slaughter et al ×2
  out.push({
    key: "slaughter1",
    label: "Slaughter et al (TR+Gem)",
    value: pos(s.tricipital, s.geminal)
      ? r1((male ? 0.735 : 0.61) * (s.tricipital! + s.geminal!) + (male ? 1 : 5.1))
      : undefined,
  });
  out.push({
    key: "slaughter2",
    label: "Slaughter et al (TR+SB)",
    value: pos(s.tricipital, s.subscapular)
      ? r1((male ? 0.738 : 0.546) * (s.tricipital! + s.subscapular!) + (male ? 1.7 : 9.7))
      : undefined,
  });

  // Brook et al (1–11 anos) — BD from log10(sum4) → Siri
  const sum4 = [s.tricipital, s.subscapular, s.bicipital, s.iliocristal];
  out.push({
    key: "brook",
    label: "Brook et al (1-11 anos)",
    value:
      pos(...sum4)
        ? (() => {
            const sum = sum4.reduce((a, b) => a! + b!, 0)!;
            const bd = (male ? 1.169 : 1.2063) - (male ? 0.0788 : 0.0999) * Math.log10(sum);
            return r1(siri495(bd)!);
          })()
        : undefined,
  });

  // Deurenberg et al (<15 anos): 1.51·BMI − 0.70·age (− 3.6 male) + 1.4
  out.push({
    key: "deurenberg",
    label: "Deurenberg et al (<15 anos)",
    value:
      pos(bmi) && num(age)
        ? r1(1.51 * bmi! - 0.7 * age! - (male ? 3.6 : 0) + 1.4)
        : undefined,
  });
  return out;
}

/** % body fat — applicable formulas + the average of those with a value. */
export function bodyFatPercent(i: BodyCompInput): { results: FormulaResult[]; average?: number } {
  const young = (i.ageYears ?? 99) < 18;
  const results = young ? youngFat(i) : adultFat(i);
  return { results, average: average(results) };
}

// ---------------------------------------------------------------------------
// SKELETAL MUSCLE MASS (kg)
// ---------------------------------------------------------------------------

/** Lee et al weight-based SMM = 0.244·W + 7.80·Ht(m) + 6.6·sex − 0.098·age + race − 3.3. */
function leeWeight(i: BodyCompInput): number | undefined {
  if (!pos(i.weightKg, i.heightCm) || !num(i.ageYears)) return undefined;
  const ht = i.heightCm! / 100;
  // Lee 2000, model 2: race = +1.4 for African-American (model 1 uses +1.1).
  const race = i.ethnicity === "black" ? 1.4 : 0;
  return r1(0.244 * i.weightKg! + 7.8 * ht + 6.6 * sexNum(i.sex) - 0.098 * i.ageYears! + race - 3.3);
}

/** Lee et al anthropometric SMM from corrected limb girths. */
function leeAnthropometric(i: BodyCompInput): number | undefined {
  if (!pos(i.heightCm) || !num(i.ageYears)) return undefined;
  const ht = i.heightCm! / 100;
  const cag = corrected(i.perimeters.arm, i.skinfolds.tricipital);
  const ctg = corrected(i.perimeters.thigh, i.skinfolds.crural);
  const ccg = corrected(i.perimeters.calf, i.skinfolds.geminal);
  if (!pos(cag, ctg, ccg)) return undefined;
  const race = i.ethnicity === "black" ? 1.1 : 0;
  return r1(
    ht * (0.00744 * cag! * cag! + 0.00088 * ctg! * ctg! + 0.00441 * ccg! * ccg!) +
      2.4 * sexNum(i.sex) -
      0.048 * i.ageYears! +
      race +
      7.8,
  );
}

/** Poortmans et al (7–17 anos) SMM from corrected limb girths. */
function poortmans(i: BodyCompInput): number | undefined {
  if (!pos(i.heightCm) || !num(i.ageYears)) return undefined;
  const ht = i.heightCm! / 100;
  const pb = corrected(i.perimeters.arm, i.skinfolds.tricipital);
  const pcoxa = corrected(i.perimeters.thigh, i.skinfolds.crural);
  const pgem = corrected(i.perimeters.calf, i.skinfolds.geminal);
  if (!pos(pb, pcoxa, pgem)) return undefined;
  return r1(
    ht * (0.0064 * pb! * pb! + 0.0032 * pcoxa! * pcoxa! + 0.0015 * pgem! * pgem!) +
      2.56 * sexNum(i.sex) +
      0.136 * i.ageYears!,
  );
}

/** Skeletal muscle mass (kg) — applicable formulas + average. */
export function muscleMassKg(i: BodyCompInput): { results: FormulaResult[]; average?: number } {
  const young = (i.ageYears ?? 99) < 18;
  const results: FormulaResult[] = young
    ? [{ key: "poortmans", label: "Poortmans et al (7-17 anos)", value: poortmans(i) }]
    : [
        { key: "lee_weight", label: "Lee et al (peso)", value: leeWeight(i) },
        { key: "lee_anthro", label: "Lee et al (antropométrica)", value: leeAnthropometric(i) },
      ];
  return { results, average: average(results) };
}

export function average(results: FormulaResult[]): number | undefined {
  const vals = results.map((r) => r.value).filter((v): v is number => typeof v === "number");
  if (!vals.length) return undefined;
  return r1(vals.reduce((a, b) => a + b, 0) / vals.length);
}
