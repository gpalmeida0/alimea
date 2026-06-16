import {
  computeBmi,
  DEFAULT_CONSULTATION_TYPES,
  type Appointment,
  type BillingEntry,
  type Client,
  type Consultation,
  type ConsultationType,
  type DbFood,
  type Meal,
  type MealPlan,
  type NutritionistProfile,
  type PlanTemplate,
  type PdfTemplateFile,
  type Recipe,
  type Recommendation,
  type SentMessage,
} from "@/lib/types";
import { clearSession, getSessionNid, setSession } from "@/lib/auth/session";
import {
  seedAppointments,
  seedClients,
  seedConsultations,
  seedFoods,
  seedPlans,
  seedProfile,
  seedRecommendations,
  seedTemplates,
} from "./seed";

// ---------------------------------------------------------------------------
// In-memory data store.
//
// This is the default Alimea data backend so the app runs end-to-end with no
// external setup. It implements the same async repository API a Supabase-backed
// adapter would, so swapping to the real database (see src/lib/supabase) is a
// drop-in change. The store is kept on globalThis to survive HMR in dev.
// ---------------------------------------------------------------------------

interface Account {
  id: string; // == nutritionist/profile id
  email: string;
  password: string; // plain for local demo only
}

interface Store {
  accounts: Account[];
  profiles: NutritionistProfile[];
  clients: Client[];
  consultations: Consultation[];
  plans: MealPlan[];
  recommendations: Recommendation[];
  templates: PlanTemplate[];
  appointments: Appointment[];
  messages: SentMessage[];
  pdfTemplates: PdfTemplateFile[];
  consultationTypes: ConsultationType[];
  billingEntries: BillingEntry[];
  foods: DbFood[];
  recipes: Recipe[];
}

const g = globalThis as unknown as { __alimeaStore?: Store };

function getStore(): Store {
  if (!g.__alimeaStore) {
    g.__alimeaStore = {
      accounts: [{ id: seedProfile.id, email: "eduarda@alimea.app", password: "alimea" }],
      profiles: [structuredClone(seedProfile)],
      clients: structuredClone(seedClients),
      consultations: structuredClone(seedConsultations),
      plans: structuredClone(seedPlans),
      recommendations: structuredClone(seedRecommendations),
      templates: structuredClone(seedTemplates),
      appointments: structuredClone(seedAppointments),
      messages: [],
      pdfTemplates: [],
      consultationTypes: DEFAULT_CONSULTATION_TYPES.map((t, i) => ({
        id: `ctype-${i + 1}`,
        nutritionistId: seedProfile.id,
        name: t.name,
        price: t.price,
        isDefault: true,
      })),
      billingEntries: [],
      foods: structuredClone(seedFoods).map((f) => ({ ...f, nutritionistId: seedProfile.id })),
      recipes: [],
    };
  }
  return g.__alimeaStore;
}

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const now = () => new Date().toISOString();

/** The current tenant (nutritionist) id from the session, with a safe fallback. */
async function currentNid(): Promise<string> {
  const nid = await getSessionNid();
  const s = getStore();
  if (nid && s.accounts.some((a) => a.id === nid)) return nid;
  return s.accounts[0]?.id ?? seedProfile.id;
}

/** Ids of clients owned by the current tenant. */
async function ownClientIds(): Promise<Set<string>> {
  const nid = await currentNid();
  return new Set(getStore().clients.filter((c) => c.nutritionistId === nid).map((c) => c.id));
}

// --- Auth ------------------------------------------------------------------
export async function authenticate(
  email: string,
  password: string,
): Promise<string | null> {
  const acc = getStore().accounts.find(
    (a) => a.email.toLowerCase() === email.toLowerCase() && a.password === password,
  );
  if (acc) await setSession(acc.id);
  return acc?.id ?? null;
}

export async function signOut(): Promise<void> {
  await clearSession();
}

/** Current tenant id if authenticated, else null (used by the layout guard). */
export async function getAuthNid(): Promise<string | null> {
  return getSessionNid();
}

export async function emailExists(email: string): Promise<boolean> {
  return getStore().accounts.some((a) => a.email.toLowerCase() === email.toLowerCase());
}

/** Create a brand-new nutritionist account (own empty tenant). Returns its id. */
export async function createAccount(data: {
  name: string;
  email: string;
  password: string;
}): Promise<string> {
  const s = getStore();
  const id = uid("nutri");
  s.accounts.push({ id, email: data.email, password: data.password });
  s.profiles.push({
    id,
    name: data.name,
    email: data.email,
    credential: "",
    interfaceLanguage: "pt-PT",
  });
  await setSession(id);
  return id;
}

// --- Profile ---------------------------------------------------------------
export async function getProfile(): Promise<NutritionistProfile> {
  const nid = await currentNid();
  const s = getStore();
  return s.profiles.find((p) => p.id === nid) ?? s.profiles[0];
}

export async function getProfileById(id: string): Promise<NutritionistProfile | undefined> {
  return getStore().profiles.find((p) => p.id === id);
}

export async function updateProfile(
  patch: Partial<NutritionistProfile>,
): Promise<NutritionistProfile> {
  const nid = await currentNid();
  const s = getStore();
  const idx = s.profiles.findIndex((p) => p.id === nid);
  if (idx >= 0) s.profiles[idx] = { ...s.profiles[idx], ...patch, id: nid };
  return s.profiles[idx];
}

// --- Clients ---------------------------------------------------------------
export async function listClients(): Promise<Client[]> {
  const nid = await currentNid();
  return getStore()
    .clients.filter((c) => c.nutritionistId === nid)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getClient(id: string): Promise<Client | undefined> {
  return getStore().clients.find((c) => c.id === id);
}

export async function createClient(
  data: Omit<Client, "id" | "nutritionistId" | "createdAt">,
): Promise<Client> {
  const s = getStore();
  const client: Client = {
    ...data,
    id: uid("client"),
    nutritionistId: await currentNid(),
    createdAt: now(),
  };
  s.clients.push(client);
  return client;
}

export async function updateClient(
  id: string,
  patch: Partial<Client>,
): Promise<Client | undefined> {
  const s = getStore();
  const c = s.clients.find((x) => x.id === id);
  if (c) Object.assign(c, patch);
  return c;
}

export async function deleteClient(id: string): Promise<void> {
  const s = getStore();
  s.clients = s.clients.filter((c) => c.id !== id);
  s.consultations = s.consultations.filter((c) => c.clientId !== id);
  s.plans = s.plans.filter((p) => p.clientId !== id);
}

// --- Consultations ---------------------------------------------------------
export async function listConsultations(clientId: string): Promise<Consultation[]> {
  return getStore()
    .consultations.filter((c) => c.clientId === clientId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getConsultation(id: string): Promise<Consultation | undefined> {
  return getStore().consultations.find((c) => c.id === id);
}

export async function getLastConsultation(
  clientId: string,
): Promise<Consultation | undefined> {
  return (await listConsultations(clientId))[0];
}

/** Create a consultation, optionally pre-filling from the previous one. */
export async function createConsultation(
  clientId: string,
  opts: { duplicateLast?: boolean; consultationTypeId?: string } = {},
): Promise<Consultation> {
  const s = getStore();
  const existing = await listConsultations(clientId);
  const last = opts.duplicateLast ? existing[0] : undefined;
  const typeId = opts.consultationTypeId ?? last?.consultationTypeId;
  const consult: Consultation = {
    id: uid("consult"),
    clientId,
    date: new Date().toISOString().slice(0, 10),
    consultationNumber: existing.length + 1,
    measurements: last
      ? structuredClone(last.measurements)
      : { perimeters: {}, skinfolds: {} },
    // Carry the anamnese food-history shape forward when duplicating.
    foodHistory: last ? structuredClone(last.foodHistory) : undefined,
    notes: "",
    consultationTypeId: typeId,
    createdAt: now(),
  };
  s.consultations.push(consult);

  // Auto-create the billing entry for the held consultation.
  const types = await listConsultationTypes();
  const type = typeId ? types.find((t) => t.id === typeId) : types[0];
  const client = s.clients.find((c) => c.id === clientId);
  s.billingEntries.unshift({
    id: uid("bill"),
    nutritionistId: await currentNid(),
    clientId,
    consultationId: consult.id,
    clientName: client?.name ?? "",
    typeName: type?.name ?? "",
    amount: type?.price ?? 0,
    date: consult.date,
    status: "pending",
    source: "auto",
    createdAt: now(),
  });
  return consult;
}

export async function updateConsultation(
  id: string,
  patch: Partial<Consultation>,
): Promise<Consultation | undefined> {
  const s = getStore();
  const c = s.consultations.find((x) => x.id === id);
  if (c) Object.assign(c, patch);
  return c;
}

// --- Consultation types & billing ------------------------------------------
export async function listConsultationTypes(): Promise<ConsultationType[]> {
  const nid = await currentNid();
  const s = getStore();
  let own = s.consultationTypes.filter((t) => t.nutritionistId === nid);
  if (own.length === 0) {
    own = DEFAULT_CONSULTATION_TYPES.map((t) => ({
      id: uid("ctype"),
      nutritionistId: nid,
      name: t.name,
      price: t.price,
      isDefault: true,
    }));
    s.consultationTypes.push(...own);
  }
  return own;
}

export async function createConsultationType(data: {
  name: string;
  price: number;
}): Promise<ConsultationType> {
  const s = getStore();
  const type: ConsultationType = {
    id: uid("ctype"),
    nutritionistId: await currentNid(),
    name: data.name,
    price: data.price,
    isDefault: false,
  };
  s.consultationTypes.push(type);
  return type;
}

export async function updateConsultationType(
  id: string,
  patch: { name?: string; price?: number },
): Promise<ConsultationType | undefined> {
  const t = getStore().consultationTypes.find((x) => x.id === id);
  if (t) Object.assign(t, patch);
  return t;
}

export async function deleteConsultationType(id: string): Promise<void> {
  const s = getStore();
  s.consultationTypes = s.consultationTypes.filter((t) => t.id !== id);
}

export async function listBillingEntries(): Promise<BillingEntry[]> {
  const nid = await currentNid();
  return getStore()
    .billingEntries.filter((b) => b.nutritionistId === nid)
    .sort((a, b) => b.date.localeCompare(a.date));
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
  const s = getStore();
  const entry: BillingEntry = {
    id: uid("bill"),
    nutritionistId: await currentNid(),
    clientId: data.clientId,
    clientName: data.clientName,
    typeName: data.typeName,
    amount: data.amount,
    date: data.date,
    status: data.status ?? "pending",
    notes: data.notes,
    source: "manual",
    createdAt: now(),
  };
  s.billingEntries.unshift(entry);
  return entry;
}

export async function updateBillingEntry(
  id: string,
  patch: Partial<Pick<BillingEntry, "clientName" | "typeName" | "amount" | "date" | "status" | "notes">>,
): Promise<BillingEntry | undefined> {
  const b = getStore().billingEntries.find((x) => x.id === id);
  if (b) Object.assign(b, patch);
  return b;
}

export async function deleteBillingEntry(id: string): Promise<void> {
  const s = getStore();
  s.billingEntries = s.billingEntries.filter((b) => b.id !== id);
}

// --- Plans -----------------------------------------------------------------
export async function listPlans(clientId?: string): Promise<MealPlan[]> {
  const all = getStore().plans;
  const own = await ownClientIds();
  const filtered = clientId
    ? all.filter((p) => p.clientId === clientId)
    : all.filter((p) => own.has(p.clientId));
  return [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getPlan(id: string): Promise<MealPlan | undefined> {
  return getStore().plans.find((p) => p.id === id);
}

export async function createPlan(
  data: Partial<MealPlan> & { clientId: string },
): Promise<MealPlan> {
  const s = getStore();
  const plan: MealPlan = {
    id: uid("plan"),
    clientId: data.clientId,
    consultationId: data.consultationId,
    language: data.language ?? "pt-PT",
    pdfTemplateId: data.pdfTemplateId ?? "classic",
    meals: data.meals ?? [],
    supplementation: data.supplementation ?? "",
    notes: data.notes ?? "",
    motivationalQuote: data.motivationalQuote ?? "",
    nextAppointment: data.nextAppointment ?? "",
    createdAt: now(),
    updatedAt: now(),
  };
  s.plans.push(plan);
  if (plan.consultationId) {
    const c = s.consultations.find((x) => x.id === plan.consultationId);
    if (c) c.planId = plan.id;
  }
  return plan;
}

export async function updatePlan(
  id: string,
  patch: Partial<MealPlan>,
): Promise<MealPlan | undefined> {
  const s = getStore();
  const p = s.plans.find((x) => x.id === id);
  if (p) Object.assign(p, patch, { updatedAt: now() });
  return p;
}

/** Deep-duplicate a plan (smart duplication) into a fresh editable plan. */
export async function duplicatePlan(
  id: string,
  overrides: Partial<MealPlan> = {},
): Promise<MealPlan | undefined> {
  const src = await getPlan(id);
  if (!src) return undefined;
  const clone = structuredClone(src);
  return createPlan({ ...clone, ...overrides, consultationId: overrides.consultationId });
}

// --- Foods database (BOO-57) -----------------------------------------------
export async function listFoods(opts: { includeArchived?: boolean } = {}): Promise<DbFood[]> {
  const nid = await currentNid();
  return getStore()
    .foods.filter((f) => f.nutritionistId === nid && (opts.includeArchived || !f.archived))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getFood(id: string): Promise<DbFood | undefined> {
  return getStore().foods.find((f) => f.id === id);
}

export async function createFood(
  data: Omit<DbFood, "id" | "nutritionistId" | "createdAt" | "archived"> &
    Partial<Pick<DbFood, "archived">>,
): Promise<DbFood> {
  const s = getStore();
  const f: DbFood = {
    ...data,
    archived: data.archived ?? false,
    id: uid("food"),
    nutritionistId: await currentNid(),
    createdAt: now(),
  };
  s.foods.push(f);
  return f;
}

export async function updateFood(id: string, patch: Partial<DbFood>): Promise<DbFood | undefined> {
  const f = getStore().foods.find((x) => x.id === id);
  if (f) Object.assign(f, patch, { id: f.id, nutritionistId: f.nutritionistId });
  return f;
}

export async function deleteFood(id: string): Promise<void> {
  const s = getStore();
  s.foods = s.foods.filter((f) => f.id !== id);
}

// --- Recipes (BOO-58) ------------------------------------------------------
export async function listRecipes(): Promise<Recipe[]> {
  const nid = await currentNid();
  return getStore()
    .recipes.filter((r) => r.nutritionistId === nid)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getRecipe(id: string): Promise<Recipe | undefined> {
  return getStore().recipes.find((r) => r.id === id);
}

export async function createRecipe(
  data: Omit<Recipe, "id" | "nutritionistId" | "createdAt">,
): Promise<Recipe> {
  const s = getStore();
  const r: Recipe = { ...data, id: uid("recipe"), nutritionistId: await currentNid(), createdAt: now() };
  s.recipes.push(r);
  return r;
}

export async function updateRecipe(id: string, patch: Partial<Recipe>): Promise<Recipe | undefined> {
  const r = getStore().recipes.find((x) => x.id === id);
  if (r) Object.assign(r, patch, { id: r.id, nutritionistId: r.nutritionistId });
  return r;
}

export async function deleteRecipe(id: string): Promise<void> {
  const s = getStore();
  s.recipes = s.recipes.filter((r) => r.id !== id);
}

// --- Recommendations -------------------------------------------------------
export async function listRecommendations(): Promise<Recommendation[]> {
  const nid = await currentNid();
  return getStore().recommendations.filter((r) => r.nutritionistId === nid);
}

export async function createRecommendation(
  data: Omit<Recommendation, "id" | "nutritionistId">,
): Promise<Recommendation> {
  const s = getStore();
  const rec: Recommendation = { ...data, id: uid("rec"), nutritionistId: await currentNid() };
  s.recommendations.push(rec);
  return rec;
}

// --- Templates -------------------------------------------------------------
export async function listTemplates(): Promise<PlanTemplate[]> {
  const nid = await currentNid();
  return getStore().templates.filter((t) => t.nutritionistId === nid);
}

export async function getTemplate(id: string): Promise<PlanTemplate | undefined> {
  return getStore().templates.find((t) => t.id === id);
}

export async function createTemplate(
  data: Omit<PlanTemplate, "id" | "nutritionistId">,
): Promise<PlanTemplate> {
  const s = getStore();
  const tpl: PlanTemplate = { ...data, id: uid("tpl"), nutritionistId: await currentNid() };
  s.templates.push(tpl);
  return tpl;
}

// --- Appointments ----------------------------------------------------------
/** Appointments for the current tenant (UI). */
export async function listAppointments(): Promise<Appointment[]> {
  const own = await ownClientIds();
  return getStore()
    .appointments.filter((a) => own.has(a.clientId))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** All appointments across tenants — used by the reminder cron only. */
export async function listAllAppointments(): Promise<Appointment[]> {
  return [...getStore().appointments].sort((a, b) => a.date.localeCompare(b.date));
}

export async function getAppointment(id: string): Promise<Appointment | undefined> {
  return getStore().appointments.find((a) => a.id === id);
}

export async function createAppointment(
  data: Omit<Appointment, "id" | "status" | "reminderChannel"> &
    Partial<Pick<Appointment, "status" | "reminderChannel">>,
): Promise<Appointment> {
  const s = getStore();
  const appt: Appointment = {
    id: uid("appt"),
    clientId: data.clientId,
    date: data.date,
    durationMin: data.durationMin ?? 45,
    note: data.note,
    status: data.status ?? "scheduled",
    reminderEnabled: data.reminderEnabled ?? true,
    reminderChannel: "sms",
    reminderSentAt: data.reminderSentAt,
  };
  s.appointments.push(appt);
  return appt;
}

export async function updateAppointment(
  id: string,
  patch: Partial<Appointment>,
): Promise<Appointment | undefined> {
  const s = getStore();
  const a = s.appointments.find((x) => x.id === id);
  if (a) Object.assign(a, patch);
  return a;
}

export async function markReminderSent(id: string, when: string): Promise<void> {
  const a = getStore().appointments.find((x) => x.id === id);
  if (a) a.reminderSentAt = when;
}

// --- Uploaded PDF templates ------------------------------------------------
export async function listPdfTemplates(): Promise<PdfTemplateFile[]> {
  const nid = await currentNid();
  return getStore().pdfTemplates.filter((t) => t.nutritionistId === nid);
}

export async function getPdfTemplate(id: string): Promise<PdfTemplateFile | undefined> {
  return getStore().pdfTemplates.find((t) => t.id === id);
}

export async function createPdfTemplate(data: {
  name: string;
  storagePath: string;
}): Promise<PdfTemplateFile> {
  const s = getStore();
  const tpl: PdfTemplateFile = {
    id: uid("pdftpl"),
    nutritionistId: await currentNid(),
    name: data.name,
    storagePath: data.storagePath,
    createdAt: now(),
  };
  s.pdfTemplates.push(tpl);
  return tpl;
}

export async function deletePdfTemplate(id: string): Promise<void> {
  const s = getStore();
  s.pdfTemplates = s.pdfTemplates.filter((t) => t.id !== id);
}

// --- SMS outbox ------------------------------------------------------------
export async function addSentMessage(msg: SentMessage): Promise<void> {
  getStore().messages.unshift(msg);
}

export async function listSentMessages(): Promise<SentMessage[]> {
  return getStore().messages;
}

export function newMessageId(): string {
  return uid("msg");
}

// --- Dashboard aggregates --------------------------------------------------
export async function getDashboardStats() {
  const s = getStore();
  const own = await ownClientIds();
  const ownClients = s.clients.filter((c) => own.has(c.id));
  const consultations = s.consultations
    .filter((c) => own.has(c.clientId))
    .sort((a, b) => b.date.localeCompare(a.date));
  const plans = s.plans.filter((p) => own.has(p.clientId));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const inThisMonth = (iso: string) => new Date(iso) >= monthStart;

  const consultationsThisMonth = consultations.filter((c) => inThisMonth(c.date)).length;
  const newClientsThisMonth = ownClients.filter((c) => inThisMonth(c.createdAt)).length;

  const upcoming = s.appointments
    .filter((a) => own.has(a.clientId) && a.status === "scheduled" && new Date(a.date) >= now)
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    activeClients: own.size,
    totalConsultations: consultations.length,
    consultationsThisMonth,
    newClientsThisMonth,
    plansGenerated: plans.length,
    upcomingCount: upcoming.length,
    recentConsultationList: consultations.slice(0, 6).map((c) => ({
      consultation: c,
      client: s.clients.find((cl) => cl.id === c.clientId),
      bmi: computeBmi(c.measurements),
    })),
    upcomingList: upcoming.slice(0, 5).map((a) => ({
      appointment: a,
      client: s.clients.find((cl) => cl.id === a.clientId),
    })),
  };
}

/** Autocomplete suggestions from a client's history (meal contents seen before). */
export async function getMealSuggestions(clientId: string): Promise<string[]> {
  const plans = await listPlans(clientId);
  const set = new Set<string>();
  for (const p of plans) {
    for (const meal of p.meals) {
      for (const opt of meal.options) {
        if (opt.content.trim() && opt.content.length < 120) set.add(opt.content.trim());
      }
    }
  }
  return [...set].slice(0, 20);
}

export function blankMeal(name = ""): Meal {
  return { id: uid("meal"), name, options: [{ id: uid("opt"), content: "" }] };
}
