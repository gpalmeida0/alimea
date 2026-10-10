// ---------------------------------------------------------------------------
// Alimea domain model
// Shared between the data layer, UI and the PDF template engine.
// Mirrors the Supabase schema in supabase/migrations/0001_init.sql
// ---------------------------------------------------------------------------

import type { Sex } from "@/lib/nutrition/calc";
import type { Appearance } from "@/lib/theme";

export type PlanLanguage = "pt-PT" | "en";

export type { Sex };

/** Ethnicity — drives body-composition formula coefficients (white=0 / black=1). */
export type Ethnicity = "white" | "black" | "other";

export type RecommendationCategory =
  | "hydration"
  | "behavior"
  | "supplementation"
  | "restrictions"
  | "general";

/** The nutritionist account + clinic branding used on generated PDFs. */
export interface NutritionistProfile {
  id: string;
  name: string;
  email: string;
  credential: string; // Cédula Profissional
  instagram?: string;
  phone?: string;
  address?: string;
  logoUrl?: string; // path under /public or remote URL
  pdfTemplate?: string; // which built-in PDF design to use (e.g. "classic")
  interfaceLanguage: PlanLanguage;
  /** How this account's workspace looks (theme, brand colour…). */
  appearance?: Appearance;
}

/** Built-in PDF designs the app can render. */
export const PDF_TEMPLATES = ["classic"] as const;
export type PdfTemplate = (typeof PDF_TEMPLATES)[number];

export interface Client {
  id: string;
  nutritionistId: string;
  name: string;
  email?: string;
  phone?: string;
  birthDate?: string; // ISO date
  /** Sex — used by body-composition and energy formulas. */
  sex?: Sex;
  /** Ethnicity — used by body-composition formulas. */
  ethnicity?: Ethnicity;
  profession?: string;
  goals?: string;
  notes?: string;
  /** ANAMNESE — personal questionnaire (BOO-51). */
  anamnesis?: Anamnesis;
  createdAt: string;
}

/** ANAMNESE — initial questionnaire captured on the client (BOO-51). */
export interface Anamnesis {
  /** Reason for the consultation. */
  reason?: string;
  /** Previously followed by a nutritionist? + detail. */
  previousFollowUp?: boolean;
  previousFollowUpDetail?: string;
  /** Food allergies / intolerances. */
  allergies?: string;
  /** Sport / physical activity. */
  sport?: string;
  /** Considered an athlete (drives athlete body-composition formulas). */
  isAthlete?: boolean;
  // Observations (right column) — free-text clinical fields.
  dislikedFoods?: string;
  bowelFunction?: string;
  menstrualCycle?: string;
  medication?: string;
  sleepQuality?: string;
  stressLevel?: string;
}

/** Anthropometric measurements captured at a consultation (BOO-53). */
export interface Measurements {
  weightKg?: number;
  /** Height in cm — the canonical height field. */
  heightCm?: number;
  /** @deprecated Legacy height in metres; read via heightCmOf(), never written. */
  heightM?: number;
  // Bioimpedance readouts (entered by hand from the device).
  bodyFatPct?: number;
  muscleMassKg?: number;
  leanMassKg?: number; // Kg Massa Magra
  waterPct?: number; // % Água Corporal
  visceralFat?: number; // Nível Gordura Visceral
  perimeters: {
    waist?: number;
    arm?: number;
    hip?: number;
    thigh?: number;
    calf?: number;
    abdominal?: number; // new, requested
    chest?: number; // peito — new, requested
  };
  skinfolds: {
    tricipital?: number;
    subscapular?: number;
    bicipital?: number;
    iliocristal?: number;
    supraspinal?: number;
    abdominal?: number;
    geminal?: number;
    crural?: number;
    peitoral?: number; // chest skinfold (used by some male formulas)
  };
}

/** First-consultation detailed food history block, one per meal (BOO-52). */
export interface FoodHistoryMeal {
  id: string;
  name: string;
  timePlace?: string;
  content?: string;
  advice?: string;
}

/** ANAMNESE — food history, behaves differently on 1st vs later consults (BOO-52). */
export interface FoodHistory {
  /** Detailed per-meal blocks (1st consultation). */
  meals?: FoodHistoryMeal[];
  hydration?: string;
  adviceObservations?: string;
  /** Free scratch pad next to the food history (1st consultation). */
  draft?: string;
  /** Single free-text box (consultations ≥ 2). */
  followUpNote?: string;
}

/** NECESSIDADES ENERGÉTICAS — basal/total energy + plan target (BOO-55/63/64). */
export interface EnergyConfig {
  /** Selected GEB formula key (see lib/nutrition/energy.ts). */
  gebFormula?: string;
  /** Physical activity level multiplier (PAL). */
  pal?: number;
  /** Optional stress factor multiplier. */
  stressFactor?: number;
  /** Plan calorie target (kcal). Defaults to computed GET. */
  targetKcal?: number;
}

/** DISTRIBUIÇÃO MACROS — macro % split (BOO-56). */
export interface MacroConfig {
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}

/** Default macro split from the Excel (15 / 55 / 30). */
export const DEFAULT_MACRO_CONFIG: MacroConfig = {
  proteinPct: 15,
  carbsPct: 55,
  fatPct: 30,
};

export interface Consultation {
  id: string;
  clientId: string;
  date: string; // ISO date
  /** 1ª, 2ª… consultation — drives the "evolution" columns and the food-history layout. */
  consultationNumber?: number;
  measurements: Measurements;
  /** ANAMNESE food history for this consultation (BOO-52). */
  foodHistory?: FoodHistory;
  /** Energy needs configuration/result (BOO-55). */
  energy?: EnergyConfig;
  /** Macro distribution configuration (BOO-56). */
  macros?: MacroConfig;
  notes?: string;
  /** The meal plan attached to this consultation, if generated. */
  planId?: string;
  /** Consultation type (drives billing). */
  consultationTypeId?: string;
  createdAt: string;
}

/** A consultation type with its billing price (e.g. Presencial, Beat, Online). */
export interface ConsultationType {
  id: string;
  nutritionistId: string;
  name: string;
  price: number;
  isDefault: boolean;
}

/** Built-in consultation types seeded for every nutritionist (editable after). */
export const DEFAULT_CONSULTATION_TYPES: { name: string; price: number }[] = [
  { name: "Presencial", price: 40 },
  { name: "Beat", price: 50 },
  { name: "Online", price: 35 },
];

export type BillingStatus = "pending" | "paid";

/** A billable item — auto-created when a consultation is held, or added by hand. */
export interface BillingEntry {
  id: string;
  nutritionistId: string;
  clientId?: string;
  consultationId?: string;
  clientName: string; // snapshot (works for manual entries / deleted clients)
  typeName: string; // snapshot of the consultation type label
  amount: number;
  date: string; // ISO date
  status: BillingStatus;
  notes?: string;
  source: "auto" | "manual";
  createdAt: string;
}

export type FoodUnit = "g" | "mL" | "porção";

/** A quantified food added to a meal option, for calorie/macro totals. */
export interface FoodItem {
  id: string;
  name: string;
  qtyG: number; // chosen quantity in the item's base unit (grams by default)
  /** Display unit (defaults to grams). Recipes use "porção". */
  unit?: FoodUnit;
  /** Whether this references a database food or a recipe. */
  kind?: "food" | "recipe";
  /** Source id in the foods / recipes database, when applicable. */
  refId?: string;
  /** Per-unit nutrition (so totals recompute when qty changes). */
  perG: { kcal: number; protein: number; carbs: number; fat: number };
}

/** A food in the nutritionist's editable database (BOO-57). */
export interface DbFood {
  id: string;
  nutritionistId: string;
  name: string;
  /** Base measuring unit. */
  baseUnit: "g" | "mL";
  /** Reference quantity the macros below are stated for (e.g. 100). */
  refQty: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  brand?: string;
  category?: string;
  archived?: boolean;
  createdAt: string;
}

/** One ingredient line of a recipe (references a DbFood). */
export interface RecipeItem {
  id: string;
  foodId: string;
  /** Snapshot of the food name (for display even if the food changes). */
  name: string;
  /** Quantity in the food's base unit. */
  qty: number;
}

/** A recipe composed of database foods, with per-portion totals (BOO-58). */
export interface Recipe {
  id: string;
  nutritionistId: string;
  name: string;
  servings: number;
  items: RecipeItem[];
  preparation?: string;
  createdAt: string;
}

/** One option line inside a meal (e.g. "opção 1"). */
export interface MealOption {
  id: string;
  content: string;
  items?: FoodItem[];
}

/** A meal block in a plan. Fully flexible: name, time, any number of options. */
export interface Meal {
  id: string;
  name: string;
  time?: string;
  options: MealOption[];
}

/** A PDF design the nutritionist uploaded, used as the base for generated plans. */
export interface PdfTemplateFile {
  id: string;
  nutritionistId: string;
  name: string;
  storagePath: string; // path under /public
  createdAt: string;
}

export interface MealPlan {
  id: string;
  clientId: string;
  consultationId?: string;
  language: PlanLanguage;
  /** "classic" (built-in design) or an uploaded PdfTemplateFile id. */
  pdfTemplateId?: string;
  meals: Meal[];
  supplementation?: string;
  notes?: string;
  motivationalQuote?: string;
  nextAppointment?: string; // free text, e.g. "20 de maio às 14h00"
  createdAt: string;
  updatedAt: string;
}

/** Reusable multilingual clinical text block. */
export interface Recommendation {
  id: string;
  nutritionistId: string;
  category: RecommendationCategory;
  title: string;
  content: { "pt-PT": string; en: string };
}

/** A reusable internal plan template (pre-built meal structure). */
export interface PlanTemplate {
  id: string;
  nutritionistId: string;
  name: string;
  language: PlanLanguage;
  meals: Meal[];
  supplementation?: string;
  notes?: string;
}

export type AppointmentStatus = "scheduled" | "completed" | "cancelled";

export interface Appointment {
  id: string;
  clientId: string;
  date: string; // ISO datetime
  durationMin?: number;
  note?: string;
  status: AppointmentStatus;
  /** Automatic 1-day-before reminder. */
  reminderEnabled: boolean;
  reminderChannel: "sms";
  reminderSentAt?: string; // ISO datetime when the reminder went out
}

/** A reminder message that has been sent (or simulated). Powers the SMS outbox. */
export interface SentMessage {
  id: string;
  appointmentId: string;
  clientId: string;
  to: string;
  channel: "sms";
  body: string;
  status: "sent" | "failed" | "simulated";
  provider: string;
  createdAt: string;
}

/** Bundle handed to the PDF engine — fully resolved, language-agnostic data. */
export interface PlanDocumentData {
  profile: NutritionistProfile;
  client: Client;
  consultation?: Consultation;
  previousConsultation?: Consultation;
  plan: MealPlan;
  language: PlanLanguage;
}

// --- helpers ---------------------------------------------------------------

export const emptyMeasurements = (): Measurements => ({ perimeters: {}, skinfolds: {} });

/** Height in cm, tolerating the legacy `heightM` field (metres, or cm typed into it). */
export function heightCmOf(m: Partial<Measurements> | undefined): number | undefined {
  if (!m) return undefined;
  if (typeof m.heightCm === "number" && m.heightCm > 0) return m.heightCm;
  if (typeof m.heightM === "number" && m.heightM > 0) {
    return m.heightM < 3 ? Math.round(m.heightM * 1000) / 10 : m.heightM;
  }
  return undefined;
}

/** Canonical shape: heightCm set, legacy heightM dropped, sub-objects present. */
export function normalizeMeasurements(m: Partial<Measurements> | null | undefined): Measurements {
  const src = m ?? {};
  const { heightM: _legacy, ...rest } = src;  
  return {
    ...rest,
    heightCm: heightCmOf(src),
    perimeters: { ...(src.perimeters ?? {}) },
    skinfolds: { ...(src.skinfolds ?? {}) },
  };
}

export function computeBmi(m: Partial<Measurements> | undefined): number | undefined {
  const h = heightCmOf(m);
  if (!m?.weightKg || !h) return undefined;
  const meters = h / 100;
  return Math.round((m.weightKg / (meters * meters)) * 10) / 10;
}

function sumOf(values: Record<string, number | undefined>): number | undefined {
  const v = Object.values(values).filter((x): x is number => typeof x === "number" && !Number.isNaN(x));
  if (!v.length) return undefined;
  return Math.round(v.reduce((a, b) => a + b, 0) * 10) / 10;
}

export const sumPerimeters = (m: Measurements) => sumOf(m.perimeters);
export const sumSkinfolds = (m: Measurements) => sumOf(m.skinfolds);

/** Newest first: by date, then by creation time (stable for same-day consultations). */
export function byNewest<T extends { date: string; createdAt?: string }>(a: T, b: T): number {
  return b.date.localeCompare(a.date) || (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
}
