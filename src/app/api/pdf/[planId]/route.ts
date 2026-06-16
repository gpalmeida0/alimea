import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  getClient,
  getConsultation,
  getPdfTemplate,
  getPlan,
  getProfileById,
  listConsultations,
} from "@/lib/data/repo";
import { generatePlanPdf } from "@/lib/pdf/generate";
import type { PlanDocumentData, PlanLanguage } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const plan = await getPlan(planId);
  if (!plan) return new NextResponse("Plan not found", { status: 404 });

  const langParam = req.nextUrl.searchParams.get("lang");
  const language: PlanLanguage = langParam === "en" || langParam === "pt-PT" ? langParam : plan.language;

  const client = await getClient(plan.clientId);
  if (!client) return new NextResponse("Client not found", { status: 404 });
  const profile = await getProfileById(client.nutritionistId);
  if (!profile) return new NextResponse("Profile not found", { status: 404 });

  const consultation = plan.consultationId
    ? await getConsultation(plan.consultationId)
    : undefined;

  // Find the consultation immediately before this one for the comparison column.
  let previousConsultation;
  if (consultation) {
    const all = await listConsultations(client.id);
    const idx = all.findIndex((c) => c.id === consultation.id);
    previousConsultation = idx >= 0 ? all[idx + 1] : undefined;
  }

  const data: PlanDocumentData = {
    profile,
    client,
    consultation,
    previousConsultation,
    plan: { ...plan, language },
    language,
  };

  // If the plan uses an uploaded custom PDF template, load its bytes.
  let baseTemplate: Uint8Array | undefined;
  if (plan.pdfTemplateId && plan.pdfTemplateId !== "classic") {
    const tpl = await getPdfTemplate(plan.pdfTemplateId);
    if (tpl) {
      try {
        baseTemplate = await readFile(join(process.cwd(), "public", tpl.storagePath.replace(/^\//, "")));
      } catch {
        baseTemplate = undefined;
      }
    }
  }

  const bytes = await generatePlanPdf(data, { baseTemplate });
  const filename = `${language === "en" ? "Meal-Plan" : "Plano-Alimentar"}-${client.name.replace(/\s+/g, "-")}.pdf`;
  const inline = req.nextUrl.searchParams.get("inline") === "1";

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
