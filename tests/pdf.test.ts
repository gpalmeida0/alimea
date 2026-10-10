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
