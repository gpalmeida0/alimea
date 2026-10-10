import { readFileSync, writeFileSync } from "node:fs";
import { generatePlanPdf } from "@/lib/pdf/generate";
import { seedClients, seedConsultations, seedPlans, seedProfile } from "@/lib/data/seed";
import type { PlanDocumentData, PlanLanguage } from "@/lib/types";

async function main() {
  const lang = (process.argv[2] as PlanLanguage) ?? "pt-PT";
  const data: PlanDocumentData = {
    profile: seedProfile,
    client: seedClients[0],
    consultation: seedConsultations[1],
    previousConsultation: seedConsultations[0],
    plan: { ...seedPlans[1], language: lang },
    language: lang,
  };
  const logo = new Uint8Array(readFileSync("public/pdf-assets/logo.png"));
  const bytes = await generatePlanPdf(data, { logo });
  const out = process.argv[3] ?? `/tmp/alimea-out-${lang}.pdf`;
  writeFileSync(out, bytes);
  console.log("wrote", out, bytes.length, "bytes");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
