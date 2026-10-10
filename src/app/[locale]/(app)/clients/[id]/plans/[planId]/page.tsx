import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import {
  getClient,
  getMealSuggestions,
  getPlan,
  listConsultations,
  listFoods,
  listPdfTemplates,
  listRecipes,
  listRecommendations,
  listTemplates,
} from "@/lib/data/repo";
import { Link } from "@/i18n/routing";
import { ConsultationWorkspace } from "@/components/consultation-workspace";
import { StandalonePlan } from "@/components/standalone-plan";
import type { PlanDraft, PlanEditorContext } from "@/components/plan-editor";
import { heightCmOf } from "@/lib/types";
import { ageFromBirth, formatDate } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const client = await getClient((await params).id);
  return { title: client?.name };
}

export default async function PlanPage({ params }: { params: Promise<{ locale: string; id: string; planId: string }> }) {
  const { locale, id, planId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("plan");
  const tn = await getTranslations("nutrition");

  const [plan, client] = await Promise.all([getPlan(planId), getClient(id)]);
  if (!plan || !client || plan.clientId !== client.id) notFound();

  const [recommendations, suggestions, templates, pdfTemplates, foods, recipes, consultations] = await Promise.all([
    listRecommendations(),
    getMealSuggestions(id),
    listTemplates(),
    listPdfTemplates(),
    listFoods({ includeArchived: true }),
    listRecipes(),
    listConsultations(id),
  ]);

  const idx = plan.consultationId ? consultations.findIndex((c) => c.id === plan.consultationId) : -1;
  const consultation = idx >= 0 ? consultations[idx] : undefined;
  const previous = idx >= 0 ? consultations[idx + 1] : undefined;
  const latest = consultations[0];

  const draft: PlanDraft = {
    meals: plan.meals,
    language: plan.language,
    pdfTemplateId: plan.pdfTemplateId ?? "classic",
    supplementation: plan.supplementation ?? "",
    notes: plan.notes ?? "",
    motivationalQuote: plan.motivationalQuote ?? "",
    nextAppointment: plan.nextAppointment ?? "",
  };
  const ctx: PlanEditorContext = {
    planId: plan.id,
    clientId: id,
    standalone: !consultation,
    templates: templates.map((tpl) => ({
      id: tpl.id,
      name: tpl.name,
      meals: tpl.meals,
      supplementation: tpl.supplementation ?? "",
      notes: tpl.notes ?? "",
    })),
    recommendations: recommendations.map((r) => ({ id: r.id, title: r.title, category: r.category, content: r.content })),
    suggestions,
    pdfTemplates: pdfTemplates.map((p) => ({ id: p.id, name: p.name })),
    dbFoods: foods,
    recipes,
  };

  return (
    <div>
      <Link href={`/clients/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {client.name}
      </Link>
      <div className="mb-4">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {consultation ? tn("consultationN", { n: consultation.consultationNumber ?? idx + 1 }) : t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {client.name} · {formatDate(consultation?.date ?? plan.updatedAt, locale, { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {consultation ? (
        <ConsultationWorkspace
          clientId={id}
          initialClient={{
            birthDate: client.birthDate,
            sex: client.sex,
            ethnicity: client.ethnicity,
            profession: client.profession,
            anamnesis: client.anamnesis ?? {},
          }}
          consultation={consultation}
          previous={previous}
          initialPlan={draft}
          planCtx={ctx}
        />
      ) : (
        <StandalonePlan
          initialPlan={draft}
          ctx={ctx}
          calculator={{
            weightKg: latest?.measurements.weightKg,
            heightCm: heightCmOf(latest?.measurements),
            age: ageFromBirth(client.birthDate),
            sex: client.sex,
          }}
        />
      )}
    </div>
  );
}
