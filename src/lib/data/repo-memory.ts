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
import {
  checkPassword,
  clearSession,
  getSessionNid,
  hashPassword,
  setSession,
} from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { newId, todayISO } from "@/lib/utils";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { VOUCHER_NOTE } from "@/lib/billing/metrics";
import type {
  AuthStatus,
  BillingPatch,
  EmailChangeResult,
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
  StoredFile,
} from "./repo-types";
import {
  seedAppointments,
  seedBillingEntries,
  seedClients,
  seedConsultations,
  seedFoods,
  seedPlans,
  seedProfile,
  seedRecommendations,
  seedTemplates,
} from "./seed";

// ---------------------------------------------------------------------------
// In-memory data store — the zero-setup default backend.
//
// Implements the Repository contract (repo-types.ts) so it is a drop-in swap
// for the Supabase backend. Every by-id access checks that the row belongs to
// the signed-in tenant. The store lives on globalThis to survive dev HMR.
// Data is lost on restart: this backend is for demos and local development.
// ---------------------------------------------------------------------------

interface Account {
  id: string; // == nutritionist/profile id
  email: string;
  passwordHash: string;
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
  files: Map<string, StoredFile>;
}

const g = globalThis as unknown as { __alimeaStore?: Store };

function store(): Store {
  if (!g.__alimeaStore) {
    g.__alimeaStore = {
      accounts: [{ id: seedProfile.id, email: "eduarda@alimea.app", passwordHash: hashPassword("alimea") }],
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
      billingEntries: structuredClone(seedBillingEntries),
      foods: structuredClone(seedFoods),
      recipes: [],
      files: new Map(),
    };
  }
  return g.__alimeaStore;
}

const now = () => new Date().toISOString();
const clone = <T>(v: T): T => structuredClone(v);

/**
 * Signed-in tenant id. Without a valid session, redirect to login (middleware
 * adds the locale) — pages render in parallel with the layout's auth guard, so
 * throwing here would show an error screen instead of the login page.
 */
async function nid(): Promise<string> {
  const id = await getSessionNid();
  if (!id || !store().accounts.some((a) => a.id === id)) redirect("/login");
  return id;
}

/** Ids of clients owned by the current tenant. */
async function ownClientIds(): Promise<Set<string>> {
  const id = await nid();
  return new Set(store().clients.filter((c) => c.nutritionistId === id).map((c) => c.id));
}

async function ownClient(id: string): Promise<Client | undefined> {
  const me = await nid();
  return store().clients.find((c) => c.id === id && c.nutritionistId === me);
}

/** Find a row owned directly (nutritionistId) by the tenant. */
async function findOwned<T extends { id: string; nutritionistId: string }>(list: T[], id: string) {
  const me = await nid();
  return list.find((x) => x.id === id && x.nutritionistId === me);
}

/** Find a row owned through its client (consultations, plans, appointments). */
async function findViaClient<T extends { id: string; clientId: string }>(list: T[], id: string) {
  const own = await ownClientIds();
  return list.find((x) => x.id === id && own.has(x.clientId));
}

// --- Auth ------------------------------------------------------------------
export async function authenticate(email: string, password: string): Promise<AuthStatus> {
  const acc = store().accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
  if (!acc || !checkPassword(password, acc.passwordHash)) return "invalid";
  await setSession(acc.id);
  return "ok";
}

export async function signOut(): Promise<void> {
  await clearSession();
}

export async function getAuthNid(): Promise<string | null> {
  const id = await getSessionNid();
  return id && store().accounts.some((a) => a.id === id) ? id : null;
}

async function account(): Promise<Account> {
  const me = await nid();
  return store().accounts.find((a) => a.id === me)!;
}

export async function getLoginEmail(): Promise<string | null> {
  const id = await getAuthNid();
  return store().accounts.find((a) => a.id === id)?.email ?? null;
}

// The demo backend sends no email, so there are no links to request or redeem.
export async function requestPasswordReset(): Promise<void> {}
export async function redeemEmailLink(): Promise<boolean> {
  return false;
}

export async function setPassword(password: string): Promise<PasswordResult> {
  if (password.length < MIN_PASSWORD_LENGTH) return "weak";
  (await account()).passwordHash = hashPassword(password);
  return "ok";
}

export async function changePassword(current: string, next: string): Promise<PasswordResult> {
  const acc = await account();
  if (!checkPassword(current, acc.passwordHash)) return "invalid";
  if (checkPassword(next, acc.passwordHash)) return "same";
  return setPassword(next);
}

export async function changeLoginEmail(email: string): Promise<EmailChangeResult> {
  const acc = await account();
  if (store().accounts.some((a) => a.id !== acc.id && a.email.toLowerCase() === email.toLowerCase())) return "exists";
  acc.email = email;
  return "ok";
}

// Two-factor authentication needs Supabase Auth.
export async function getMfaStatus(): Promise<MfaStatus> {
  return { supported: false, enabled: false, pending: false };
}
export async function startMfaEnrollment(): Promise<MfaEnrollment | null> {
  return null;
}
export async function verifyMfa(): Promise<boolean> {
  return false;
}
export async function disableMfa(): Promise<boolean> {
  return false;
}

// --- Profile ---------------------------------------------------------------
export async function getProfile(): Promise<NutritionistProfile> {
  const me = await nid();
  return clone(store().profiles.find((p) => p.id === me)!);
}

export async function updateProfile(patch: Partial<Omit<NutritionistProfile, "id">>) {
  const me = await nid();
  const p = store().profiles.find((x) => x.id === me)!;
  Object.assign(p, patch, { id: me });
  return clone(p);
}

// --- Clients ---------------------------------------------------------------
export async function listClients(): Promise<Client[]> {
  const me = await nid();
  return clone(
    store()
      .clients.filter((c) => c.nutritionistId === me)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}

export async function getClient(id: string) {
  const c = await ownClient(id);
  return c && clone(c);
}

export async function createClient(data: NewClient): Promise<Client> {
  const client: Client = { ...data, id: newId("client"), nutritionistId: await nid(), createdAt: now() };
  store().clients.push(client);
  return clone(client);
}

export async function updateClient(id: string, patch: Partial<NewClient>) {
  const c = await ownClient(id);
  if (!c) return undefined;
  Object.assign(c, patch);
  return clone(c);
}

export async function deleteClient(id: string): Promise<void> {
  if (!(await ownClient(id))) return;
  const s = store();
  const consultIds = new Set(s.consultations.filter((c) => c.clientId === id).map((c) => c.id));
  s.clients = s.clients.filter((c) => c.id !== id);
  s.consultations = s.consultations.filter((c) => c.clientId !== id);
  s.plans = s.plans.filter((p) => p.clientId !== id);
  s.appointments = s.appointments.filter((a) => a.clientId !== id);
  s.messages = s.messages.filter((m) => m.clientId !== id);
  // Billing keeps its snapshot (client name) — like ON DELETE SET NULL.
  for (const b of s.billingEntries) {
    if (b.clientId === id) b.clientId = undefined;
    if (b.consultationId && consultIds.has(b.consultationId)) b.consultationId = undefined;
  }
}

// --- Consultations ---------------------------------------------------------
export async function listConsultations(clientId: string): Promise<Consultation[]> {
  if (!(await ownClient(clientId))) return [];
  return clone(store().consultations.filter((c) => c.clientId === clientId).sort(byNewest));
}

export async function listAllConsultations(): Promise<Consultation[]> {
  const own = await ownClientIds();
  return clone(store().consultations.filter((c) => own.has(c.clientId)).sort(byNewest));
}

export async function getConsultation(id: string) {
  const c = await findViaClient(store().consultations, id);
  return c && clone(c);
}

export async function createConsultation(
  clientId: string,
  opts: { duplicateFrom?: Consultation; consultationTypeId?: string; date?: string } = {},
): Promise<Consultation> {
  const client = await ownClient(clientId);
  if (!client) throw new Error("Client not found");
  const s = store();
  const existing = s.consultations.filter((c) => c.clientId === clientId);
  const last = opts.duplicateFrom;
  const typeId = opts.consultationTypeId ?? last?.consultationTypeId;
  const consult: Consultation = {
    id: newId("consult"),
    clientId,
    date: opts.date ?? todayISO(),
    consultationNumber: existing.length + 1,
    measurements: last ? normalizeMeasurements(clone(last.measurements)) : emptyMeasurements(),
    foodHistory: last?.foodHistory ? clone(last.foodHistory) : undefined,
    energy: last?.energy ? { ...clone(last.energy), targetKcal: undefined } : undefined,
    macros: last?.macros ? clone(last.macros) : undefined,
    notes: "",
    consultationTypeId: typeId,
    createdAt: now(),
  };
  s.consultations.push(consult);

  // Auto-create the billing entry for the held consultation.
  const types = await listConsultationTypes();
  const type = types.find((t) => t.id === typeId) ?? types[0];
  s.billingEntries.push({
    id: newId("bill"),
    nutritionistId: client.nutritionistId,
    clientId,
    consultationId: consult.id,
    clientName: client.name,
    typeName: type?.name ?? "",
    // Cheque-nutricionista: the client is not charged.
    amount: client.nutritionVoucher ? 0 : (type?.price ?? 0),
    date: consult.date,
    status: client.nutritionVoucher ? "paid" : "pending",
    notes: client.nutritionVoucher ? VOUCHER_NOTE : undefined,
    source: "auto",
    createdAt: now(),
  });
  return clone(consult);
}

export async function updateConsultation(
  id: string,
  patch: Partial<Omit<Consultation, "id" | "clientId" | "createdAt">>,
) {
  const c = await findViaClient(store().consultations, id);
  if (!c) return undefined;
  Object.assign(c, patch);
  if (patch.measurements) c.measurements = normalizeMeasurements(patch.measurements);
  return clone(c);
}

export async function deleteConsultation(id: string): Promise<void> {
  const c = await findViaClient(store().consultations, id);
  if (!c) return;
  const s = store();
  s.consultations = s.consultations.filter((x) => x.id !== id);
  s.plans = s.plans.filter((p) => p.consultationId !== id);
  // An unpaid automatic charge for a deleted consultation is removed; paid ones stay.
  s.billingEntries = s.billingEntries.filter(
    (b) => !(b.consultationId === id && b.source === "auto" && b.status === "pending"),
  );
  for (const b of s.billingEntries) if (b.consultationId === id) b.consultationId = undefined;
}

// --- Consultation types & billing ------------------------------------------
export async function listConsultationTypes(): Promise<ConsultationType[]> {
  const me = await nid();
  const s = store();
  let own = s.consultationTypes.filter((t) => t.nutritionistId === me);
  if (own.length === 0) {
    own = DEFAULT_CONSULTATION_TYPES.map((t) => ({
      id: newId("ctype"),
      nutritionistId: me,
      name: t.name,
      price: t.price,
      isDefault: true,
    }));
    s.consultationTypes.push(...own);
  }
  return clone(own);
}

export async function createConsultationType(data: { name: string; price: number }) {
  const type: ConsultationType = { id: newId("ctype"), nutritionistId: await nid(), ...data, isDefault: false };
  store().consultationTypes.push(type);
  return clone(type);
}

export async function updateConsultationType(id: string, patch: { name?: string; price?: number }) {
  const t = await findOwned(store().consultationTypes, id);
  if (!t) return undefined;
  Object.assign(t, patch);
  return clone(t);
}

export async function deleteConsultationType(id: string): Promise<void> {
  if (!(await findOwned(store().consultationTypes, id))) return;
  const s = store();
  s.consultationTypes = s.consultationTypes.filter((t) => t.id !== id);
  for (const c of s.consultations) if (c.consultationTypeId === id) c.consultationTypeId = undefined;
}

export async function listBillingEntries(): Promise<BillingEntry[]> {
  const me = await nid();
  return clone(store().billingEntries.filter((b) => b.nutritionistId === me).sort(byNewest));
}

export async function createBillingEntry(data: NewBillingEntry): Promise<BillingEntry> {
  const me = await nid();
  const clientId = data.clientId && (await ownClient(data.clientId)) ? data.clientId : undefined;
  const entry: BillingEntry = {
    id: newId("bill"),
    nutritionistId: me,
    clientId,
    clientName: data.clientName,
    typeName: data.typeName,
    amount: data.amount,
    date: data.date,
    status: data.status ?? "pending",
    notes: data.notes,
    source: "manual",
    createdAt: now(),
  };
  store().billingEntries.push(entry);
  return clone(entry);
}

export async function updateBillingEntry(id: string, patch: BillingPatch) {
  const b = await findOwned(store().billingEntries, id);
  if (!b) return undefined;
  Object.assign(b, patch);
  return clone(b);
}

export async function deleteBillingEntry(id: string): Promise<void> {
  if (!(await findOwned(store().billingEntries, id))) return;
  const s = store();
  s.billingEntries = s.billingEntries.filter((b) => b.id !== id);
}

// --- Plans -----------------------------------------------------------------
export async function listPlans(clientId?: string): Promise<MealPlan[]> {
  const own = await ownClientIds();
  return clone(
    store()
      .plans.filter((p) => own.has(p.clientId) && (!clientId || p.clientId === clientId))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  );
}

export async function getPlan(id: string) {
  const p = await findViaClient(store().plans, id);
  return p && clone(p);
}

export async function createPlan(data: Partial<MealPlan> & { clientId: string }): Promise<MealPlan> {
  if (!(await ownClient(data.clientId))) throw new Error("Client not found");
  const s = store();
  const consultation = data.consultationId
    ? s.consultations.find((c) => c.id === data.consultationId && c.clientId === data.clientId)
    : undefined;
  const plan: MealPlan = {
    id: newId("plan"),
    clientId: data.clientId,
    consultationId: consultation?.id,
    language: data.language ?? "pt-PT",
    pdfTemplateId: data.pdfTemplateId ?? "classic",
    meals: clone(data.meals ?? []),
    hideFoodItems: data.hideFoodItems || undefined,
    supplementation: data.supplementation ?? "",
    notes: data.notes ?? "",
    motivationalQuote: data.motivationalQuote ?? "",
    nextAppointment: data.nextAppointment ?? "",
    createdAt: now(),
    updatedAt: now(),
  };
  s.plans.push(plan);
  if (consultation) consultation.planId = plan.id;
  return clone(plan);
}

export async function updatePlan(
  id: string,
  patch: Partial<Omit<MealPlan, "id" | "clientId" | "createdAt" | "updatedAt">>,
) {
  const p = await findViaClient(store().plans, id);
  if (!p) return undefined;
  Object.assign(p, clone(patch), { updatedAt: now() });
  return clone(p);
}

export async function deletePlan(id: string): Promise<void> {
  if (!(await findViaClient(store().plans, id))) return;
  const s = store();
  s.plans = s.plans.filter((p) => p.id !== id);
  for (const c of s.consultations) if (c.planId === id) c.planId = undefined;
}

// --- Foods & recipes -------------------------------------------------------
export async function listFoods(opts: { includeArchived?: boolean } = {}): Promise<DbFood[]> {
  const me = await nid();
  return clone(
    store()
      .foods.filter((f) => f.nutritionistId === me && (opts.includeArchived || !f.archived))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}

export async function createFood(data: NewFood): Promise<DbFood> {
  const f: DbFood = { ...data, archived: data.archived ?? false, id: newId("food"), nutritionistId: await nid(), createdAt: now() };
  store().foods.push(f);
  return clone(f);
}

export async function updateFood(id: string, patch: Partial<NewFood>) {
  const f = await findOwned(store().foods, id);
  if (!f) return undefined;
  Object.assign(f, patch);
  return clone(f);
}

export async function listRecipes(): Promise<Recipe[]> {
  const me = await nid();
  return clone(
    store()
      .recipes.filter((r) => r.nutritionistId === me)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}

export async function createRecipe(data: NewRecipe): Promise<Recipe> {
  const r: Recipe = { ...clone(data), id: newId("recipe"), nutritionistId: await nid(), createdAt: now() };
  store().recipes.push(r);
  return clone(r);
}

export async function updateRecipe(id: string, patch: Partial<NewRecipe>) {
  const r = await findOwned(store().recipes, id);
  if (!r) return undefined;
  Object.assign(r, clone(patch));
  return clone(r);
}

export async function deleteRecipe(id: string): Promise<void> {
  if (!(await findOwned(store().recipes, id))) return;
  const s = store();
  s.recipes = s.recipes.filter((r) => r.id !== id);
}

// --- Recommendations & templates ------------------------------------------
export async function listRecommendations(): Promise<Recommendation[]> {
  const me = await nid();
  return clone(store().recommendations.filter((r) => r.nutritionistId === me));
}

export async function createRecommendation(data: Omit<Recommendation, "id" | "nutritionistId">) {
  const rec: Recommendation = { ...clone(data), id: newId("rec"), nutritionistId: await nid() };
  store().recommendations.push(rec);
  return clone(rec);
}

export async function updateRecommendation(id: string, patch: Partial<Omit<Recommendation, "id" | "nutritionistId">>) {
  const r = await findOwned(store().recommendations, id);
  if (!r) return undefined;
  Object.assign(r, clone(patch));
  return clone(r);
}

export async function deleteRecommendation(id: string): Promise<void> {
  if (!(await findOwned(store().recommendations, id))) return;
  const s = store();
  s.recommendations = s.recommendations.filter((r) => r.id !== id);
}

export async function listTemplates(): Promise<PlanTemplate[]> {
  const me = await nid();
  return clone(store().templates.filter((t) => t.nutritionistId === me));
}

export async function createTemplate(data: Omit<PlanTemplate, "id" | "nutritionistId">) {
  const tpl: PlanTemplate = { ...clone(data), id: newId("tpl"), nutritionistId: await nid() };
  store().templates.push(tpl);
  return clone(tpl);
}

export async function updateTemplate(id: string, patch: Partial<Omit<PlanTemplate, "id" | "nutritionistId">>) {
  const t = await findOwned(store().templates, id);
  if (!t) return undefined;
  Object.assign(t, clone(patch));
  return clone(t);
}

export async function deleteTemplate(id: string): Promise<void> {
  if (!(await findOwned(store().templates, id))) return;
  const s = store();
  s.templates = s.templates.filter((t) => t.id !== id);
}

// --- Appointments & SMS ----------------------------------------------------
export async function listAppointments(): Promise<Appointment[]> {
  const own = await ownClientIds();
  return clone(
    store()
      .appointments.filter((a) => own.has(a.clientId))
      .sort((a, b) => a.date.localeCompare(b.date)),
  );
}

export async function getAppointment(id: string) {
  const a = await findViaClient(store().appointments, id);
  return a && clone(a);
}

export async function createAppointment(data: NewAppointment): Promise<Appointment> {
  if (!(await ownClient(data.clientId))) throw new Error("Client not found");
  const appt: Appointment = {
    id: newId("appt"),
    clientId: data.clientId,
    date: data.date,
    durationMin: data.durationMin ?? 45,
    note: data.note,
    status: data.status ?? "scheduled",
    reminderEnabled: data.reminderEnabled ?? true,
    reminderChannel: "sms",
    reminderSentAt: data.reminderSentAt,
  };
  store().appointments.push(appt);
  return clone(appt);
}

export async function updateAppointment(id: string, patch: Partial<Omit<Appointment, "id">>) {
  const a = await findViaClient(store().appointments, id);
  if (!a) return undefined;
  if (patch.clientId && !(await ownClient(patch.clientId))) return undefined;
  Object.assign(a, patch);
  return clone(a);
}

export async function deleteAppointment(id: string): Promise<void> {
  if (!(await findViaClient(store().appointments, id))) return;
  const s = store();
  s.appointments = s.appointments.filter((a) => a.id !== id);
  s.messages = s.messages.filter((m) => m.appointmentId !== id);
}

export async function listSentMessages(): Promise<SentMessage[]> {
  const own = await ownClientIds();
  return clone(
    store()
      .messages.filter((m) => own.has(m.clientId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

function rawReminderStore(scope: () => Promise<Set<string> | null>): ReminderStore {
  const allowed = async (clientId: string) => {
    const own = await scope();
    return own === null || own.has(clientId);
  };
  return {
    async listAppointments() {
      const own = await scope();
      return clone(store().appointments.filter((a) => own === null || own.has(a.clientId)));
    },
    async getClient(id) {
      const c = store().clients.find((x) => x.id === id);
      return c && (await allowed(c.id)) ? clone(c) : undefined;
    },
    async getProfile(id) {
      const p = store().profiles.find((x) => x.id === id);
      return p && clone(p);
    },
    async markReminderSent(id, when) {
      const a = store().appointments.find((x) => x.id === id);
      if (a && (await allowed(a.clientId))) a.reminderSentAt = when;
    },
    async addSentMessage(msg) {
      if (await allowed(msg.clientId)) store().messages.push({ ...msg, id: newId("msg") });
    },
  };
}

export function tenantReminderStore(): ReminderStore {
  return rawReminderStore(ownClientIds);
}

export function cronReminderStore(): ReminderStore {
  return rawReminderStore(async () => null);
}

// --- Uploaded PDF templates & files ----------------------------------------
export async function listPdfTemplates(): Promise<PdfTemplateFile[]> {
  const me = await nid();
  return clone(store().pdfTemplates.filter((t) => t.nutritionistId === me));
}

export async function getPdfTemplate(id: string) {
  const t = await findOwned(store().pdfTemplates, id);
  return t && clone(t);
}

export async function createPdfTemplate(data: { name: string; storagePath: string }) {
  const tpl: PdfTemplateFile = { id: newId("pdftpl"), nutritionistId: await nid(), ...data, createdAt: now() };
  store().pdfTemplates.push(tpl);
  return clone(tpl);
}

export async function deletePdfTemplate(id: string): Promise<void> {
  const t = await findOwned(store().pdfTemplates, id);
  if (!t) return;
  const s = store();
  s.pdfTemplates = s.pdfTemplates.filter((x) => x.id !== id);
  s.files.delete(t.storagePath);
  for (const p of s.plans) if (p.pdfTemplateId === id) p.pdfTemplateId = "classic";
}

export async function putFile(kind: FileKind, bytes: Uint8Array, contentType: string, ext: string) {
  const key = `${await nid()}/${kind}-${newId("file")}.${ext}`;
  store().files.set(key, { bytes, contentType });
  return key;
}

export async function getFile(key: string) {
  const me = await nid();
  if (!key.startsWith(`${me}/`)) return undefined;
  return store().files.get(key);
}

export async function deleteFile(key: string): Promise<void> {
  const me = await nid();
  if (key.startsWith(`${me}/`)) store().files.delete(key);
}
