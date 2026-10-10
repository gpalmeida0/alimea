import type {
  Appointment,
  BillingEntry,
  Client,
  Consultation,
  ConsultationType,
  DbFood,
  MealPlan,
  NutritionistProfile,
  PdfTemplateFile,
  PlanTemplate,
  Recipe,
  Recommendation,
  SentMessage,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// The repository contract. Both backends (memory + Supabase) must implement it
// exactly — repo.ts assigns each module to this type, so any drift is a
// compile error instead of a runtime surprise.
//
// Every function is scoped to the signed-in nutritionist (tenant). Reading or
// writing another tenant's row behaves as "not found".
// ---------------------------------------------------------------------------

export type NewClient = Omit<Client, "id" | "nutritionistId" | "createdAt">;
export type NewFood = Omit<DbFood, "id" | "nutritionistId" | "createdAt" | "archived"> &
  Partial<Pick<DbFood, "archived">>;
export type NewRecipe = Omit<Recipe, "id" | "nutritionistId" | "createdAt">;
export type NewAppointment = Omit<Appointment, "id" | "status" | "reminderChannel"> &
  Partial<Pick<Appointment, "status">>;
export type NewBillingEntry = {
  clientId?: string;
  clientName: string;
  typeName: string;
  amount: number;
  date: string;
  status?: "pending" | "paid";
  notes?: string;
};
export type BillingPatch = Partial<
  Pick<BillingEntry, "clientName" | "typeName" | "amount" | "date" | "status" | "notes">
>;
export type FileKind = "logo" | "pdf-template";
export type StoredFile = { bytes: Uint8Array; contentType: string };

/** Minimal data access the SMS reminder engine needs (see lib/messaging). */
export interface ReminderStore {
  listAppointments(): Promise<Appointment[]>;
  getClient(id: string): Promise<Client | undefined>;
  getProfile(nutritionistId: string): Promise<NutritionistProfile | undefined>;
  markReminderSent(appointmentId: string, when: string): Promise<void>;
  addSentMessage(msg: Omit<SentMessage, "id">): Promise<void>;
}

export type AuthStatus = "ok" | "mfa" | "invalid";
export const EMAIL_LINK_TYPES = ["invite", "recovery", "email_change", "signup", "email"] as const;
export type EmailLinkType = (typeof EMAIL_LINK_TYPES)[number];
export type PasswordResult = "ok" | "invalid" | "weak" | "same" | "failed";
export type EmailChangeResult = "ok" | "confirm" | "exists" | "failed";
export interface MfaStatus {
  /** False on the in-memory demo backend. */
  supported: boolean;
  enabled: boolean;
  /** Signed in with a password but the 2FA code has not been entered yet. */
  pending: boolean;
}
export interface MfaEnrollment {
  factorId: string;
  /** SVG data URL of the QR code to scan. */
  qrCode: string;
  secret: string;
}

export interface Repository {
  // Auth — accounts are provisioned by the studio (scripts/admin.ts), so there
  // is no self-service signup.
  authenticate(email: string, password: string): Promise<AuthStatus>;
  signOut(): Promise<void>;
  /** The signed-in tenant id, or null (also null while a 2FA challenge is pending). */
  getAuthNid(): Promise<string | null>;
  /** The address used to sign in (not the profile email printed on PDFs). */
  getLoginEmail(): Promise<string | null>;
  /** Sends a recovery email. Never reveals whether the address exists. */
  requestPasswordReset(email: string): Promise<void>;
  /** Redeems an emailed link (invite, recovery, email change) for a session. */
  redeemEmailLink(tokenHash: string, type: EmailLinkType): Promise<boolean>;
  /** Sets a password on the current session (after an invite or recovery link). */
  setPassword(password: string): Promise<PasswordResult>;
  changePassword(current: string, next: string): Promise<PasswordResult>;
  changeLoginEmail(email: string): Promise<EmailChangeResult>;
  // Two-factor authentication (TOTP)
  getMfaStatus(): Promise<MfaStatus>;
  startMfaEnrollment(): Promise<MfaEnrollment | null>;
  /** Verifies a code: completes an enrolment, or passes the sign-in challenge. */
  verifyMfa(code: string, factorId?: string): Promise<boolean>;
  disableMfa(): Promise<boolean>;

  // Profile
  getProfile(): Promise<NutritionistProfile>;
  updateProfile(patch: Partial<Omit<NutritionistProfile, "id">>): Promise<NutritionistProfile>;

  // Clients
  listClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(data: NewClient): Promise<Client>;
  updateClient(id: string, patch: Partial<NewClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<void>;

  // Consultations
  listConsultations(clientId: string): Promise<Consultation[]>;
  /** Every consultation of the tenant, newest first (dashboards, lists). */
  listAllConsultations(): Promise<Consultation[]>;
  getConsultation(id: string): Promise<Consultation | undefined>;
  createConsultation(
    clientId: string,
    opts?: { duplicateFrom?: Consultation; consultationTypeId?: string; date?: string },
  ): Promise<Consultation>;
  updateConsultation(id: string, patch: Partial<Omit<Consultation, "id" | "clientId" | "createdAt">>): Promise<Consultation | undefined>;
  deleteConsultation(id: string): Promise<void>;

  // Consultation types & billing
  listConsultationTypes(): Promise<ConsultationType[]>;
  createConsultationType(data: { name: string; price: number }): Promise<ConsultationType>;
  updateConsultationType(id: string, patch: { name?: string; price?: number }): Promise<ConsultationType | undefined>;
  deleteConsultationType(id: string): Promise<void>;
  listBillingEntries(): Promise<BillingEntry[]>;
  createBillingEntry(data: NewBillingEntry): Promise<BillingEntry>;
  updateBillingEntry(id: string, patch: BillingPatch): Promise<BillingEntry | undefined>;
  deleteBillingEntry(id: string): Promise<void>;

  // Plans
  listPlans(clientId?: string): Promise<MealPlan[]>;
  getPlan(id: string): Promise<MealPlan | undefined>;
  createPlan(data: Partial<MealPlan> & { clientId: string }): Promise<MealPlan>;
  updatePlan(id: string, patch: Partial<Omit<MealPlan, "id" | "clientId" | "createdAt" | "updatedAt">>): Promise<MealPlan | undefined>;
  deletePlan(id: string): Promise<void>;

  // Foods & recipes
  listFoods(opts?: { includeArchived?: boolean }): Promise<DbFood[]>;
  createFood(data: NewFood): Promise<DbFood>;
  updateFood(id: string, patch: Partial<NewFood>): Promise<DbFood | undefined>;
  listRecipes(): Promise<Recipe[]>;
  createRecipe(data: NewRecipe): Promise<Recipe>;
  updateRecipe(id: string, patch: Partial<NewRecipe>): Promise<Recipe | undefined>;
  deleteRecipe(id: string): Promise<void>;

  // Recommendations & plan templates
  listRecommendations(): Promise<Recommendation[]>;
  createRecommendation(data: Omit<Recommendation, "id" | "nutritionistId">): Promise<Recommendation>;
  updateRecommendation(id: string, patch: Partial<Omit<Recommendation, "id" | "nutritionistId">>): Promise<Recommendation | undefined>;
  deleteRecommendation(id: string): Promise<void>;
  listTemplates(): Promise<PlanTemplate[]>;
  createTemplate(data: Omit<PlanTemplate, "id" | "nutritionistId">): Promise<PlanTemplate>;
  updateTemplate(id: string, patch: Partial<Omit<PlanTemplate, "id" | "nutritionistId">>): Promise<PlanTemplate | undefined>;
  deleteTemplate(id: string): Promise<void>;

  // Appointments & SMS
  listAppointments(): Promise<Appointment[]>;
  getAppointment(id: string): Promise<Appointment | undefined>;
  createAppointment(data: NewAppointment): Promise<Appointment>;
  updateAppointment(id: string, patch: Partial<Omit<Appointment, "id">>): Promise<Appointment | undefined>;
  deleteAppointment(id: string): Promise<void>;
  listSentMessages(): Promise<SentMessage[]>;
  /** Reminder data access scoped to the signed-in tenant. */
  tenantReminderStore(): ReminderStore;
  /** Cross-tenant reminder data access for the trusted cron job only. */
  cronReminderStore(): ReminderStore | null;

  // Uploaded PDF templates + file storage
  listPdfTemplates(): Promise<PdfTemplateFile[]>;
  getPdfTemplate(id: string): Promise<PdfTemplateFile | undefined>;
  createPdfTemplate(data: { name: string; storagePath: string }): Promise<PdfTemplateFile>;
  deletePdfTemplate(id: string): Promise<void>;
  /** Stores a file under the tenant's folder; returns its storage key. */
  putFile(kind: FileKind, bytes: Uint8Array, contentType: string, ext: string): Promise<string>;
  /** Reads a tenant-owned file by key (undefined when missing or not owned). */
  getFile(key: string): Promise<StoredFile | undefined>;
  deleteFile(key: string): Promise<void>;
}
