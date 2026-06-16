import {
  computeBmi,
  DEFAULT_CONSULTATION_TYPES,
  type Appointment,
  type BillingEntry,
  type Client,
  type Consultation,
  type ConsultationType,
  type DbFood,
  type Measurements,
  type MealPlan,
  type NutritionistProfile,
  type PlanTemplate,
  type PdfTemplateFile,
  type Recipe,
  type Recommendation,
  type SentMessage,
} from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Supabase-backed repository.
//
// Same async API as repo-memory.ts, so it is a drop-in swap (see repo.ts).
// Per-tenant isolation is enforced by Row Level Security (auth.uid()); most
// functions therefore just query and let the database scope the rows.
//
// The reminder cron has no user session and must read across tenants, so the
// few "admin-capable" functions fall back to the service-role client when no
// user is logged in.
// ---------------------------------------------------------------------------

/** User-scoped client (RLS applies). Use for all interactive, per-tenant ops. */
async function db(): Promise<SupabaseClient> {
  return createSupabaseServerClient();
}

/** Current tenant id from the Supabase session. Throws if unauthenticated. */
async function currentNid(): Promise<string> {
  const supabase = await db();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

/**
 * Client for functions that are reused by both the interactive app (where a
 * user is logged in → RLS-scoped) and the reminder cron (no session → service
 * role). Falls back to the admin client only when there is no user.
 */
async function resilientDb(): Promise<SupabaseClient> {
  const supabase = await db();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return supabase;
  const admin = createSupabaseAdminClient();
  return admin ?? supabase;
}

// --- Mappers ---------------------------------------------------------------
// Rows come back loosely typed from PostgREST; map them into domain types.
type Row = Record<string, any>; // eslint-disable-line

function toProfile(r: Row): NutritionistProfile {
  return {
    id: r.id,
    name: r.name ?? "",
    email: r.email ?? "",
    credential: r.credential ?? "",
    instagram: r.instagram ?? undefined,
    phone: r.phone ?? undefined,
    address: r.address ?? undefined,
    logoUrl: r.logo_url ?? undefined,
    pdfTemplate: r.pdf_template ?? undefined,
    interfaceLanguage: r.interface_language === "en" ? "en" : "pt-PT",
  };
}

function toClient(r: Row): Client {
  return {
    id: r.id,
    nutritionistId: r.nutritionist_id,
    name: r.name,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    birthDate: r.birth_date ?? undefined,
    sex: r.sex ?? undefined,
    ethnicity: r.ethnicity ?? undefined,
    profession: r.profession ?? undefined,
    goals: r.goals ?? undefined,
    notes: r.notes ?? undefined,
    anamnesis: r.anamnesis ?? undefined,
    createdAt: r.created_at,
  };
}

const emptyMeasurements: Measurements = { perimeters: {}, skinfolds: {} };

function toConsultation(r: Row): Consultation {
  const m = (r.measurements ?? {}) as Partial<Measurements>;
  return {
    id: r.id,
    clientId: r.client_id,
    date: typeof r.date === "string" ? r.date.slice(0, 10) : r.date,
    consultationNumber: r.consultation_number ?? undefined,
    measurements: { ...emptyMeasurements, ...m, perimeters: { ...m.perimeters }, skinfolds: { ...m.skinfolds } },
    foodHistory: r.food_history ?? undefined,
    energy: r.energy ?? undefined,
    macros: r.macros ?? undefined,
    notes: r.notes ?? undefined,
    planId: r.plan_id ?? undefined,
    consultationTypeId: r.consultation_type_id ?? undefined,
    createdAt: r.created_at,
  };
}

function toFood(r: Row): DbFood {
  return {
    id: r.id,
    nutritionistId: r.nutritionist_id,
    name: r.name,
    baseUnit: r.base_unit === "mL" ? "mL" : "g",
    refQty: Number(r.ref_qty) || 100,
    kcal: Number(r.kcal) || 0,
    protein: Number(r.protein) || 0,
    carbs: Number(r.carbs) || 0,
    fat: Number(r.fat) || 0,
    brand: r.brand ?? undefined,
    category: r.category ?? undefined,
    archived: Boolean(r.archived),
    createdAt: r.created_at,
  };
}

function toRecipe(r: Row): Recipe {
  return {
    id: r.id,
    nutritionistId: r.nutritionist_id,
    name: r.name,
    servings: Number(r.servings) || 1,
    preparation: r.preparation ?? undefined,
    items: ((r.recipe_items ?? []) as Row[])
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((it) => ({ id: it.id, foodId: it.food_id, name: it.name ?? "", qty: Number(it.qty) || 0 })),
    createdAt: r.created_at,
  };
}

function toConsultationType(r: Row): ConsultationType {
  return {
    id: r.id,
    nutritionistId: r.nutritionist_id,
    name: r.name,
    price: Number(r.price) || 0,
    isDefault: Boolean(r.is_default),
  };
}

function toBillingEntry(r: Row): BillingEntry {
  return {
    id: r.id,
    nutritionistId: r.nutritionist_id,
    clientId: r.client_id ?? undefined,
    consultationId: r.consultation_id ?? undefined,
    clientName: r.client_name ?? "",
    typeName: r.type_name ?? "",
    amount: Number(r.amount) || 0,
    date: typeof r.date === "string" ? r.date.slice(0, 10) : r.date,
    status: r.status === "paid" ? "paid" : "pending",
    notes: r.notes ?? undefined,
    source: r.source === "auto" ? "auto" : "manual",
    createdAt: r.created_at,
  };
}

function toPlan(r: Row): MealPlan {
  return {
    id: r.id,
    clientId: r.client_id,
    consultationId: r.consultation_id ?? undefined,
    language: r.language === "en" ? "en" : "pt-PT",
    pdfTemplateId: r.pdf_template_id ?? undefined,
    meals: r.meals ?? [],
    supplementation: r.supplementation ?? undefined,
    notes: r.notes ?? undefined,
    motivationalQuote: r.motivational_quote ?? undefined,
    nextAppointment: r.next_appointment ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toRecommendation(r: Row): Recommendation {
  return {
    id: r.id,
    nutritionistId: r.nutritionist_id,
    category: r.category,
    title: r.title,
    content: { "pt-PT": r.content?.["pt-PT"] ?? "", en: r.content?.en ?? "" },
  };
}

function toTemplate(r: Row): PlanTemplate {
  return {
    id: r.id,
    nutritionistId: r.nutritionist_id,
    name: r.name,
    language: r.language === "en" ? "en" : "pt-PT",
    meals: r.meals ?? [],
    supplementation: r.supplementation ?? undefined,
    notes: r.notes ?? undefined,
  };
}

function toPdfTemplate(r: Row): PdfTemplateFile {
  return {
    id: r.id,
    nutritionistId: r.nutritionist_id,
    name: r.name,
    storagePath: r.storage_path,
    createdAt: r.created_at,
  };
}

function toAppointment(r: Row): Appointment {
  return {
    id: r.id,
    clientId: r.client_id,
    date: r.date,
    durationMin: r.duration_min ?? undefined,
    note: r.note ?? undefined,
    status: r.status,
    reminderEnabled: r.reminder_enabled,
    reminderChannel: "sms",
    reminderSentAt: r.reminder_sent_at ?? undefined,
  };
}

function toSentMessage(r: Row): SentMessage {
  return {
    id: r.id,
    appointmentId: r.appointment_id,
    clientId: r.client_id,
    to: r.to,
    channel: "sms",
    body: r.body,
    status: r.status,
    provider: r.provider,
    createdAt: r.created_at,
  };
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}

// --- Auth ------------------------------------------------------------------
export async function authenticate(
  email: string,
  password: string,
): Promise<string | null> {
  const supabase = await db();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;
  return data.user.id;
}

export async function emailExists(_email?: string): Promise<boolean> {
  // Cannot be checked anonymously under RLS; duplicate signups are rejected by
  // Supabase Auth in createAccount instead.
  return false;
}

export async function createAccount(data: {
  name: string;
  email: string;
  password: string;
}): Promise<string> {
  const supabase = await db();
  const { data: res, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: { data: { name: data.name } },
  });
  if (error) {
    if (/already|exist|registered/i.test(error.message)) throw new Error("exists");
    throw new Error(error.message);
  }
  const id = res.user?.id;
  if (!id) throw new Error("signup-failed");
  return id;
}

export async function signOut(): Promise<void> {
  const supabase = await db();
  await supabase.auth.signOut();
}

/** Current tenant id if authenticated, else null (used by the layout guard). */
export async function getAuthNid(): Promise<string | null> {
  const supabase = await db();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// --- Profile ---------------------------------------------------------------
export async function getProfile(): Promise<NutritionistProfile> {
  const nid = await currentNid();
  const supabase = await db();
  const row = unwrap(
    await supabase.from("profiles").select("*").eq("id", nid).single(),
  );
  return toProfile(row);
}

export async function getProfileById(id: string): Promise<NutritionistProfile | undefined> {
  const supabase = await resilientDb();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toProfile(data) : undefined;
}

export async function updateProfile(
  patch: Partial<NutritionistProfile>,
): Promise<NutritionistProfile> {
  const nid = await currentNid();
  const supabase = await db();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.email !== undefined) row.email = patch.email;
  if (patch.credential !== undefined) row.credential = patch.credential;
  if (patch.instagram !== undefined) row.instagram = patch.instagram;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.address !== undefined) row.address = patch.address;
  if (patch.logoUrl !== undefined) row.logo_url = patch.logoUrl;
  if (patch.pdfTemplate !== undefined) row.pdf_template = patch.pdfTemplate;
  if (patch.interfaceLanguage !== undefined) row.interface_language = patch.interfaceLanguage;
  const updated = unwrap(
    await supabase.from("profiles").update(row).eq("id", nid).select("*").single(),
  );
  return toProfile(updated);
}

// --- Clients ---------------------------------------------------------------
export async function listClients(): Promise<Client[]> {
  const supabase = await db();
  const rows = unwrap(
    await supabase.from("clients").select("*").order("name", { ascending: true }),
  );
  return (rows as Row[]).map(toClient);
}

export async function getClient(id: string): Promise<Client | undefined> {
  const supabase = await resilientDb();
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toClient(data) : undefined;
}

export async function createClient(
  data: Omit<Client, "id" | "nutritionistId" | "createdAt">,
): Promise<Client> {
  const nid = await currentNid();
  const supabase = await db();
  const row = unwrap(
    await supabase
      .from("clients")
      .insert({
        nutritionist_id: nid,
        name: data.name,
        email: data.email ?? null,
        phone: data.phone ?? null,
        birth_date: data.birthDate ?? null,
        sex: data.sex ?? null,
        ethnicity: data.ethnicity ?? null,
        profession: data.profession ?? null,
        goals: data.goals ?? null,
        notes: data.notes ?? null,
        anamnesis: data.anamnesis ?? {},
      })
      .select("*")
      .single(),
  );
  return toClient(row);
}

export async function updateClient(
  id: string,
  patch: Partial<Client>,
): Promise<Client | undefined> {
  const supabase = await db();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.email !== undefined) row.email = patch.email;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.birthDate !== undefined) row.birth_date = patch.birthDate;
  if (patch.sex !== undefined) row.sex = patch.sex;
  if (patch.ethnicity !== undefined) row.ethnicity = patch.ethnicity;
  if (patch.profession !== undefined) row.profession = patch.profession;
  if (patch.goals !== undefined) row.goals = patch.goals;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.anamnesis !== undefined) row.anamnesis = patch.anamnesis;
  const { data, error } = await supabase
    .from("clients")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toClient(data) : undefined;
}

export async function deleteClient(id: string): Promise<void> {
  const supabase = await db();
  // Consultations and meal_plans cascade via FK on delete.
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// --- Consultations ---------------------------------------------------------
export async function listConsultations(clientId: string): Promise<Consultation[]> {
  const supabase = await db();
  const rows = unwrap(
    await supabase
      .from("consultations")
      .select("*")
      .eq("client_id", clientId)
      .order("date", { ascending: false }),
  );
  return (rows as Row[]).map(toConsultation);
}

export async function getConsultation(id: string): Promise<Consultation | undefined> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("consultations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toConsultation(data) : undefined;
}

export async function getLastConsultation(
  clientId: string,
): Promise<Consultation | undefined> {
  return (await listConsultations(clientId))[0];
}

export async function createConsultation(
  clientId: string,
  opts: { duplicateLast?: boolean; consultationTypeId?: string } = {},
): Promise<Consultation> {
  const supabase = await db();
  const existing = await listConsultations(clientId);
  const last = opts.duplicateLast ? existing[0] : undefined;
  const typeId = opts.consultationTypeId ?? last?.consultationTypeId;
  const row = unwrap(
    await supabase
      .from("consultations")
      .insert({
        client_id: clientId,
        date: new Date().toISOString().slice(0, 10),
        consultation_number: existing.length + 1,
        measurements: last ? last.measurements : { perimeters: {}, skinfolds: {} },
        food_history: last?.foodHistory ?? {},
        notes: "",
        consultation_type_id: typeId ?? null,
      })
      .select("*")
      .single(),
  );
  const consult = toConsultation(row);
  await createBillingForConsultation(consult, typeId);
  return consult;
}

/** Auto-create the billing entry for a freshly held consultation. */
async function createBillingForConsultation(
  consult: Consultation,
  typeId?: string,
): Promise<void> {
  const nid = await currentNid();
  const supabase = await db();
  const types = await listConsultationTypes();
  const type = typeId ? types.find((t) => t.id === typeId) : types[0];
  const client = await getClient(consult.clientId);
  // A freshly created consultation can't already have a billing row; a plain
  // insert avoids ON CONFLICT inference issues with the partial unique index.
  const { error } = await supabase.from("billing_entries").insert({
    nutritionist_id: nid,
    client_id: consult.clientId,
    consultation_id: consult.id,
    client_name: client?.name ?? "",
    type_name: type?.name ?? "",
    amount: type?.price ?? 0,
    date: consult.date,
    status: "pending",
    source: "auto",
  });
  if (error) throw new Error(error.message);
}

export async function updateConsultation(
  id: string,
  patch: Partial<Consultation>,
): Promise<Consultation | undefined> {
  const supabase = await db();
  const row: Record<string, unknown> = {};
  if (patch.date !== undefined) row.date = patch.date;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.consultationNumber !== undefined) row.consultation_number = patch.consultationNumber;
  if (patch.measurements !== undefined) row.measurements = patch.measurements;
  if (patch.foodHistory !== undefined) row.food_history = patch.foodHistory;
  if (patch.energy !== undefined) row.energy = patch.energy;
  if (patch.macros !== undefined) row.macros = patch.macros;
  if (patch.planId !== undefined) row.plan_id = patch.planId;
  if (patch.consultationTypeId !== undefined) row.consultation_type_id = patch.consultationTypeId;
  const { data, error } = await supabase
    .from("consultations")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toConsultation(data) : undefined;
}

// --- Consultation types & billing ------------------------------------------
export async function listConsultationTypes(): Promise<ConsultationType[]> {
  const nid = await currentNid();
  const supabase = await db();
  const rows = unwrap(
    await supabase
      .from("consultation_types")
      .select("*")
      .order("created_at", { ascending: true }),
  ) as Row[];
  if (rows.length === 0) {
    // Lazily seed the built-in types the first time a tenant needs them.
    const seeded = unwrap(
      await supabase
        .from("consultation_types")
        .insert(
          DEFAULT_CONSULTATION_TYPES.map((t) => ({
            nutritionist_id: nid,
            name: t.name,
            price: t.price,
            is_default: true,
          })),
        )
        .select("*"),
    ) as Row[];
    return seeded.map(toConsultationType);
  }
  return rows.map(toConsultationType);
}

export async function createConsultationType(data: {
  name: string;
  price: number;
}): Promise<ConsultationType> {
  const nid = await currentNid();
  const supabase = await db();
  const row = unwrap(
    await supabase
      .from("consultation_types")
      .insert({ nutritionist_id: nid, name: data.name, price: data.price, is_default: false })
      .select("*")
      .single(),
  );
  return toConsultationType(row);
}

export async function updateConsultationType(
  id: string,
  patch: { name?: string; price?: number },
): Promise<ConsultationType | undefined> {
  const supabase = await db();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.price !== undefined) row.price = patch.price;
  const { data, error } = await supabase
    .from("consultation_types")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toConsultationType(data) : undefined;
}

export async function deleteConsultationType(id: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("consultation_types").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listBillingEntries(): Promise<BillingEntry[]> {
  const supabase = await db();
  const rows = unwrap(
    await supabase.from("billing_entries").select("*").order("date", { ascending: false }),
  ) as Row[];
  return rows.map(toBillingEntry);
}

export async function createBillingEntry(data: {
  clientId?: string;
  clientName: string;
  typeName: string;
  amount: number;
  date: string;
  status?: "pending" | "paid";
  notes?: string;
}): Promise<BillingEntry> {
  const nid = await currentNid();
  const supabase = await db();
  const row = unwrap(
    await supabase
      .from("billing_entries")
      .insert({
        nutritionist_id: nid,
        client_id: data.clientId ?? null,
        client_name: data.clientName,
        type_name: data.typeName,
        amount: data.amount,
        date: data.date,
        status: data.status ?? "pending",
        notes: data.notes ?? null,
        source: "manual",
      })
      .select("*")
      .single(),
  );
  return toBillingEntry(row);
}

export async function updateBillingEntry(
  id: string,
  patch: Partial<Pick<BillingEntry, "clientName" | "typeName" | "amount" | "date" | "status" | "notes">>,
): Promise<BillingEntry | undefined> {
  const supabase = await db();
  const row: Record<string, unknown> = {};
  if (patch.clientName !== undefined) row.client_name = patch.clientName;
  if (patch.typeName !== undefined) row.type_name = patch.typeName;
  if (patch.amount !== undefined) row.amount = patch.amount;
  if (patch.date !== undefined) row.date = patch.date;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.notes !== undefined) row.notes = patch.notes;
  const { data, error } = await supabase
    .from("billing_entries")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toBillingEntry(data) : undefined;
}

export async function deleteBillingEntry(id: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("billing_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// --- Plans -----------------------------------------------------------------
export async function listPlans(clientId?: string): Promise<MealPlan[]> {
  const supabase = await db();
  let query = supabase.from("meal_plans").select("*").order("updated_at", { ascending: false });
  if (clientId) query = query.eq("client_id", clientId);
  const rows = unwrap(await query);
  return (rows as Row[]).map(toPlan);
}

export async function getPlan(id: string): Promise<MealPlan | undefined> {
  const supabase = await db();
  const { data, error } = await supabase.from("meal_plans").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toPlan(data) : undefined;
}

export async function createPlan(
  data: Partial<MealPlan> & { clientId: string },
): Promise<MealPlan> {
  const supabase = await db();
  const plan = unwrap(
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
      })
      .select("*")
      .single(),
  );
  const mapped = toPlan(plan);
  if (mapped.consultationId) {
    await supabase
      .from("consultations")
      .update({ plan_id: mapped.id })
      .eq("id", mapped.consultationId);
  }
  return mapped;
}

export async function updatePlan(
  id: string,
  patch: Partial<MealPlan>,
): Promise<MealPlan | undefined> {
  const supabase = await db();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.clientId !== undefined) row.client_id = patch.clientId;
  if (patch.consultationId !== undefined) row.consultation_id = patch.consultationId;
  if (patch.language !== undefined) row.language = patch.language;
  if (patch.pdfTemplateId !== undefined) row.pdf_template_id = patch.pdfTemplateId;
  if (patch.meals !== undefined) row.meals = patch.meals;
  if (patch.supplementation !== undefined) row.supplementation = patch.supplementation;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.motivationalQuote !== undefined) row.motivational_quote = patch.motivationalQuote;
  if (patch.nextAppointment !== undefined) row.next_appointment = patch.nextAppointment;
  const { data, error } = await supabase
    .from("meal_plans")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toPlan(data) : undefined;
}

export async function duplicatePlan(
  id: string,
  overrides: Partial<MealPlan> = {},
): Promise<MealPlan | undefined> {
  const src = await getPlan(id);
  if (!src) return undefined;
  return createPlan({
    ...src,
    ...overrides,
    consultationId: overrides.consultationId,
    clientId: overrides.clientId ?? src.clientId,
  });
}

// --- Foods database (BOO-57) -----------------------------------------------
export async function listFoods(opts: { includeArchived?: boolean } = {}): Promise<DbFood[]> {
  const supabase = await db();
  let query = supabase.from("foods").select("*").order("name", { ascending: true });
  if (!opts.includeArchived) query = query.eq("archived", false);
  const rows = unwrap(await query);
  return (rows as Row[]).map(toFood);
}

export async function getFood(id: string): Promise<DbFood | undefined> {
  const supabase = await db();
  const { data, error } = await supabase.from("foods").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toFood(data) : undefined;
}

export async function createFood(
  data: Omit<DbFood, "id" | "nutritionistId" | "createdAt" | "archived"> &
    Partial<Pick<DbFood, "archived">>,
): Promise<DbFood> {
  const nid = await currentNid();
  const supabase = await db();
  const row = unwrap(
    await supabase
      .from("foods")
      .insert({
        nutritionist_id: nid,
        name: data.name,
        base_unit: data.baseUnit,
        ref_qty: data.refQty,
        kcal: data.kcal,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
        brand: data.brand ?? null,
        category: data.category ?? null,
        archived: data.archived ?? false,
      })
      .select("*")
      .single(),
  );
  return toFood(row);
}

export async function updateFood(id: string, patch: Partial<DbFood>): Promise<DbFood | undefined> {
  const supabase = await db();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.baseUnit !== undefined) row.base_unit = patch.baseUnit;
  if (patch.refQty !== undefined) row.ref_qty = patch.refQty;
  if (patch.kcal !== undefined) row.kcal = patch.kcal;
  if (patch.protein !== undefined) row.protein = patch.protein;
  if (patch.carbs !== undefined) row.carbs = patch.carbs;
  if (patch.fat !== undefined) row.fat = patch.fat;
  if (patch.brand !== undefined) row.brand = patch.brand;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.archived !== undefined) row.archived = patch.archived;
  const { data, error } = await supabase.from("foods").update(row).eq("id", id).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toFood(data) : undefined;
}

export async function deleteFood(id: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("foods").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// --- Recipes (BOO-58) ------------------------------------------------------
export async function listRecipes(): Promise<Recipe[]> {
  const supabase = await db();
  const rows = unwrap(
    await supabase.from("recipes").select("*, recipe_items(*)").order("name", { ascending: true }),
  );
  return (rows as Row[]).map(toRecipe);
}

export async function getRecipe(id: string): Promise<Recipe | undefined> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("recipes")
    .select("*, recipe_items(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRecipe(data) : undefined;
}

async function replaceRecipeItems(recipeId: string, items: Recipe["items"]): Promise<void> {
  const supabase = await db();
  await supabase.from("recipe_items").delete().eq("recipe_id", recipeId);
  if (items.length) {
    const { error } = await supabase.from("recipe_items").insert(
      items.map((it, i) => ({
        recipe_id: recipeId,
        food_id: it.foodId,
        name: it.name,
        qty: it.qty,
        position: i,
      })),
    );
    if (error) throw new Error(error.message);
  }
}

export async function createRecipe(
  data: Omit<Recipe, "id" | "nutritionistId" | "createdAt">,
): Promise<Recipe> {
  const nid = await currentNid();
  const supabase = await db();
  const row = unwrap(
    await supabase
      .from("recipes")
      .insert({
        nutritionist_id: nid,
        name: data.name,
        servings: data.servings,
        preparation: data.preparation ?? null,
      })
      .select("*")
      .single(),
  ) as Row;
  await replaceRecipeItems(row.id, data.items ?? []);
  return (await getRecipe(row.id))!;
}

export async function updateRecipe(id: string, patch: Partial<Recipe>): Promise<Recipe | undefined> {
  const supabase = await db();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.servings !== undefined) row.servings = patch.servings;
  if (patch.preparation !== undefined) row.preparation = patch.preparation;
  if (Object.keys(row).length) {
    const { error } = await supabase.from("recipes").update(row).eq("id", id);
    if (error) throw new Error(error.message);
  }
  if (patch.items !== undefined) await replaceRecipeItems(id, patch.items);
  return getRecipe(id);
}

export async function deleteRecipe(id: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// --- Recommendations -------------------------------------------------------
export async function listRecommendations(): Promise<Recommendation[]> {
  const supabase = await db();
  const rows = unwrap(await supabase.from("recommendations").select("*"));
  return (rows as Row[]).map(toRecommendation);
}

export async function createRecommendation(
  data: Omit<Recommendation, "id" | "nutritionistId">,
): Promise<Recommendation> {
  const nid = await currentNid();
  const supabase = await db();
  const row = unwrap(
    await supabase
      .from("recommendations")
      .insert({
        nutritionist_id: nid,
        category: data.category,
        title: data.title,
        content: data.content,
      })
      .select("*")
      .single(),
  );
  return toRecommendation(row);
}

// --- Templates -------------------------------------------------------------
export async function listTemplates(): Promise<PlanTemplate[]> {
  const supabase = await db();
  const rows = unwrap(await supabase.from("plan_templates").select("*"));
  return (rows as Row[]).map(toTemplate);
}

export async function getTemplate(id: string): Promise<PlanTemplate | undefined> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("plan_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toTemplate(data) : undefined;
}

export async function createTemplate(
  data: Omit<PlanTemplate, "id" | "nutritionistId">,
): Promise<PlanTemplate> {
  const nid = await currentNid();
  const supabase = await db();
  const row = unwrap(
    await supabase
      .from("plan_templates")
      .insert({
        nutritionist_id: nid,
        name: data.name,
        language: data.language,
        meals: data.meals,
        supplementation: data.supplementation ?? null,
        notes: data.notes ?? null,
      })
      .select("*")
      .single(),
  );
  return toTemplate(row);
}

// --- Appointments ----------------------------------------------------------
export async function listAppointments(): Promise<Appointment[]> {
  const supabase = await db();
  const rows = unwrap(
    await supabase.from("appointments").select("*").order("date", { ascending: true }),
  );
  return (rows as Row[]).map(toAppointment);
}

/** All appointments across tenants — reminder cron only (service role). */
export async function listAllAppointments(): Promise<Appointment[]> {
  const admin = createSupabaseAdminClient();
  const supabase = admin ?? (await db());
  const rows = unwrap(
    await supabase.from("appointments").select("*").order("date", { ascending: true }),
  );
  return (rows as Row[]).map(toAppointment);
}

export async function getAppointment(id: string): Promise<Appointment | undefined> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toAppointment(data) : undefined;
}

export async function createAppointment(
  data: Omit<Appointment, "id" | "status" | "reminderChannel"> &
    Partial<Pick<Appointment, "status" | "reminderChannel">>,
): Promise<Appointment> {
  const supabase = await db();
  const row = unwrap(
    await supabase
      .from("appointments")
      .insert({
        client_id: data.clientId,
        date: data.date,
        duration_min: data.durationMin ?? 45,
        note: data.note ?? null,
        status: data.status ?? "scheduled",
        reminder_enabled: data.reminderEnabled ?? true,
        reminder_channel: "sms",
        reminder_sent_at: data.reminderSentAt ?? null,
      })
      .select("*")
      .single(),
  );
  return toAppointment(row);
}

export async function updateAppointment(
  id: string,
  patch: Partial<Appointment>,
): Promise<Appointment | undefined> {
  const supabase = await resilientDb();
  const row: Record<string, unknown> = {};
  if (patch.clientId !== undefined) row.client_id = patch.clientId;
  if (patch.date !== undefined) row.date = patch.date;
  if (patch.durationMin !== undefined) row.duration_min = patch.durationMin;
  if (patch.note !== undefined) row.note = patch.note;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.reminderEnabled !== undefined) row.reminder_enabled = patch.reminderEnabled;
  if (patch.reminderSentAt !== undefined) row.reminder_sent_at = patch.reminderSentAt;
  const { data, error } = await supabase
    .from("appointments")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toAppointment(data) : undefined;
}

export async function markReminderSent(id: string, when: string): Promise<void> {
  const supabase = await resilientDb();
  const { error } = await supabase
    .from("appointments")
    .update({ reminder_sent_at: when })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// --- Uploaded PDF templates ------------------------------------------------
export async function listPdfTemplates(): Promise<PdfTemplateFile[]> {
  const supabase = await db();
  const rows = unwrap(await supabase.from("pdf_templates").select("*"));
  return (rows as Row[]).map(toPdfTemplate);
}

export async function getPdfTemplate(id: string): Promise<PdfTemplateFile | undefined> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("pdf_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toPdfTemplate(data) : undefined;
}

export async function createPdfTemplate(data: {
  name: string;
  storagePath: string;
}): Promise<PdfTemplateFile> {
  const nid = await currentNid();
  const supabase = await db();
  const row = unwrap(
    await supabase
      .from("pdf_templates")
      .insert({ nutritionist_id: nid, name: data.name, storage_path: data.storagePath })
      .select("*")
      .single(),
  );
  return toPdfTemplate(row);
}

export async function deletePdfTemplate(id: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("pdf_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// --- SMS outbox ------------------------------------------------------------
export async function addSentMessage(msg: SentMessage): Promise<void> {
  const supabase = await resilientDb();
  const { error } = await supabase.from("sent_messages").insert({
    appointment_id: msg.appointmentId,
    client_id: msg.clientId,
    to: msg.to,
    channel: "sms",
    body: msg.body,
    status: msg.status,
    provider: msg.provider,
  });
  if (error) throw new Error(error.message);
}

export async function listSentMessages(): Promise<SentMessage[]> {
  const supabase = await db();
  const rows = unwrap(
    await supabase.from("sent_messages").select("*").order("created_at", { ascending: false }),
  );
  return (rows as Row[]).map(toSentMessage);
}

// --- Dashboard aggregates --------------------------------------------------
export async function getDashboardStats() {
  const [clients, appts] = await Promise.all([listClients(), listAppointments()]);
  const supabase = await db();
  const consultations = (
    unwrap(
      await supabase.from("consultations").select("*").order("date", { ascending: false }),
    ) as Row[]
  ).map(toConsultation);
  const plans = (unwrap(await supabase.from("meal_plans").select("*")) as Row[]).map(toPlan);

  const clientById = new Map(clients.map((c) => [c.id, c]));
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const inThisMonth = (iso: string) => new Date(iso) >= monthStart;

  const consultationsThisMonth = consultations.filter((c) => inThisMonth(c.date)).length;
  const newClientsThisMonth = clients.filter((c) => inThisMonth(c.createdAt)).length;

  const upcoming = appts
    .filter((a) => a.status === "scheduled" && new Date(a.date) >= now)
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    activeClients: clients.length,
    totalConsultations: consultations.length,
    consultationsThisMonth,
    newClientsThisMonth,
    plansGenerated: plans.length,
    upcomingCount: upcoming.length,
    recentConsultationList: consultations.slice(0, 6).map((c) => ({
      consultation: c,
      client: clientById.get(c.clientId),
      bmi: computeBmi(c.measurements),
    })),
    upcomingList: upcoming.slice(0, 5).map((a) => ({
      appointment: a,
      client: clientById.get(a.clientId),
    })),
  };
}
