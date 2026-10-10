import { NextResponse, type NextRequest } from "next/server";
import {
  getAuthNid,
  getClient,
  getConsultation,
  getPdfTemplate,
  getPlan,
  getProfile,
  listConsultations,
} from "@/lib/data/repo";
import { loadFile } from "@/lib/files";
import { generatePlanPdf } from "@/lib/pdf/generate";
import type { PlanDocumentData, PlanLanguage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LOGO = "/pdf-assets/logo.png";

/** ASCII fallback + RFC 5987 UTF-8 filename (names with accents, etc.). */
function contentDisposition(type: "inline" | "attachment", filename: string): string {
  const ascii = filename.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "-");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  if (!(await getAuthNid())) return new NextResponse("Unauthorized", { status: 401 });

  const { planId } = await params;
  const plan = await getPlan(planId);
  if (!plan) return new NextResponse("Plan not found", { status: 404 });

  const langParam = req.nextUrl.searchParams.get("lang");
  const language: PlanLanguage = langParam === "en" || langParam === "pt-PT" ? langParam : plan.language;

  const [client, profile] = await Promise.all([getClient(plan.clientId), getProfile()]);
  if (!client) return new NextResponse("Client not found", { status: 404 });

  const consultation = plan.consultationId ? await getConsultation(plan.consultationId) : undefined;
  // The consultation immediately before this one feeds the comparison column.
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

  let baseTemplate: Uint8Array | undefined;
  if (plan.pdfTemplateId && plan.pdfTemplateId !== "classic") {
    const tpl = await getPdfTemplate(plan.pdfTemplateId);
    baseTemplate = tpl ? (await loadFile(tpl.storagePath))?.bytes : undefined;
  }
  const logo = (await loadFile(profile.logoUrl || DEFAULT_LOGO)) ?? (await loadFile(DEFAULT_LOGO));

  try {
    const bytes = await generatePlanPdf(data, { baseTemplate, logo: logo?.bytes });
    const filename = `${language === "en" ? "Meal-Plan" : "Plano-Alimentar"}-${client.name.trim().replace(/\s+/g, "-")}.pdf`;
    const inline = req.nextUrl.searchParams.get("inline") === "1";
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(inline ? "inline" : "attachment", filename),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[alimea] PDF generation failed", e);
    return new NextResponse("PDF generation failed", { status: 500 });
  }
}
