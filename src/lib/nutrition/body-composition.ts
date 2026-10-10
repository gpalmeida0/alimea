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
const siri501 = (bd?: number) => (pos(bd) ? (5.01 / bd! - 4.57) * 100 : undefined);

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

function adultAthleteFat(i: BodyCompInput): FormulaResult[] {
  const s = i.skinfolds;
  const age = i.ageYears;
  const out: FormulaResult[] = [];

  // Evans et al — %BF = 8.9976 + 0.24658·Σ(abd+crural+tri) − 6.343·sex − 1.998·race
  out.push({
    key: "evans",
    label: "Evans et al",
    value: pos(s.abdominal, s.crural, s.tricipital)
      ? r1(
          8.9976 +
            0.24658 * (s.abdominal! + s.crural! + s.tricipital!) -
            6.343 * sexNum(i.sex) -
            1.998 * raceNum(i.ethnicity),
        )
      : undefined,
  });

  // Whiters et al — BD = 1.0988 − 0.0004·Σ7 → Siri 4.95
  const sum7w = [
    s.tricipital,
    s.subscapular,
    s.bicipital,
    s.supraspinal,
    s.abdominal,
    s.crural,
    s.geminal,
  ];
  out.push({
    key: "whiters",
    label: "Whiters et al",
    value: pos(...sum7w)
      ? r1(siri495(1.0988 - 0.0004 * sum7w.reduce((a, b) => a! + b!, 0)!)!)
      : undefined,
  });

  // Reilly et al (footballers, men) — direct %BF
  out.push({
    key: "reilly",
    label: "Reilly et al (Futebol H)",
    value:
      i.sex === "male" && pos(s.crural, s.abdominal, s.tricipital, s.geminal)
        ? r1(5.174 + 0.124 * s.crural! + 0.147 * s.abdominal! + 0.196 * s.tricipital! + 0.13 * s.geminal!)
        : undefined,
  });

  // Jackson et al — sex-specific density → Siri
  if (i.sex === "male") {
    const sum7 = [s.peitoral, s.tricipital, s.subscapular, s.abdominal, s.supraspinal, s.crural, s.bicipital];
    out.push({
      key: "jackson",
      label: "Jackson et al (Homens)",
      value:
        pos(...sum7) && num(age)
          ? (() => {
              const sum = sum7.reduce((a, b) => a! + b!, 0)!;
              const d = 1.112 - 0.00043499 * sum + 0.00000055 * sum * sum - 0.00028826 * age!;
              return r1(siri495(d)!);
            })()
          : undefined,
    });
  } else {
    const set = [s.subscapular, s.abdominal, s.iliocristal, s.crural];
    out.push({
      key: "jackson",
      label: "Jackson et al (Mulheres)",
      value:
        pos(...set) && num(age)
          ? (() => {
              const sum = set.reduce((a, b) => a! + b!, 0)!;
              const d = 1.096095 - 0.0006952 * sum + 0.0000011 * sum * sum - 0.0000714 * age!;
              return r1(siri501(d)!);
            })()
          : undefined,
    });
  }
  return out;
}

function adultNonAthleteFat(i: BodyCompInput): FormulaResult[] {
  const s = i.skinfolds;
  const age = i.ageYears;
  const bmi = bmiOf(i);
  const h = i.heightCm;
  const out: FormulaResult[] = [];

  if (i.sex === "male") {
    // Peterson et al (men) — sum4: tri + subsc + supra + abdominal
    const sum4 = [s.tricipital, s.subscapular, s.supraspinal, s.abdominal];
    out.push({
      key: "peterson",
      label: "Peterson et al",
      value:
        pos(...sum4) && num(age) && pos(h)
          ? (() => {
              const sum = sum4.reduce((a, b) => a! + b!, 0)!;
              return r1(20.94878 + 0.1166 * age! - 0.11666 * h! + 0.42696 * sum - 0.00159 * sum * sum);
            })()
          : undefined,
    });
    // Jackson et al (men) — density from tri + subsc + peitoral
    const j = [s.tricipital, s.subscapular, s.peitoral];
    out.push({
      key: "jackson",
      label: "Jackson et al",
      value:
        pos(...j) && num(age)
          ? (() => {
              const sum = j.reduce((a, b) => a! + b!, 0)!;
              const d = 1.1125025 - 0.0013125 * sum + 0.0000055 * sum * sum - 0.000244 * age!;
              return r1(siri495(d)!);
            })()
          : undefined,
    });
    // Deurenberg et al (men): 1.20·BMI + 0.23·age − 16.2
    out.push({
      key: "deurenberg",
      label: "Deurenberg et al",
      value: pos(bmi) && num(age) ? r1(1.2 * bmi! - 10.8 + 0.23 * age! - 5.4) : undefined,
    });
    // Sun et al (men) — sum4: tri + abdominal + subsc + iliocristal
    const sun = [s.tricipital, s.abdominal, s.subscapular, s.iliocristal];
    out.push({
      key: "sun",
      label: "Sun et al",
      value:
        pos(...sun) && num(age) && pos(h)
          ? (() => {
              const sum = sun.reduce((a, b) => a! + b!, 0)!;
              return r1(20.94878 + 0.1166 * age! - 0.11666 * h! + 0.42696 * sum - 0.00159 * sum * sum);
            })()
          : undefined,
    });
  } else {
    // Peterson et al (women) — sum4: tri + subsc + supra + geminal
    const sum4 = [s.tricipital, s.subscapular, s.supraspinal, s.geminal];
    out.push({
      key: "peterson",
      label: "Peterson et al",
      value:
        pos(...sum4) && num(age) && pos(bmi) && pos(h)
          ? (() => {
              const sum = sum4.reduce((a, b) => a! + b!, 0)!;
              return r1(
                22.18945 + 0.06368 * age! + 0.60404 * bmi! - 0.1452 * h! + 0.30919 * sum - 0.00099562 * sum * sum,
              );
            })()
          : undefined,
    });
    // Jackson et al (women) — density from tri + abdominal + iliocristal
    const j = [s.tricipital, s.abdominal, s.iliocristal];
    out.push({
      key: "jackson",
      label: "Jackson et al",
      value:
        pos(...j) && num(age)
          ? (() => {
              const sum = j.reduce((a, b) => a! + b!, 0)!;
              const d = 1.089733 - 0.0009245 * sum + 0.0000025 * sum * sum - 0.0000979 * age!;
              return r1(siri501(d)!);
            })()
          : undefined,
    });
    // Deurenberg et al (women): 1.20·BMI + 0.23·age − 5.4
    out.push({
      key: "deurenberg",
      label: "Deurenberg et al",
      value: pos(bmi) && num(age) ? r1(1.2 * bmi! + 0.23 * age! - 5.4) : undefined,
    });
    // Sun et al (women) — sum4: tri + subsc + iliocristal + crural
    const sun = [s.tricipital, s.subscapular, s.iliocristal, s.crural];
    out.push({
      key: "sun",
      label: "Sun et al",
      value:
        pos(...sun) && num(age) && pos(bmi) && pos(h)
          ? (() => {
              const sum = sun.reduce((a, b) => a! + b!, 0)!;
              return r1(
                22.18945 + 0.06368 * age! + 0.60404 * bmi! - 0.1452 * h! + 0.30919 * sum - 0.00099562 * sum * sum,
              );
            })()
          : undefined,
    });
  }
  return out;
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
export function bodyFatPercent(
  i: BodyCompInput,
  opts: { athlete?: boolean } = {},
): { results: FormulaResult[]; average?: number } {
  const young = (i.ageYears ?? 99) < 18;
  const results = young
    ? youngFat(i)
    : opts.athlete
      ? adultAthleteFat(i)
      : adultNonAthleteFat(i);
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
