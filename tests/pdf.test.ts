import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { generatePlanPdf } from "@/lib/pdf/generate";
import { seedClients, seedConsultations, seedPlans, seedProfile } from "@/lib/data/seed";
import type { PlanDocumentData } from "@/lib/types";

const logo = new Uint8Array(readFileSync("public/pdf-assets/logo.png"));

function data(lang: "pt-PT" | "en", overrides: Partial<PlanDocumentData["plan"]> = {}): PlanDocumentData {
  return {
    profile: seedProfile,
    client: seedClients[0],
    consultation: seedConsultations[1],
    previousConsultation: seedConsultations[0],
    plan: { ...seedPlans[1], language: lang, ...overrides },
    language: lang,
  };
}

test("generates the classic plan in both languages", async () => {
  for (const lang of ["pt-PT", "en"] as const) {
    const bytes = await generatePlanPdf(data(lang), { logo });
    const doc = await PDFDocument.load(bytes);
    assert.ok(doc.getPageCount() >= 5, `${lang}: ${doc.getPageCount()} pages`);
  }
});

test("long content paginates instead of overflowing, and odd characters don't crash", async () => {
  const long = Array.from({ length: 120 }, (_, i) => `Linha ${i + 1} — 🍎 Uma recomendação\tcom tab e umapalavraextremamentelongasemespaçosquetemdeserpartidaaomeio`).join("\n");
  const bytes = await generatePlanPdf(
    data("pt-PT", {
      notes: long,
      meals: [
        {
          id: "m",
          name: "Almoço",
          options: [
            { id: "o1", content: long },
            { id: "o2", content: "", items: [{ id: "i", name: "Arroz", qtyG: 110, unit: "g", perG: { kcal: 1.3, protein: 0, carbs: 0, fat: 0 } }] },
          ],
        },
      ],
    }),
    { logo },
  );
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() > 6);
});

test("a corrupt custom template falls back to the classic design", async () => {
  const bytes = await generatePlanPdf(data("pt-PT"), { baseTemplate: new Uint8Array([1, 2, 3]), logo });
  assert.ok((await PDFDocument.load(bytes)).getPageCount() >= 5);
});

test("hideFoodItems prints only the written text: food-only options and meals disappear", async () => {
  const item = { id: "i", name: "Aveia", qtyG: 40, unit: "g" as const, kind: "food" as const, perG: { kcal: 3.8, protein: 0.13, carbs: 0.6, fat: 0.07 } };
  // 40 meals that contain nothing but database foods → several pages of items.
  const meals = Array.from({ length: 40 }, (_, i) => ({ id: `m${i}`, name: "", options: [{ id: `o${i}`, content: "", items: Array(6).fill(item) }] }));
  const pages = async (hideFoodItems: boolean) => (await PDFDocument.load(await generatePlanPdf(data("pt-PT", { meals, hideFoodItems }), { logo }))).getPageCount();
  const [shown, hidden] = [await pages(false), await pages(true)];
  assert.ok(shown > hidden, `shown ${shown} pages, hidden ${hidden}`);

  // Written text is kept either way.
  const written = [{ id: "m", name: "Almoço", options: [{ id: "o", content: "Sopa + prato", items: [item] }, { id: "o2", content: "", items: [item] }] }];
  assert.ok((await generatePlanPdf(data("en", { meals: written, hideFoodItems: true }), { logo })).length > 1000);
});
