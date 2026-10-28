import {
  byNewest,
  DEFAULT_CONSULTATION_TYPES,
  emptyMeasurements,
  normalizeMeasurements,
  type Appointment,
  type BillingEntry,
  type Client,
  type Consultation,
  type ConsultationType,
  type DbFood,
  type MealPlan,
  type NutritionistProfile,
  type PdfTemplateFile,
  type PlanTemplate,
  type Recipe,
  type Recommendation,
  type SentMessage,
} from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { newId, todayISO } from "@/lib/utils";
import { normalizeAppearance } from "@/lib/theme";
import { VOUCHER_NOTE } from "@/lib/billing/metrics";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AuthStatus,
  BillingPatch,
  EmailChangeResult,
  EmailLinkType,
  MfaEnrollment,
  MfaStatus,
  PasswordResult,
  FileKind,
  NewAppointment,
  NewBillingEntry,
  NewClient,
  NewFood,
  NewRecipe,
  ReminderStore,
} from "./repo-types";

// ---------------------------------------------------------------------------
// Supabase-backed repository (production).
//
// Implements the Repository contract (repo-types.ts). Tenant isolation is
// enforced by Row Level Security (auth.uid()), so interactive functions use
// the user-scoped client only. The service-role client is used exclusively by
// cronReminderStore(), for the trusted daily reminder job.
// ---------------------------------------------------------------------------

/** Private Storage bucket for logos and uploaded PDF templates (migration 0004). */
export const FILES_BUCKET = "alimea-files";

const db = (): Promise<SupabaseClient> => createSupabaseServerClient();

async function currentNid(supabase?: SupabaseClient): Promise<string> {
  const client = supabase ?? (await db());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login"); // see repo-memory nid()
  if (await mfaPending(client)) redirect("/mfa");
  return user.id;
}

// --- Mappers ---------------------------------------------------------------
type Row = Record<string, any>;  

const opt = <T>(v: T | null | undefined): T | undefined => (v == null ? undefined : v);
const dateOnly = (v: unknown) => (typeof v === "string" ? v.slice(0, 10) : String(v));

const toProfile = (r: Row): NutritionistProfile => ({
  id: r.id,
  name: r.name ?? "",
  email: r.email ?? "",
  credential: r.credential ?? "",
  instagram: opt(r.instagram),
  phone: opt(r.phone),
  address: opt(r.address),
  logoUrl: opt(r.logo_url),
  pdfTemplate: opt(r.pdf_template),
  interfaceLanguage: r.interface_language === "en" ? "en" : "pt-PT",
  appearance: normalizeAppearance(r.appearance),
});

const toClient = (r: Row): Client => ({
  id: r.id,
  nutritionistId: r.nutritionist_id,
  name: r.name,
  email: opt(r.email),
  phone: opt(r.phone),
  birthDate: r.birth_date ? dateOnly(r.birth_date) : undefined,
  sex: opt(r.sex),
  ethnicity: opt(r.ethnicity),
  profession: opt(r.profession),
  goals: opt(r.goals),
  notes: opt(r.notes),
  nif: opt(r.nif),
  healthInsurer: opt(r.health_insurer),
  insuranceNumber: opt(r.insurance_number),
  nutritionVoucher: r.nutrition_voucher === true || undefined,
  dataConsentAt: r.data_consent_at ? dateOnly(r.data_consent_at) : undefined,
  anamnesis: opt(r.anamnesis),
  createdAt: r.created_at,
});

const emptyJson = (v: unknown) =>
  v && typeof v === "object" && Object.keys(v as object).length > 0 ? v : undefined;

const toConsultation = (r: Row): Consultation => ({
  id: r.id,
  clientId: r.client_id,
  date: dateOnly(r.date),
  consultationNumber: opt(r.consultation_number),
  measurements: normalizeMeasurements(r.measurements),
  foodHistory: emptyJson(r.food_history) as Consultation["foodHistory"],
  energy: emptyJson(r.energy) as Consultation["energy"],
  macros: emptyJson(r.macros) as Consultation["macros"],
  notes: opt(r.notes),
  planId: opt(r.plan_id),
  consultationTypeId: opt(r.consultation_type_id),
  createdAt: r.created_at,
});

const toFood = (r: Row): DbFood => ({
  id: r.id,
  nutritionistId: r.nutritionist_id,
  name: r.name,
  baseUnit: r.base_unit === "mL" ? "mL" : "g",
  refQty: Number(r.ref_qty) || 100,
  kcal: Number(r.kcal) || 0,
  protein: Number(r.protein) || 0,
  carbs: Number(r.carbs) || 0,
  fat: Number(r.fat) || 0,
  brand: opt(r.brand),
  category: opt(r.category),
  archived: Boolean(r.archived),
  createdAt: r.created_at,
});

const toRecipe = (r: Row): Recipe => ({
  id: r.id,
  nutritionistId: r.nutritionist_id,
  name: r.name,
  servings: Number(r.servings) || 1,
  preparation: opt(r.preparation),
  items: ((r.recipe_items ?? []) as Row[])
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((it) => ({ id: it.id, foodId: it.food_id, name: it.name ?? "", qty: Number(it.qty) || 0 })),
  createdAt: r.created_at,
});

const toConsultationType = (r: Row): ConsultationType => ({
  id: r.id,
  nutritionistId: r.nutritionist_id,
  name: r.name,
  price: Number(r.price) || 0,
  isDefault: Boolean(r.is_default),
});

const toBillingEntry = (r: Row): BillingEntry => ({
  id: r.id,
  nutritionistId: r.nutritionist_id,
  clientId: opt(r.client_id),
  consultationId: opt(r.consultation_id),
  clientName: r.client_name ?? "",
  typeName: r.type_name ?? "",
  amount: Number(r.amount) || 0,
  date: dateOnly(r.date),
  status: r.status === "paid" ? "paid" : "pending",
  notes: opt(r.notes),
  source: r.source === "auto" ? "auto" : "manual",
  createdAt: r.created_at,
});

const toPlan = (r: Row): MealPlan => ({
  id: r.id,
  clientId: r.client_id,
  consultationId: opt(r.consultation_id),
  language: r.language === "en" ? "en" : "pt-PT",
  pdfTemplateId: opt(r.pdf_template_id),
  meals: r.meals ?? [],
  supplementation: opt(r.supplementation),
  notes: opt(r.notes),
  motivationalQuote: opt(r.motivational_quote),
  nextAppointment: opt(r.next_appointment),
  hideFoodItems: r.hide_food_items === true || undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toRecommendation = (r: Row): Recommendation => ({
  id: r.id,
  nutritionistId: r.nutritionist_id,
  category: r.category,
  title: r.title,
  content: { "pt-PT": r.content?.["pt-PT"] ?? "", en: r.content?.en ?? "" },
});

const toTemplate = (r: Row): PlanTemplate => ({
  id: r.id,
  nutritionistId: r.nutritionist_id,
  name: r.name,
  language: r.language === "en" ? "en" : "pt-PT",
  meals: r.meals ?? [],
  supplementation: opt(r.supplementation),
  notes: opt(r.notes),
});

const toPdfTemplate = (r: Row): PdfTemplateFile => ({
  id: r.id,
  nutritionistId: r.nutritionist_id,
  name: r.name,
  storagePath: r.storage_path,
  createdAt: r.created_at,
});

const toAppointment = (r: Row): Appointment => ({
  id: r.id,
  clientId: r.client_id,
  date: r.date,
  durationMin: opt(r.duration_min),
  note: opt(r.note),
  status: r.status,
  reminderEnabled: Boolean(r.reminder_enabled),
  reminderChannel: "sms",
  reminderSentAt: opt(r.reminder_sent_at),
});

const toSentMessage = (r: Row): SentMessage => ({
  id: r.id,
  appointmentId: r.appointment_id,
  clientId: r.client_id,
  to: r.to,
  channel: "sms",
  body: r.body,
  status: r.status,
  provider: r.provider,
  createdAt: r.created_at,
});

type Res<T> = { data: T | null; error: { message: string } | null };

function unwrap<T>(res: Res<T>): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}

function maybe<T>(res: Res<T>): T | undefined {
  if (res.error) throw new Error(res.error.message);
  return res.data ?? undefined;
}

function check(res: { error: { message: string } | null }): void {
  if (res.error) throw new Error(res.error.message);
}

/** Build a column patch from a camelCase patch: only defined keys, `"" → null`. */
function columns<T extends object>(patch: T, map: Partial<Record<keyof T, string>>) {
  const row: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(map) as [keyof T, string][]) {
    const v = patch[k];
    if (v !== undefined) row[col] = v === "" ? null : v;
  }
  return row;
}

// --- Auth ------------------------------------------------------------------
/** True when the account has 2FA but this session has not passed the challenge. */
async function mfaPending(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.nextLevel === "aal2" && data.currentLevel !== "aal2";
}

export async function authenticate(email: string, password: string): Promise<AuthStatus> {
  const supabase = await db();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return "invalid";
  return (await mfaPending(supabase)) ? "mfa" : "ok";
}

export async function signOut(): Promise<void> {
  await (await db()).auth.signOut();
}

export async function getAuthNid(): Promise<string | null> {
  const supabase = await db();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || (await mfaPending(supabase))) return null;
  return user.id;
}

export async function getLoginEmail(): Promise<string | null> {
  const {
    data: { user },
  } = await (await db()).auth.getUser();
  return user?.email ?? null;
}

export async function requestPasswordReset(email: string): Promise<void> {
  // The link target lives in the Supabase email template (see README).
  const { error } = await (await db()).auth.resetPasswordForEmail(email);
  if (error) console.error("[alimea] password reset email failed", error.message);
}

export async function redeemEmailLink(tokenHash: string, type: EmailLinkType): Promise<boolean> {
  const { error } = await (await db()).auth.verifyOtp({ token_hash: tokenHash, type });
  return !error;
}

function passwordError(code: string | undefined): PasswordResult {
  if (code === "weak_password") return "weak";
  if (code === "same_password") return "same";
  return "failed";
}

export async function setPassword(password: string): Promise<PasswordResult> {
  const { error } = await (await db()).auth.updateUser({ password });
  if (error) console.error("[alimea] set password failed", error.message);
  return error ? passwordError(error.code) : "ok";
}

export async function changePassword(current: string, next: string): Promise<PasswordResult> {
  const supabase = await db();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return "failed";
  // Check the current password on a throwaway client, so the cookie session
  // (and its 2FA level) is left untouched.
  const probe = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: wrong } = await probe.auth.signInWithPassword({ email: user.email, password: current });
  if (wrong) return "invalid";
  const { error } = await supabase.auth.updateUser({ password: next });
  return error ? passwordError(error.code) : "ok";
}

export async function changeLoginEmail(email: string): Promise<EmailChangeResult> {
  const { data, error } = await (await db()).auth.updateUser({ email });
  if (error) return error.code === "email_exists" ? "exists" : "failed";
  // With "confirm email change" on, the address only switches once the emailed
  // link is opened.
  return data.user?.email?.toLowerCase() === email.toLowerCase() ? "ok" : "confirm";
}

export async function getMfaStatus(): Promise<MfaStatus> {
  const supabase = await db();
  const { data } = await supabase.auth.mfa.listFactors();
  return { supported: true, enabled: Boolean(data?.totp.length), pending: await mfaPending(supabase) };
}

export async function startMfaEnrollment(): Promise<MfaEnrollment | null> {
  const supabase = await db();
  // Drop half-finished enrolments, otherwise Supabase refuses a new one.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Alimea ${Date.now()}` });
  if (error || !data) return null;
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyMfa(code: string, factorId?: string): Promise<boolean> {
  const supabase = await db();
  const id = factorId ?? (await supabase.auth.mfa.listFactors()).data?.totp[0]?.id;
  if (!id) return false;
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: id, code });
  return !error;
}

export async function disableMfa(): Promise<boolean> {
  const supabase = await db();
  const { data } = await supabase.auth.mfa.listFactors();
  for (const f of data?.all ?? []) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) return false;
  }
  return true;
}

// --- Profile ---------------------------------------------------------------
export async function getProfile(): Promise<NutritionistProfile> {
  const supabase = await db();
  const id = await currentNid(supabase);
  const row = maybe(await supabase.from("profiles").select("*").eq("id", id).maybeSingle());
  if (row) return toProfile(row);
  // Profile row missing (e.g. trigger not installed) — create it on the fly.
  return toProfile(unwrap(await supabase.from("profiles").insert({ id }).select("*").single()));
}

export async function updateProfile(patch: Partial<Omit<NutritionistProfile, "id">>) {
  const supabase = await db();
  const id = await currentNid(supabase);
  const row = columns(patch, {
    name: "name",
    email: "email",
    credential: "credential",
    instagram: "instagram",
    phone: "phone",
    address: "address",
    logoUrl: "logo_url",
    pdfTemplate: "pdf_template",
    interfaceLanguage: "interface_language",
    appearance: "appearance",
  });
  // name/email/credential are NOT NULL in the schema.
  for (const k of ["name", "email", "credential"]) if (row[k] === null) row[k] = "";
  return toProfile(unwrap(await supabase.from("profiles").update(row).eq("id", id).select("*").single()));
}

// --- Clients ---------------------------------------------------------------
const CLIENT_COLUMNS = {
  name: "name",
  email: "email",
  phone: "phone",
  birthDate: "birth_date",
  sex: "sex",
  ethnicity: "ethnicity",
  profession: "profession",
  goals: "goals",
  notes: "notes",
  nif: "nif",
  healthInsurer: "health_insurer",
  insuranceNumber: "insurance_number",
  nutritionVoucher: "nutrition_voucher",
  dataConsentAt: "data_consent_at",
  anamnesis: "anamnesis",
} as const;

export async function listClients(): Promise<Client[]> {
  const rows = unwrap(await (await db()).from("clients").select("*").order("name"));
  return (rows as Row[]).map(toClient);
}

export async function getClient(id: string) {
  const row = maybe(await (await db()).from("clients").select("*").eq("id", id).maybeSingle());
  return row ? toClient(row) : undefined;
}

export async function createClient(data: NewClient): Promise<Client> {
  const supabase = await db();
  const row: Record<string, unknown> = { nutritionist_id: await currentNid(supabase), ...columns(data, CLIENT_COLUMNS) };
  if (!row.anamnesis) row.anamnesis = {};
  return toClient(unwrap(await supabase.from("clients").insert(row).select("*").single()));
}

export async function updateClient(id: string, patch: Partial<NewClient>) {
  const row = columns(patch, CLIENT_COLUMNS);
  if (!Object.keys(row).length) return getClient(id);
  if (row.name === null) delete row.name; // NOT NULL
  const res = await (await db()).from("clients").update(row).eq("id", id).select("*").maybeSingle();
  const data = maybe(res);
  return data ? toClient(data) : undefined;
}

export async function deleteClient(id: string): Promise<void> {
  // consultations, plans, appointments and messages cascade via FK.
  check(await (await db()).from("clients").delete().eq("id", id));
}

// --- Consultations ---------------------------------------------------------
export async function listConsultations(clientId: string): Promise<Consultation[]> {
  const rows = unwrap(
    await (await db()).from("consultations").select("*").eq("client_id", clientId),
  );
  return (rows as Row[]).map(toConsultation).sort(byNewest);
}

export async function listAllConsultations(): Promise<Consultation[]> {
  const rows = unwrap(await (await db()).from("consultations").select("*"));
  return (rows as Row[]).map(toConsultation).sort(byNewest);
}

export async function getConsultation(id: string) {
  const row = maybe(await (await db()).from("consultations").select("*").eq("id", id).maybeSingle());
  return row ? toConsultation(row) : undefined;
}

export async function createConsultation(
  clientId: string,
  opts: { duplicateFrom?: Consultation; consultationTypeId?: string; date?: string } = {},
): Promise<Consultation> {
  const supabase = await db();
  const client = await getClient(clientId);
  if (!client) throw new Error("Client not found");
  const { count } = await supabase
    .from("consultations")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);
  const last = opts.duplicateFrom;
  const typeId = opts.consultationTypeId ?? last?.consultationTypeId;
  const consult = toConsultation(
    unwrap(
      await supabase
        .from("consultations")
        .insert({
          client_id: clientId,
          date: opts.date ?? todayISO(),
          consultation_number: (count ?? 0) + 1,
          measurements: last ? normalizeMeasurements(last.measurements) : emptyMeasurements(),
          food_history: last?.foodHistory ?? {},
          energy: last?.energy ? { ...last.energy, targetKcal: undefined } : {},
          macros: last?.macros ?? {},
          notes: "",
          consultation_type_id: typeId ?? null,
        })
        .select("*")
        .single(),
    ),
  );

  // Auto-create the billing entry. A failure here must not lose the consultation.
  try {
    const types = await listConsultationTypes();
    const type = types.find((t) => t.id === typeId) ?? types[0];
    check(
      await supabase.from("billing_entries").insert({
        nutritionist_id: client.nutritionistId,
        client_id: clientId,
        consultation_id: consult.id,
        client_name: client.name,
        type_name: type?.name ?? "",
        // Cheque-nutricionista: the client is not charged.
        amount: client.nutritionVoucher ? 0 : (type?.price ?? 0),
        date: consult.date,
        status: client.nutritionVoucher ? "paid" : "pending",
        notes: client.nutritionVoucher ? VOUCHER_NOTE : null,
        source: "auto",
      }),
    );
  } catch (e) {
    console.error("[alimea] auto billing failed for consultation", consult.id, e);
  }
  return consult;
}

export async function updateConsultation(
  id: string,
  patch: Partial<Omit<Consultation, "id" | "clientId" | "createdAt">>,
) {
  const row = columns(
    { ...patch, measurements: patch.measurements && normalizeMeasurements(patch.measurements) },
    {
      date: "date",
      notes: "notes",
      consultationNumber: "consultation_number",
      measurements: "measurements",
      foodHistory: "food_history",
      energy: "energy",
      macros: "macros",
      planId: "plan_id",
      consultationTypeId: "consultation_type_id",
    },
  );
  if (!Object.keys(row).length) return getConsultation(id);
  const data = maybe(await (await db()).from("consultations").update(row).eq("id", id).select("*").maybeSingle());
  return data ? toConsultation(data) : undefined;
}

export async function deleteConsultation(id: string): Promise<void> {
  const supabase = await db();
  check(await supabase.from("meal_plans").delete().eq("consultation_id", id));
  check(
    await supabase
      .from("billing_entries")
      .delete()
      .eq("consultation_id", id)
      .eq("source", "auto")
      .eq("status", "pending"),
  );
  check(await supabase.from("consultations").delete().eq("id", id));
}

// --- Consultation types & billing ------------------------------------------
export async function listConsultationTypes(): Promise<ConsultationType[]> {
  const supabase = await db();
  const rows = unwrap(
    await supabase.from("consultation_types").select("*").order("created_at", { ascending: true }),
  ) as Row[];
  if (rows.length) return rows.map(toConsultationType);
  // Lazily seed the built-in types the first time a tenant needs them.
  const nid = await currentNid(supabase);
  const seeded = unwrap(
    await supabase
      .from("consultation_types")
      .insert(DEFAULT_CONSULTATION_TYPES.map((t) => ({ nutritionist_id: nid, ...t, is_default: true })))
      .select("*"),
  ) as Row[];
  return seeded.map(toConsultationType);
}

export async function createConsultationType(data: { name: string; price: number }) {
  const supabase = await db();
  const row = { nutritionist_id: await currentNid(supabase), ...data, is_default: false };
  return toConsultationType(unwrap(await supabase.from("consultation_types").insert(row).select("*").single()));
}

export async function updateConsultationType(id: string, patch: { name?: string; price?: number }) {
  const data = maybe(
    await (await db()).from("consultation_types").update(columns(patch, { name: "name", price: "price" })).eq("id", id).select("*").maybeSingle(),
  );
  return data ? toConsultationType(data) : undefined;
}

export async function deleteConsultationType(id: string): Promise<void> {
  check(await (await db()).from("consultation_types").delete().eq("id", id));
}

export async function listBillingEntries(): Promise<BillingEntry[]> {
  const rows = unwrap(await (await db()).from("billing_entries").select("*")) as Row[];
  return rows.map(toBillingEntry).sort(byNewest);
}

export async function createBillingEntry(data: NewBillingEntry): Promise<BillingEntry> {
  const supabase = await db();
  const row = {
    nutritionist_id: await currentNid(supabase),
    client_id: data.clientId ?? null,
    client_name: data.clientName,
    type_name: data.typeName,
    amount: data.amount,
    date: data.date,
    status: data.status ?? "pending",
    notes: data.notes ?? null,
    source: "manual",
  };
  return toBillingEntry(unwrap(await supabase.from("billing_entries").insert(row).select("*").single()));
}

export async function updateBillingEntry(id: string, patch: BillingPatch) {
  const row = columns(patch, {
    clientName: "client_name",
    typeName: "type_name",
    amount: "amount",
    date: "date",
    status: "status",
    notes: "notes",
  });
  for (const k of ["client_name", "type_name"]) if (row[k] === null) row[k] = "";
  const data = maybe(await (await db()).from("billing_entries").update(row).eq("id", id).select("*").maybeSingle());
  return data ? toBillingEntry(data) : undefined;
}

export async function deleteBillingEntry(id: string): Promise<void> {
  check(await (await db()).from("billing_entries").delete().eq("id", id));
}

// --- Plans -----------------------------------------------------------------
export async function listPlans(clientId?: string): Promise<MealPlan[]> {
  let query = (await db()).from("meal_plans").select("*").order("updated_at", { ascending: false });
  if (clientId) query = query.eq("client_id", clientId);
  return (unwrap(await query) as Row[]).map(toPlan);
}

export async function getPlan(id: string) {
  const row = maybe(await (await db()).from("meal_plans").select("*").eq("id", id).maybeSingle());
  return row ? toPlan(row) : undefined;
}

export async function createPlan(data: Partial<MealPlan> & { clientId: string }): Promise<MealPlan> {
  const supabase = await db();
  const plan = toPlan(
    unwrap(
      await supabase
        .from("meal_plans")
        .insert({
          client_id: data.clientId,
          consultation_id: data.consultationId ?? null,
          language: data.language ?? "pt-PT",
          pdf_template_id: data.pdfTemplateId ?? "classic",
          meals: data.meals ?? [],
          supplementation: data.supplementation ?? "",
          notes: data.notes ?? "",
          motivational_quote: data.motivationalQuote ?? "",
          next_appointment: data.nextAppointment ?? "",
          hide_food_items: data.hideFoodItems ?? false,
        })
        .select("*")
        .single(),
    ),
  );
  if (plan.consultationId) {
    check(await supabase.from("consultations").update({ plan_id: plan.id }).eq("id", plan.consultationId));
  }
  return plan;
}

export async function updatePlan(
  id: string,
  patch: Partial<Omit<MealPlan, "id" | "clientId" | "createdAt" | "updatedAt">>,
) {
  const row = {
    ...columns(patch, {
      consultationId: "consultation_id",
      language: "language",
      pdfTemplateId: "pdf_template_id",
      meals: "meals",
      supplementation: "supplementation",
      notes: "notes",
      motivationalQuote: "motivational_quote",
      nextAppointment: "next_appointment",
      hideFoodItems: "hide_food_items",
    }),
    updated_at: new Date().toISOString(),
  };
  const data = maybe(await (await db()).from("meal_plans").update(row).eq("id", id).select("*").maybeSingle());
  return data ? toPlan(data) : undefined;
}

export async function deletePlan(id: string): Promise<void> {
  const supabase = await db();
  check(await supabase.from("consultations").update({ plan_id: null }).eq("plan_id", id));
  check(await supabase.from("meal_plans").delete().eq("id", id));
}

// --- Foods & recipes -------------------------------------------------------
const FOOD_COLUMNS = {
  name: "name",
  baseUnit: "base_unit",
  refQty: "ref_qty",
  kcal: "kcal",
  protein: "protein",
  carbs: "carbs",
  fat: "fat",
  brand: "brand",
  category: "category",
  archived: "archived",
} as const;

export async function listFoods(opts: { includeArchived?: boolean } = {}): Promise<DbFood[]> {
  let query = (await db()).from("foods").select("*").order("name");
  if (!opts.includeArchived) query = query.eq("archived", false);
  return (unwrap(await query) as Row[]).map(toFood);
}

export async function createFood(data: NewFood): Promise<DbFood> {
  const supabase = await db();
  const row = { nutritionist_id: await currentNid(supabase), archived: false, ...columns(data, FOOD_COLUMNS) };
  return toFood(unwrap(await supabase.from("foods").insert(row).select("*").single()));
}

export async function updateFood(id: string, patch: Partial<NewFood>) {
  const data = maybe(
    await (await db()).from("foods").update(columns(patch, FOOD_COLUMNS)).eq("id", id).select("*").maybeSingle(),
  );
  return data ? toFood(data) : undefined;
}

export async function listRecipes(): Promise<Recipe[]> {
  const rows = unwrap(await (await db()).from("recipes").select("*, recipe_items(*)").order("name"));
  return (rows as Row[]).map(toRecipe);
}

async function getRecipe(id: string) {
  const row = maybe(
    await (await db()).from("recipes").select("*, recipe_items(*)").eq("id", id).maybeSingle(),
  );
  return row ? toRecipe(row) : undefined;
}

async function replaceRecipeItems(supabase: SupabaseClient, recipeId: string, items: Recipe["items"]) {
  check(await supabase.from("recipe_items").delete().eq("recipe_id", recipeId));
  if (!items.length) return;
  check(
    await supabase.from("recipe_items").insert(
      items.map((it, i) => ({ recipe_id: recipeId, food_id: it.foodId, name: it.name, qty: it.qty, position: i })),
    ),
  );
}

export async function createRecipe(data: NewRecipe): Promise<Recipe> {
  const supabase = await db();
  const row = unwrap(
    await supabase
      .from("recipes")
      .insert({
        nutritionist_id: await currentNid(supabase),
        name: data.name,
        servings: data.servings,
        preparation: data.preparation ?? null,
      })
      .select("*")
      .single(),
  ) as Row;
  await replaceRecipeItems(supabase, row.id, data.items ?? []);
  return (await getRecipe(row.id))!;
}

export async function updateRecipe(id: string, patch: Partial<NewRecipe>) {
  const supabase = await db();
  const row = columns(patch, { name: "name", servings: "servings", preparation: "preparation" });
  if (Object.keys(row).length) check(await supabase.from("recipes").update(row).eq("id", id));
  if (patch.items !== undefined) await replaceRecipeItems(supabase, id, patch.items);
  return getRecipe(id);
}

export async function deleteRecipe(id: string): Promise<void> {
  check(await (await db()).from("recipes").delete().eq("id", id));
}

// --- Recommendations & templates ------------------------------------------
export async function listRecommendations(): Promise<Recommendation[]> {
  const rows = unwrap(await (await db()).from("recommendations").select("*").order("created_at"));
  return (rows as Row[]).map(toRecommendation);
}

export async function createRecommendation(data: Omit<Recommendation, "id" | "nutritionistId">) {
  const supabase = await db();
  const row = { nutritionist_id: await currentNid(supabase), ...data };
  return toRecommendation(unwrap(await supabase.from("recommendations").insert(row).select("*").single()));
}

export async function updateRecommendation(id: string, patch: Partial<Omit<Recommendation, "id" | "nutritionistId">>) {
  const row = columns(patch, { category: "category", title: "title", content: "content" });
  const data = maybe(await (await db()).from("recommendations").update(row).eq("id", id).select("*").maybeSingle());
  return data ? toRecommendation(data) : undefined;
}

export async function deleteRecommendation(id: string): Promise<void> {
  check(await (await db()).from("recommendations").delete().eq("id", id));
}

export async function listTemplates(): Promise<PlanTemplate[]> {
  const rows = unwrap(await (await db()).from("plan_templates").select("*").order("created_at"));
  return (rows as Row[]).map(toTemplate);
}

export async function createTemplate(data: Omit<PlanTemplate, "id" | "nutritionistId">) {
  const supabase = await db();
  const row = {
    nutritionist_id: await currentNid(supabase),
    name: data.name,
    language: data.language,
    meals: data.meals,
    supplementation: data.supplementation ?? null,
    notes: data.notes ?? null,
  };
  return toTemplate(unwrap(await supabase.from("plan_templates").insert(row).select("*").single()));
}

export async function updateTemplate(id: string, patch: Partial<Omit<PlanTemplate, "id" | "nutritionistId">>) {
  const row = columns(patch, {
    name: "name",
    language: "language",
    meals: "meals",
    supplementation: "supplementation",
    notes: "notes",
  });
  const data = maybe(await (await db()).from("plan_templates").update(row).eq("id", id).select("*").maybeSingle());
  return data ? toTemplate(data) : undefined;
}

export async function deleteTemplate(id: string): Promise<void> {
  check(await (await db()).from("plan_templates").delete().eq("id", id));
}

// --- Appointments & SMS ----------------------------------------------------
export async function listAppointments(): Promise<Appointment[]> {
  const rows = unwrap(await (await db()).from("appointments").select("*").order("date"));
  return (rows as Row[]).map(toAppointment);
}

export async function getAppointment(id: string) {
  const row = maybe(await (await db()).from("appointments").select("*").eq("id", id).maybeSingle());
  return row ? toAppointment(row) : undefined;
}

export async function createAppointment(data: NewAppointment): Promise<Appointment> {
  const row = {
    client_id: data.clientId,
    date: data.date,
    duration_min: data.durationMin ?? 45,
    note: data.note ?? null,
    status: data.status ?? "scheduled",
    reminder_enabled: data.reminderEnabled ?? true,
    reminder_channel: "sms",
    reminder_sent_at: data.reminderSentAt ?? null,
  };
  return toAppointment(unwrap(await (await db()).from("appointments").insert(row).select("*").single()));
}

export async function updateAppointment(id: string, patch: Partial<Omit<Appointment, "id">>) {
  const row = columns(patch, {
    clientId: "client_id",
    date: "date",
    durationMin: "duration_min",
    note: "note",
    status: "status",
    reminderEnabled: "reminder_enabled",
    reminderSentAt: "reminder_sent_at",
  });
  const data = maybe(await (await db()).from("appointments").update(row).eq("id", id).select("*").maybeSingle());
  return data ? toAppointment(data) : undefined;
}

export async function deleteAppointment(id: string): Promise<void> {
  check(await (await db()).from("appointments").delete().eq("id", id));
}

export async function listSentMessages(): Promise<SentMessage[]> {
  const rows = unwrap(
    await (await db()).from("sent_messages").select("*").order("created_at", { ascending: false }).limit(100),
  );
  return (rows as Row[]).map(toSentMessage);
}

function reminderStore(client: () => Promise<SupabaseClient>): ReminderStore {
  return {
    async listAppointments() {
      // Only rows the reminder engine can act on.
      const rows = unwrap(
        await (await client())
          .from("appointments")
          .select("*")
          .eq("status", "scheduled")
          .eq("reminder_enabled", true)
          .is("reminder_sent_at", null)
          .gte("date", new Date().toISOString()),
      );
      return (rows as Row[]).map(toAppointment);
    },
    async getClient(id) {
      const row = maybe(await (await client()).from("clients").select("*").eq("id", id).maybeSingle());
      return row ? toClient(row) : undefined;
    },
    async getProfile(id) {
      const row = maybe(await (await client()).from("profiles").select("*").eq("id", id).maybeSingle());
      return row ? toProfile(row) : undefined;
    },
    async markReminderSent(id, when) {
      check(await (await client()).from("appointments").update({ reminder_sent_at: when }).eq("id", id));
    },
    async addSentMessage(msg) {
      check(
        await (await client()).from("sent_messages").insert({
          appointment_id: msg.appointmentId,
          client_id: msg.clientId,
          to: msg.to,
          channel: "sms",
          body: msg.body,
          status: msg.status,
          provider: msg.provider,
        }),
      );
    },
  };
}

export function tenantReminderStore(): ReminderStore {
  const store = reminderStore(db);
  // Interactive "send now" may target any of the tenant's appointments, not
  // only pending ones — so list everything RLS lets the user see.
  return { ...store, listAppointments };
}

export function cronReminderStore(): ReminderStore | null {
  const admin = createSupabaseAdminClient();
  return admin ? reminderStore(async () => admin) : null;
}

// --- Uploaded PDF templates & files ----------------------------------------
export async function listPdfTemplates(): Promise<PdfTemplateFile[]> {
  const rows = unwrap(await (await db()).from("pdf_templates").select("*").order("created_at"));
  return (rows as Row[]).map(toPdfTemplate);
}

export async function getPdfTemplate(id: string) {
  const row = maybe(await (await db()).from("pdf_templates").select("*").eq("id", id).maybeSingle());
  return row ? toPdfTemplate(row) : undefined;
}

export async function createPdfTemplate(data: { name: string; storagePath: string }) {
  const supabase = await db();
  const row = { nutritionist_id: await currentNid(supabase), name: data.name, storage_path: data.storagePath };
  return toPdfTemplate(unwrap(await supabase.from("pdf_templates").insert(row).select("*").single()));
}

export async function deletePdfTemplate(id: string): Promise<void> {
  const supabase = await db();
  const tpl = await getPdfTemplate(id);
  if (!tpl) return;
  check(await supabase.from("pdf_templates").delete().eq("id", id));
  check(await supabase.from("meal_plans").update({ pdf_template_id: "classic" }).eq("pdf_template_id", id));
  await deleteFile(tpl.storagePath);
}

export async function putFile(kind: FileKind, bytes: Uint8Array, contentType: string, ext: string) {
  const supabase = await db();
  const key = `${await currentNid(supabase)}/${kind}-${newId("file")}.${ext}`;
  check(await supabase.storage.from(FILES_BUCKET).upload(key, bytes, { contentType, upsert: false }));
  return key;
}

export async function getFile(key: string) {
  const supabase = await db();
  const nid = await currentNid(supabase);
  if (!key.startsWith(`${nid}/`)) return undefined;
  const { data, error } = await supabase.storage.from(FILES_BUCKET).download(key);
  if (error || !data) return undefined;
  return { bytes: new Uint8Array(await data.arrayBuffer()), contentType: data.type || "application/octet-stream" };
}

export async function deleteFile(key: string): Promise<void> {
  if (key.startsWith("/")) return; // legacy public/ path — nothing stored
  const supabase = await db();
  await supabase.storage.from(FILES_BUCKET).remove([key]);
}
