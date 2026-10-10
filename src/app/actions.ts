"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redirect } from "@/i18n/routing";
import * as repo from "@/lib/data/repo";
import { sendDueReminders, sendReminderNow, type ReminderOutcome } from "@/lib/messaging/reminders";
import { cloneMeals } from "@/lib/nutrition/items";
import type {
  Anamnesis,
  EnergyConfig,
  Ethnicity,
  FoodHistory,
  MacroConfig,
  Meal,
  Measurements,
  PlanLanguage,
  RecipeItem,
  Sex,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Server actions. Every action runs as the signed-in nutritionist: the
// repository rejects unauthenticated calls and scopes rows to the tenant.
// Inputs coming from forms / the client are validated here.
// ---------------------------------------------------------------------------

/** Revalidate the whole localized app (cheap: every app route is dynamic). */
function refresh() {
  revalidatePath("/[locale]", "layout");
}

/** Trimmed string or undefined (absent field). */
function str(v: FormDataEntryValue | null): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

/** Trimmed string, "" when the field was cleared (so edits can clear values). */
function field(fd: FormData, name: string): string | undefined {
  return fd.has(name) ? String(fd.get(name) ?? "").trim() : undefined;
}

const lang = (v: unknown): PlanLanguage => (v === "en" ? "en" : "pt-PT");
const sexOf = (v: unknown): Sex | undefined => (v === "male" || v === "female" ? v : undefined);
const ethnicityOf = (v: unknown): Ethnicity | undefined =>
  v === "white" || v === "black" || v === "other" ? v : undefined;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateTime = z.string().datetime({ offset: true });
const money = z.coerce.number().min(0).max(1_000_000);

// --- Files -------------------------------------------------------------------
const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_LOGO = 2 * 1024 * 1024;
const MAX_PDF = 10 * 1024 * 1024;

function sniff(bytes: Uint8Array): "png" | "jpg" | "webp" | "pdf" | undefined {
  const b = bytes;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0xff && b[1] === 0xd8) return "jpg";
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return "webp";
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";
  return undefined;
}

// --- Profile -------------------------------------------------------------------
export async function updateProfileAction(
  locale: string,
  formData: FormData,
): Promise<{ ok: true; locale: PlanLanguage } | { ok: false; error: "logoType" | "logoSize" }> {
  const patch: Parameters<typeof repo.updateProfile>[0] = {
    name: field(formData, "name") ?? "",
    credential: field(formData, "credential") ?? "",
    email: field(formData, "email") ?? "",
    instagram: field(formData, "instagram"),
    phone: field(formData, "phone"),
    address: field(formData, "address"),
    interfaceLanguage: lang(formData.get("interfaceLanguage")),
  };

  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > MAX_LOGO) return { ok: false, error: "logoSize" };
    const bytes = new Uint8Array(await logo.arrayBuffer());
    const kind = sniff(bytes);
    if (!kind || kind === "pdf" || kind === "webp") return { ok: false, error: "logoType" };
    const previous = (await repo.getProfile()).logoUrl;
    patch.logoUrl = await repo.putFile("logo", bytes, kind === "png" ? "image/png" : "image/jpeg", kind);
    if (previous && !previous.startsWith("/") && !previous.startsWith("http")) {
      await repo.deleteFile(previous).catch(() => undefined);
    }
  } else if (formData.get("removeLogo") === "1") {
    patch.logoUrl = "";
  }

  await repo.updateProfile(patch);
  refresh();
  void locale;
  return { ok: true, locale: patch.interfaceLanguage! };
}

// --- Clients -------------------------------------------------------------------
function clientFields(fd: FormData) {
  const birth = field(fd, "birthDate");
  return {
    name: field(fd, "name"),
    email: field(fd, "email"),
    phone: field(fd, "phone"),
    birthDate: birth === undefined ? undefined : birth && isoDate.safeParse(birth).success ? birth : "",
    sex: fd.has("sex") ? (sexOf(fd.get("sex")) ?? ("" as never)) : undefined,
    profession: field(fd, "profession"),
    goals: field(fd, "goals"),
    notes: field(fd, "notes"),
  };
}

export async function createClientAction(locale: string, formData: FormData) {
  const data = clientFields(formData);
  if (!data.name) return;
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v)) as typeof data;
  const client = await repo.createClient({ ...clean, name: data.name });
  refresh();
  redirect({ href: `/clients/${client.id}`, locale });
}

export async function updateClientAction(_locale: string, clientId: string, formData: FormData) {
  const data = clientFields(formData);
  if (data.name === "") delete data.name;
  await repo.updateClient(clientId, data);
  refresh();
}

export async function deleteClientAction(locale: string, clientId: string) {
  await repo.deleteClient(clientId);
  refresh();
  redirect({ href: "/clients", locale });
}

// --- Consultations ----------------------------------------------------------------
/** Start a consultation (optionally duplicating the previous one + its plan), then open it. */
export async function startConsultationAction(
  locale: string,
  clientId: string,
  opts: { duplicateLast?: boolean; consultationTypeId?: string } = {},
) {
  // Look up the previous consultation BEFORE creating the new one.
  const last = opts.duplicateLast ? await repo.getLastConsultation(clientId) : undefined;
  const consult = await repo.createConsultation(clientId, {
    duplicateFrom: last,
    consultationTypeId: opts.consultationTypeId,
  });

  const source = last?.planId ? await repo.getPlan(last.planId) : undefined;
  const plan = await repo.createPlan(
    source
      ? {
          clientId,
          consultationId: consult.id,
          language: source.language,
          pdfTemplateId: source.pdfTemplateId,
          meals: cloneMeals(source.meals),
          supplementation: source.supplementation,
          notes: source.notes,
          motivationalQuote: source.motivationalQuote,
        }
      : { clientId, consultationId: consult.id },
  );
  refresh();
  redirect({ href: `/clients/${clientId}/plans/${plan.id}`, locale });
}

const measurementsSchema = z
  .object({
    perimeters: z.record(z.string(), z.number().finite().nonnegative().optional()).default({}),
    skinfolds: z.record(z.string(), z.number().finite().nonnegative().optional()).default({}),
  })
  .passthrough();

export type ConsultationPayload = {
  clientId: string;
  client?: {
    birthDate?: string;
    sex?: Sex;
    ethnicity?: Ethnicity;
    profession?: string;
    anamnesis?: Anamnesis;
  };
  consultationId: string;
  consultation?: {
    date?: string;
    notes?: string;
    measurements?: Measurements;
    foodHistory?: FoodHistory;
    energy?: EnergyConfig;
    macros?: MacroConfig;
  };
};

async function persistConsultation(payload: ConsultationPayload) {
  if (payload.client) {
    const c = payload.client;
    await repo.updateClient(payload.clientId, {
      birthDate: c.birthDate === undefined ? undefined : isoDate.safeParse(c.birthDate).success ? c.birthDate : "",
      sex: sexOf(c.sex) ?? ("" as never),
      ethnicity: ethnicityOf(c.ethnicity) ?? ("" as never),
      profession: c.profession ?? "",
      anamnesis: c.anamnesis ?? {},
    });
  }
  if (payload.consultation) {
    const c = payload.consultation;
    if (c.measurements) measurementsSchema.parse(c.measurements);
    await repo.updateConsultation(payload.consultationId, {
      ...c,
      date: c.date && isoDate.safeParse(c.date).success ? c.date : undefined,
    });
  }
}

export async function saveConsultationAction(_locale: string, payload: ConsultationPayload) {
  await persistConsultation(payload);
  refresh();
}

/** Save the whole consultation workspace (client + consultation + plan) at once. */
export async function saveWorkspaceAction(
  _locale: string,
  payload: ConsultationPayload & { planId: string; plan: PlanPayload },
) {
  await persistConsultation(payload);
  await persistPlan(payload.planId, payload.plan);
  refresh();
}

export async function deleteConsultationAction(locale: string, consultationId: string, clientId: string) {
  await repo.deleteConsultation(consultationId);
  refresh();
  redirect({ href: `/clients/${clientId}`, locale });
}

// --- Plans -------------------------------------------------------------------------
export type PlanPayload = {
  meals: Meal[];
  language: PlanLanguage;
  pdfTemplateId?: string;
  supplementation?: string;
  notes?: string;
  motivationalQuote?: string;
  nextAppointment?: string;
};

const mealsSchema = z.array(
  z
    .object({
      id: z.string(),
      name: z.string().max(200),
      time: z.string().max(20).optional(),
      options: z.array(
        z
          .object({ id: z.string(), content: z.string().max(5000), items: z.array(z.any()).optional() })
          .passthrough(),
      ),
    })
    .passthrough(),
);

async function persistPlan(planId: string, payload: PlanPayload) {
  const plan = await repo.updatePlan(planId, {
    meals: mealsSchema.parse(payload.meals) as Meal[],
    language: lang(payload.language),
    pdfTemplateId: payload.pdfTemplateId || "classic",
    supplementation: payload.supplementation ?? "",
    notes: payload.notes ?? "",
    motivationalQuote: payload.motivationalQuote ?? "",
    nextAppointment: payload.nextAppointment ?? "",
  });
  if (!plan) throw new Error("Plan not found");
  return plan;
}

export async function savePlanAction(_locale: string, planId: string, payload: PlanPayload) {
  const plan = await persistPlan(planId, payload);
  refresh();
  return { updatedAt: plan.updatedAt };
}

/** Duplicate a plan into a new standalone plan and open it. */
export async function duplicateCurrentPlanAction(locale: string, planId: string, clientId: string) {
  const src = await repo.getPlan(planId);
  if (!src) return;
  const copy = await repo.createPlan({ ...src, meals: cloneMeals(src.meals), consultationId: undefined, clientId });
  refresh();
  redirect({ href: `/clients/${clientId}/plans/${copy.id}`, locale });
}

export async function deletePlanAction(locale: string, planId: string, clientId: string) {
  await repo.deletePlan(planId);
  refresh();
  redirect({ href: `/clients/${clientId}`, locale });
}

// --- Plan templates ------------------------------------------------------------------
type TemplateInput = {
  name: string;
  language: PlanLanguage;
  meals: Meal[];
  supplementation?: string;
  notes?: string;
};

function templateData(data: TemplateInput) {
  return {
    name: data.name.trim().slice(0, 200),
    language: lang(data.language),
    meals: cloneMeals(mealsSchema.parse(data.meals) as Meal[]),
    supplementation: data.supplementation?.trim() ?? "",
    notes: data.notes?.trim() ?? "",
  };
}

export async function saveAsTemplateAction(_locale: string, data: TemplateInput) {
  if (!data.name.trim()) return;
  await repo.createTemplate(templateData(data));
  refresh();
}

export async function updateTemplateAction(_locale: string, id: string, data: TemplateInput) {
  if (!data.name.trim()) return;
  await repo.updateTemplate(id, templateData(data));
  refresh();
}

export async function deleteTemplateAction(_locale: string, id: string) {
  await repo.deleteTemplate(id);
  refresh();
}

// --- Recommendations -------------------------------------------------------------------
const recommendationSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.enum(["hydration", "behavior", "supplementation", "restrictions", "general"]).catch("general"),
  content: z.object({ "pt-PT": z.string().trim().max(5000), en: z.string().trim().max(5000) }),
});

export async function saveRecommendationAction(
  _locale: string,
  data: { id?: string; title: string; category: string; content: { "pt-PT": string; en: string } },
) {
  const parsed = recommendationSchema.parse(data);
  if (data.id) await repo.updateRecommendation(data.id, parsed);
  else await repo.createRecommendation(parsed);
  refresh();
}

export async function deleteRecommendationAction(_locale: string, id: string) {
  await repo.deleteRecommendation(id);
  refresh();
}

// --- Uploaded PDF templates -------------------------------------------------------------
export async function uploadPdfTemplateAction(
  _locale: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: "pdfType" | "pdfSize" | "missing" }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "missing" };
  if (file.size > MAX_PDF) return { ok: false, error: "pdfSize" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (sniff(bytes) !== "pdf") return { ok: false, error: "pdfType" };
  const key = await repo.putFile("pdf-template", bytes, "application/pdf", "pdf");
  await repo.createPdfTemplate({
    name: (str(formData.get("name")) || file.name.replace(/\.pdf$/i, "")).slice(0, 200),
    storagePath: key,
  });
  refresh();
  return { ok: true };
}

export async function deletePdfTemplateAction(_locale: string, id: string) {
  await repo.deletePdfTemplate(id);
  refresh();
}

// --- Appointments & reminders -----------------------------------------------------------
const appointmentSchema = z.object({
  clientId: z.string().min(1),
  date: isoDateTime,
  durationMin: z.coerce.number().int().min(5).max(600).catch(45),
  note: z.string().trim().max(500).optional(),
  reminderEnabled: z.boolean().default(true),
});

export async function createAppointmentAction(
  _locale: string,
  data: { clientId: string; date: string; durationMin?: number; note?: string; reminderEnabled?: boolean },
) {
  const parsed = appointmentSchema.parse(data);
  await repo.createAppointment({ ...parsed, note: parsed.note || undefined });
  refresh();
}

export async function editAppointmentAction(
  _locale: string,
  appointmentId: string,
  data: { date: string; durationMin?: number; note?: string },
) {
  const parsed = appointmentSchema.pick({ date: true, durationMin: true, note: true }).parse(data);
  const before = await repo.getAppointment(appointmentId);
  await repo.updateAppointment(appointmentId, {
    ...parsed,
    note: parsed.note ?? "",
    // Rescheduled → the reminder must go out again for the new date.
    ...(before && before.date !== parsed.date ? { reminderSentAt: null as never } : {}),
  });
  refresh();
}

export async function toggleReminderAction(_locale: string, appointmentId: string, enabled: boolean) {
  await repo.updateAppointment(appointmentId, { reminderEnabled: enabled });
  refresh();
}

export async function setAppointmentStatusAction(
  _locale: string,
  appointmentId: string,
  status: "scheduled" | "completed" | "cancelled",
) {
  await repo.updateAppointment(appointmentId, { status: z.enum(["scheduled", "completed", "cancelled"]).parse(status) });
  refresh();
}

export async function deleteAppointmentAction(_locale: string, appointmentId: string) {
  await repo.deleteAppointment(appointmentId);
  refresh();
}

export async function sendReminderNowAction(
  _locale: string,
  appointmentId: string,
): Promise<ReminderOutcome | undefined> {
  const outcome = await sendReminderNow(repo.tenantReminderStore(), appointmentId);
  refresh();
  return outcome;
}

/** Process due reminders for the signed-in nutritionist only. */
export async function processDueRemindersAction(_locale: string) {
  const summary = await sendDueReminders(repo.tenantReminderStore());
  refresh();
  return { processed: summary.processed, failed: summary.results.filter((r) => r.status === "failed").length };
}

// --- Billing & consultation types ---------------------------------------------------------
const billingSchema = z.object({
  clientId: z.string().optional(),
  clientName: z.string().trim().max(200),
  typeName: z.string().trim().max(200),
  amount: money,
  date: isoDate,
  status: z.enum(["pending", "paid"]).default("pending"),
  notes: z.string().trim().max(2000).optional(),
});

export async function createBillingEntryAction(_locale: string, data: z.input<typeof billingSchema>) {
  const parsed = billingSchema.parse(data);
  if (!parsed.clientName && !parsed.typeName) return;
  await repo.createBillingEntry({ ...parsed, clientId: parsed.clientId || undefined });
  refresh();
}

export async function updateBillingEntryAction(
  _locale: string,
  id: string,
  patch: Partial<z.input<typeof billingSchema>>,
) {
  const parsed = billingSchema.omit({ clientId: true }).partial().parse(patch);
  await repo.updateBillingEntry(id, parsed);
  refresh();
}

export async function deleteBillingEntryAction(_locale: string, id: string) {
  await repo.deleteBillingEntry(id);
  refresh();
}

export async function createConsultationTypeAction(_locale: string, data: { name: string; price: number }) {
  const name = data.name.trim();
  if (!name) return;
  await repo.createConsultationType({ name, price: money.parse(data.price) });
  refresh();
}

export async function updateConsultationTypeAction(
  _locale: string,
  id: string,
  patch: { name?: string; price?: number },
) {
  await repo.updateConsultationType(id, {
    name: patch.name?.trim() || undefined,
    price: patch.price === undefined ? undefined : money.parse(patch.price),
  });
  refresh();
}

export async function deleteConsultationTypeAction(_locale: string, id: string) {
  await repo.deleteConsultationType(id);
  refresh();
}

// --- Foods & recipes -------------------------------------------------------------------------
const foodSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(200),
  baseUnit: z.enum(["g", "mL"]),
  refQty: z.coerce.number().positive().max(100_000).catch(100),
  kcal: z.coerce.number().min(0).max(100_000),
  protein: z.coerce.number().min(0).max(100_000),
  carbs: z.coerce.number().min(0).max(100_000),
  fat: z.coerce.number().min(0).max(100_000),
  brand: z.string().trim().max(200).optional(),
  category: z.string().trim().max(200).optional(),
});

export async function saveFoodAction(_locale: string, data: z.input<typeof foodSchema>) {
  const { id, ...food } = foodSchema.parse(data);
  if (id) await repo.updateFood(id, { ...food, brand: food.brand ?? "", category: food.category ?? "" });
  else await repo.createFood({ ...food, brand: food.brand || undefined, category: food.category || undefined });
  refresh();
}

export async function archiveFoodAction(_locale: string, id: string, archived = true) {
  await repo.updateFood(id, { archived });
  refresh();
}

export async function saveRecipeAction(
  _locale: string,
  data: { id?: string; name: string; servings: number; preparation?: string; items: RecipeItem[] },
) {
  const name = data.name.trim();
  if (!name) return;
  const recipe = {
    name,
    servings: Math.max(1, Math.round(Number(data.servings) || 1)),
    preparation: data.preparation?.trim() ?? "",
    items: data.items
      .filter((it) => it.foodId)
      .map((it) => ({ ...it, qty: Math.max(0, Number(it.qty) || 0) })),
  };
  if (data.id) await repo.updateRecipe(data.id, recipe);
  else await repo.createRecipe(recipe);
  refresh();
}

export async function deleteRecipeAction(_locale: string, id: string) {
  await repo.deleteRecipe(id);
  refresh();
}
