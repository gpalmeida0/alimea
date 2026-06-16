import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import {
  getClient,
  getConsultation,
  getMealSuggestions,
  getPlan,
  listFoods,
  listPdfTemplates,
  listRecipes,
  listRecommendations,
  listTemplates,
} from "@/lib/data/repo";
import { Link } from "@/i18n/routing";
import { PlanEditor } from "@/components/plan-editor";
import { ConsultationWorkspace } from "@/components/consultation-workspace";
import { ageFromBirth, formatDate } from "@/lib/utils";

export default async function PlanEditorPage({
  params,
}: {
  params: Promise<{ locale: string; id: string; planId: string }>;
}) {
  const { locale, id, planId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("plan");
  const tc = await getTranslations("consultation");

  const [plan, client, recommendations, suggestions, templates, pdfTemplates, foods, recipes] =
    await Promise.all([
      getPlan(planId),
      getClient(id),
      listRecommendations(),
      getMealSuggestions(id),
      listTemplates(),
      listPdfTemplates(),
      listFoods(),
      listRecipes(),
    ]);
  if (!plan || !client) notFound();

  const consultation = plan.consultationId
    ? await getConsultation(plan.consultationId)
    : undefined;

  // Heuristic: a freshly duplicated plan shares meals with a prior plan.
  const prefilled = Boolean(plan.consultationId) && plan.meals.length > 0;
  const age = ageFromBirth(client.birthDate);

  const planEditorProps = {
    planId: plan.id,
    clientId: id,
    clientName: client.name,
    templates: templates.map((tpl) => ({
      id: tpl.id,
      name: tpl.name,
      meals: tpl.meals,
      supplementation: tpl.supplementation ?? "",
      notes: tpl.notes ?? "",
    })),
    initialMeals: plan.meals,
    initialLanguage: plan.language,
    initialSupplementation: plan.supplementation ?? "",
    initialNotes: plan.notes ?? "",
    initialQuote: plan.motivationalQuote ?? "",
    initialNextAppointment: plan.nextAppointment ?? "",
    initialPdfTemplateId: plan.pdfTemplateId ?? "classic",
    pdfTemplates: pdfTemplates.map((p) => ({ id: p.id, name: p.name })),
    clientAge: age,
    consultation,
    recommendations: recommendations.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      content: r.content,
    })),
    suggestions,
    prefilled,
    dbFoods: foods,
    recipes,
  };

  return (
    <div>
      <Link
        href={`/clients/${id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {client.name}
      </Link>
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {consultation ? tc("title") : t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {client.name}
          {consultation
            ? ` · ${formatDate(consultation.date, locale)} · ${t("title")}`
            : ` · ${t("editor")}`}
        </p>
      </div>

      {consultation ? (
        <ConsultationWorkspace
          clientId={id}
          age={age}
          initialClient={{
            sex: client.sex,
            ethnicity: client.ethnicity,
            profession: client.profession,
            anamnesis: client.anamnesis,
          }}
          consultation={consultation}
          planEditorProps={planEditorProps}
        />
      ) : (
        <PlanEditor {...planEditorProps} />
      )}
    </div>
  );
}
