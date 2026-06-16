"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/routing";
import {
  createAppointment,
  createBillingEntry,
  createClient,
  createConsultation,
  createConsultationType,
  createFood,
  createPlan,
  createPdfTemplate,
  createRecipe,
  createRecommendation,
  createTemplate,
  deleteBillingEntry,
  deleteConsultationType,
  deleteFood,
  deletePdfTemplate,
  deleteRecipe,
  duplicatePlan,
  getLastConsultation,
  updateAppointment,
  updateBillingEntry,
  updateClient,
  updateConsultation,
  updateConsultationType,
  updateFood,
  updatePlan,
  updateProfile,
  updateRecipe,
} from "@/lib/data/repo";
import type {
  Anamnesis,
  BillingEntry,
  EnergyConfig,
  Ethnicity,
  FoodHistory,
  MacroConfig,
  RecipeItem,
  Sex,
} from "@/lib/types";
import {
  sendDueReminders,
  sendReminderNow,
  type ReminderOutcome,
} from "@/lib/messaging/reminders";
import type {
  Meal,
  MealPlan,
  Measurements,
  PlanLanguage,
  RecommendationCategory,
} from "@/lib/types";

// --- Profile ---------------------------------------------------------------
export async function updateProfileAction(locale: string, formData: FormData) {
  const lang = str(formData.get("interfaceLanguage"));
  const patch: Record<string, unknown> = {
    name: str(formData.get("name")) ?? "",
    credential: str(formData.get("credential")) ?? "",
    email: str(formData.get("email")) ?? "",
    instagram: str(formData.get("instagram")),
    phone: str(formData.get("phone")),
    address: str(formData.get("address")),
    pdfTemplate: str(formData.get("pdfTemplate")) ?? "classic",
    interfaceLanguage: lang === "en" ? "en" : "pt-PT",
  };

  // Optional logo upload → saved under /public/uploads (local/free storage).
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const { writeFile, mkdir } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const ext = logo.type.includes("jpeg") || logo.type.includes("jpg") ? "jpg" : "png";
    const dir = join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const filename = `logo-${Date.now()}.${ext}`;
    await writeFile(join(dir, filename), Buffer.from(await logo.arrayBuffer()));
    patch.logoUrl = `/uploads/${filename}`;
  }

  await updateProfile(patch);
  revalidatePath(`/${locale}/settings`);
}

export async function createClientAction(locale: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const client = await createClient({
    name,
    email: str(formData.get("email")),
    phone: str(formData.get("phone")),
    birthDate: str(formData.get("birthDate")),
    goals: str(formData.get("goals")),
    notes: str(formData.get("notes")),
  });
  revalidatePath(`/${locale}/clients`);
  redirect({ href: `/clients/${client.id}`, locale });
}

export async function updateClientAction(
  locale: string,
  clientId: string,
  formData: FormData,
) {
  await updateClient(clientId, {
    name: str(formData.get("name")),
    email: str(formData.get("email")),
    phone: str(formData.get("phone")),
    goals: str(formData.get("goals")),
    notes: str(formData.get("notes")),
  });
  revalidatePath(`/${locale}/clients/${clientId}`);
}

/** Start a new consultation (optionally duplicating the previous one) + a blank plan, then open the editor. */
export async function startConsultationAction(
  locale: string,
  clientId: string,
  opts: { duplicateLast?: boolean; consultationTypeId?: string } = {},
) {
  const consult = await createConsultation(clientId, opts);
  const last = opts.duplicateLast ? await getLastConsultation(clientId) : undefined;
  // If duplicating, also clone the last plan content for instant reuse.
  let plan;
  if (opts.duplicateLast && last?.planId) {
    plan = await duplicatePlan(last.planId, { consultationId: consult.id });
  }
  if (!plan) {
    plan = await createPlan({ clientId, consultationId: consult.id });
  }
  revalidatePath(`/${locale}/clients/${clientId}`);
  redirect({ href: `/clients/${clientId}/plans/${plan.id}`, locale });
}

export async function savePlanAction(
  locale: string,
  planId: string,
  payload: {
    meals: Meal[];
    language: PlanLanguage;
    pdfTemplateId?: string;
    supplementation?: string;
    notes?: string;
    motivationalQuote?: string;
    nextAppointment?: string;
    consultation?: {
      id: string;
      date?: string;
      notes?: string;
      measurements?: Measurements;
    };
  },
): Promise<MealPlan | undefined> {
  if (payload.consultation?.id) {
    await updateConsultation(payload.consultation.id, {
      date: payload.consultation.date,
      notes: payload.consultation.notes,
      measurements: payload.consultation.measurements,
    });
  }
  const plan = await updatePlan(planId, {
    meals: payload.meals,
    language: payload.language,
    pdfTemplateId: payload.pdfTemplateId,
    supplementation: payload.supplementation,
    notes: payload.notes,
    motivationalQuote: payload.motivationalQuote,
    nextAppointment: payload.nextAppointment,
  });
  revalidatePath(`/${locale}/clients`);
  return plan;
}

/** Duplicate the current plan into a new editable plan and open it. */
export async function duplicateCurrentPlanAction(
  locale: string,
  planId: string,
  clientId: string,
) {
  const copy = await duplicatePlan(planId, { consultationId: undefined });
  revalidatePath(`/${locale}/clients/${clientId}`);
  if (copy) redirect({ href: `/clients/${clientId}/plans/${copy.id}`, locale });
}

/** Save the current plan content as a reusable template. */
export async function saveAsTemplateAction(
  locale: string,
  data: {
    name: string;
    language: PlanLanguage;
    meals: Meal[];
    supplementation?: string;
    notes?: string;
  },
) {
  if (!data.name.trim()) return;
  await createTemplate({
    name: data.name.trim(),
    language: data.language,
    meals: data.meals,
    supplementation: data.supplementation,
    notes: data.notes,
  });
  revalidatePath(`/${locale}/templates`);
}

// --- Uploaded PDF templates ------------------------------------------------
export async function uploadPdfTemplateAction(locale: string, formData: FormData) {
  const file = formData.get("file");
  const name = str(formData.get("name"));
  if (!(file instanceof File) || file.size === 0) return;
  const { writeFile, mkdir } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const dir = join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const filename = `pdftpl-${Date.now()}.pdf`;
  await writeFile(join(dir, filename), Buffer.from(await file.arrayBuffer()));
  await createPdfTemplate({
    name: name || file.name.replace(/\.pdf$/i, ""),
    storagePath: `/uploads/${filename}`,
  });
  revalidatePath(`/${locale}/settings`);
}

export async function deletePdfTemplateAction(locale: string, id: string) {
  await deletePdfTemplate(id);
  revalidatePath(`/${locale}/settings`);
}

/** Create a blank-ish template from the templates page (name + language). */
export async function createTemplateAction(locale: string, formData: FormData) {
  const name = str(formData.get("name"));
  if (!name) return;
  const lang = str(formData.get("language"));
  await createTemplate({
    name,
    language: lang === "en" ? "en" : "pt-PT",
    meals: [],
    supplementation: "",
    notes: "",
  });
  revalidatePath(`/${locale}/templates`);
}

export async function createRecommendationAction(locale: string, formData: FormData) {
  const title = str(formData.get("title"));
  if (!title) return;
  await createRecommendation({
    title,
    category: (str(formData.get("category")) as RecommendationCategory) || "general",
    content: {
      "pt-PT": str(formData.get("content_pt")) ?? "",
      en: str(formData.get("content_en")) ?? "",
    },
  });
  revalidatePath(`/${locale}/recommendations`);
}

// --- Appointments & reminders ----------------------------------------------
export async function createAppointmentAction(locale: string, formData: FormData) {
  const clientId = str(formData.get("clientId"));
  const date = str(formData.get("date")); // datetime-local value
  if (!clientId || !date) return;
  await createAppointment({
    clientId,
    date: new Date(date).toISOString(),
    durationMin: Number(str(formData.get("durationMin")) ?? 45) || 45,
    note: str(formData.get("note")),
    reminderEnabled: formData.get("reminderEnabled") !== null,
  });
  revalidatePath(`/${locale}/appointments`);
}

export async function toggleReminderAction(
  locale: string,
  appointmentId: string,
  enabled: boolean,
) {
  await updateAppointment(appointmentId, { reminderEnabled: enabled });
  revalidatePath(`/${locale}/appointments`);
}

export async function editAppointmentAction(
  locale: string,
  appointmentId: string,
  formData: FormData,
) {
  const date = str(formData.get("date"));
  await updateAppointment(appointmentId, {
    date: date ? new Date(date).toISOString() : undefined,
    durationMin: Number(str(formData.get("durationMin")) ?? 45) || 45,
    note: str(formData.get("note")),
  });
  revalidatePath(`/${locale}/appointments`);
}

export async function setAppointmentStatusAction(
  locale: string,
  appointmentId: string,
  status: "scheduled" | "completed" | "cancelled",
) {
  await updateAppointment(appointmentId, { status });
  revalidatePath(`/${locale}/appointments`);
}

export async function sendReminderNowAction(
  locale: string,
  appointmentId: string,
): Promise<ReminderOutcome | undefined> {
  const outcome = await sendReminderNow(appointmentId);
  revalidatePath(`/${locale}/appointments`);
  return outcome;
}

export async function processDueRemindersAction(locale: string) {
  const summary = await sendDueReminders();
  revalidatePath(`/${locale}/appointments`);
  return summary;
}

// --- Billing & consultation types ------------------------------------------
export async function createBillingEntryAction(
  locale: string,
  data: {
    clientId?: string;
    clientName: string;
    typeName: string;
    amount: number;
    date: string;
    status?: "pending" | "paid";
    notes?: string;
  },
) {
  if (!data.clientName.trim() && !data.typeName.trim()) return;
  await createBillingEntry(data);
  revalidatePath(`/${locale}/billing`);
}

export async function updateBillingEntryAction(
  locale: string,
  id: string,
  patch: Partial<
    Pick<BillingEntry, "clientName" | "typeName" | "amount" | "date" | "status" | "notes">
  >,
) {
  await updateBillingEntry(id, patch);
  revalidatePath(`/${locale}/billing`);
}

export async function deleteBillingEntryAction(locale: string, id: string) {
  await deleteBillingEntry(id);
  revalidatePath(`/${locale}/billing`);
}

export async function createConsultationTypeAction(
  locale: string,
  data: { name: string; price: number },
) {
  if (!data.name.trim()) return;
  await createConsultationType({ name: data.name.trim(), price: data.price });
  revalidatePath(`/${locale}/billing`);
}

export async function updateConsultationTypeAction(
  locale: string,
  id: string,
  patch: { name?: string; price?: number },
) {
  await updateConsultationType(id, patch);
  revalidatePath(`/${locale}/billing`);
}

export async function deleteConsultationTypeAction(locale: string, id: string) {
  await deleteConsultationType(id);
  revalidatePath(`/${locale}/billing`);
}

// --- Foods database (BOO-57) -----------------------------------------------
export async function saveFoodAction(
  locale: string,
  data: {
    id?: string;
    name: string;
    baseUnit: "g" | "mL";
    refQty: number;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    brand?: string;
    category?: string;
  },
) {
  if (!data.name.trim()) return;
  if (data.id) {
    await updateFood(data.id, data);
  } else {
    await createFood(data);
  }
  revalidatePath(`/${locale}/foods`);
}

export async function archiveFoodAction(locale: string, id: string, archived = true) {
  await updateFood(id, { archived });
  revalidatePath(`/${locale}/foods`);
}

export async function deleteFoodAction(locale: string, id: string) {
  await deleteFood(id);
  revalidatePath(`/${locale}/foods`);
}

// --- Recipes (BOO-58) ------------------------------------------------------
export async function saveRecipeAction(
  locale: string,
  data: {
    id?: string;
    name: string;
    servings: number;
    preparation?: string;
    items: RecipeItem[];
  },
) {
  if (!data.name.trim()) return;
  if (data.id) {
    await updateRecipe(data.id, data);
  } else {
    await createRecipe(data);
  }
  revalidatePath(`/${locale}/recipes`);
}

export async function deleteRecipeAction(locale: string, id: string) {
  await deleteRecipe(id);
  revalidatePath(`/${locale}/recipes`);
}

// --- Consultation workspace (anamnese / antropometria / energia / macros) ---
export async function saveConsultationAction(
  locale: string,
  payload: {
    clientId: string;
    client?: {
      sex?: Sex;
      ethnicity?: Ethnicity;
      profession?: string;
      anamnesis?: Anamnesis;
    };
    consultationId: string;
    consultation?: {
      date?: string;
      notes?: string;
      measurements?: import("@/lib/types").Measurements;
      foodHistory?: FoodHistory;
      energy?: EnergyConfig;
      macros?: MacroConfig;
    };
  },
) {
  if (payload.client) {
    await updateClient(payload.clientId, payload.client);
  }
  if (payload.consultation) {
    await updateConsultation(payload.consultationId, payload.consultation);
  }
  revalidatePath(`/${locale}/clients/${payload.clientId}`);
}

function str(v: FormDataEntryValue | null): string | undefined {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? undefined : s;
}
