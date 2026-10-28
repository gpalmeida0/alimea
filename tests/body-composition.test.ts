import { test } from "node:test";
import assert from "node:assert/strict";
import { average, bodyFatPercent, muscleMassKg, type BodyCompInput } from "@/lib/nutrition/body-composition";

const r1 = (v: number) => Math.round(v * 10) / 10;
const siri495 = (bd: number) => (4.95 / bd - 4.5) * 100;

const skinfolds = {
  tricipital: 12,
  subscapular: 14,
  bicipital: 6,
  iliocristal: 16,
  supraspinal: 10,
  abdominal: 18,
  geminal: 9,
  crural: 15,
  peitoral: 8,
};
const perimeters = { arm: 32, thigh: 56, calf: 38 };
const man: BodyCompInput = { sex: "male", ethnicity: "white", ageYears: 30, weightKg: 80, heightCm: 180, skinfolds, perimeters };
const woman: BodyCompInput = { ...man, sex: "female", weightKg: 62, heightCm: 165 };
const value = (results: { key: string; value?: number }[], key: string) => results.find((r) => r.key === key)?.value;

test("adults: only Evans and Withers, for athletes and non-athletes alike", () => {
  const { results, average: avg } = bodyFatPercent(man);
  assert.deepEqual(results.map((r) => r.key), ["evans", "whiters"]);
  assert.equal(value(results, "evans"), r1(8.9976 + 0.24658 * (18 + 15 + 12) - 6.343));
  assert.equal(value(results, "whiters"), r1(siri495(1.0988 - 0.0004 * (12 + 14 + 6 + 10 + 18 + 15 + 9))));
  assert.equal(avg, average(results));
});

test("adults (women): Evans has no sex term and subtracts the ethnicity term", () => {
  const { results } = bodyFatPercent({ ...woman, ethnicity: "black" });
  assert.equal(value(results, "evans"), r1(8.9976 + 0.24658 * 45 - 1.998));
  // Withers needs all seven skinfolds.
  assert.equal(value(bodyFatPercent({ ...woman, skinfolds: { ...skinfolds, geminal: undefined } }).results, "whiters"), undefined);
});

test("under 18: Slaughter, Brook and Deurenberg, by sex", () => {
  const boy = bodyFatPercent({ ...man, ageYears: 12, weightKg: 45, heightCm: 150 }).results;
  assert.equal(value(boy, "slaughter1"), r1(0.735 * (12 + 9) + 1));
  assert.equal(value(boy, "slaughter2"), r1(0.738 * (12 + 14) + 1.7));
  assert.equal(value(boy, "brook"), r1(siri495(1.169 - 0.0788 * Math.log10(12 + 14 + 6 + 16))));
  assert.equal(value(boy, "deurenberg"), r1(1.51 * (45 / 1.5 ** 2) - 0.7 * 12 - 3.6 + 1.4));

  const girl = bodyFatPercent({ ...woman, ageYears: 12, weightKg: 45, heightCm: 150 }).results;
  assert.equal(value(girl, "slaughter1"), r1(0.61 * 21 + 5.1));
  assert.equal(value(girl, "slaughter2"), r1(0.546 * 26 + 9.7));
  assert.equal(value(girl, "brook"), r1(siri495(1.2063 - 0.0999 * Math.log10(48))));
  assert.equal(value(girl, "deurenberg"), r1(1.51 * 20 - 0.7 * 12 + 1.4));
});

test("missing measurements give undefined values and no average, in every group", () => {
  const empty = { skinfolds: {}, perimeters: {} };
  for (const input of [
    { ...empty, sex: "male" as const },
    { ...empty, sex: "female" as const },
    { ...empty, sex: "male" as const, ageYears: 10 },
  ]) {
    const { results, average: avg } = bodyFatPercent(input);
    assert.ok(results.length > 0);
    assert.ok(results.every((r) => r.value === undefined));
    assert.equal(avg, undefined);
    assert.equal(muscleMassKg(input).average, undefined);
  }
  // No age at all is treated as an adult.
  assert.deepEqual(muscleMassKg(empty).results.map((r) => r.key), ["lee_weight", "lee_anthro"]);
});

test("muscle mass: Lee (weight and anthropometric) for adults, Poortmans under 18", () => {
  const corrected = (c: number, sf: number) => c - (Math.PI * sf) / 10;
  const [cag, ctg, ccg] = [corrected(32, 12), corrected(56, 15), corrected(38, 9)];

  const adult = muscleMassKg({ ...man, ethnicity: "black" });
  assert.equal(value(adult.results, "lee_weight"), r1(0.244 * 80 + 7.8 * 1.8 + 6.6 - 0.098 * 30 + 1.4 - 3.3));
  assert.equal(
    value(adult.results, "lee_anthro"),
    r1(1.8 * (0.00744 * cag * cag + 0.00088 * ctg * ctg + 0.00441 * ccg * ccg) + 2.4 - 0.048 * 30 + 1.1 + 7.8),
  );
  assert.equal(adult.average, average(adult.results));

  const womanAnthro = value(muscleMassKg(woman).results, "lee_anthro");
  assert.equal(womanAnthro, r1(1.65 * (0.00744 * cag * cag + 0.00088 * ctg * ctg + 0.00441 * ccg * ccg) - 0.048 * 30 + 7.8));
  // Girths without their skinfolds cannot be corrected.
  assert.equal(value(muscleMassKg({ ...man, skinfolds: {} }).results, "lee_anthro"), undefined);

  const teen = muscleMassKg({ ...man, ageYears: 14, heightCm: 160 });
  assert.deepEqual(teen.results.map((r) => r.key), ["poortmans"]);
  assert.equal(teen.average, r1(1.6 * (0.0064 * cag * cag + 0.0032 * ctg * ctg + 0.0015 * ccg * ccg) + 2.56 + 0.136 * 14));
  assert.equal(muscleMassKg({ ...man, ageYears: 14, perimeters: {} }).average, undefined);
});

test("average ignores formulas without a value", () => {
  assert.equal(average([{ key: "a", label: "A", value: 10 }, { key: "b", label: "B" }, { key: "c", label: "C", value: 11 }]), 10.5);
  assert.equal(average([]), undefined);
});
