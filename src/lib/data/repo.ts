import type { Meal } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import * as memory from "./repo-memory";
import * as supabase from "./repo-supabase";

// ---------------------------------------------------------------------------
// Repository facade.
//
// Alimea has two interchangeable data backends with an identical async API:
//   • repo-memory.ts   — zero-setup in-memory store (default)
//   • repo-supabase.ts — the real Supabase/Postgres database
//
// When the Supabase env vars are present we use the real database; otherwise
// we fall back to the in-memory store. Every call site imports from here, so
// switching backends is transparent.
// ---------------------------------------------------------------------------

const impl = isSupabaseConfigured() ? supabase : memory;

// --- Auth ------------------------------------------------------------------
export const authenticate = impl.authenticate;
export const emailExists = impl.emailExists;
export const createAccount = impl.createAccount;
export const signOut = impl.signOut;
export const getAuthNid = impl.getAuthNid;

// --- Profile ---------------------------------------------------------------
export const getProfile = impl.getProfile;
export const getProfileById = impl.getProfileById;
export const updateProfile = impl.updateProfile;

// --- Clients ---------------------------------------------------------------
export const listClients = impl.listClients;
export const getClient = impl.getClient;
export const createClient = impl.createClient;
export const updateClient = impl.updateClient;
export const deleteClient = impl.deleteClient;

// --- Consultations ---------------------------------------------------------
export const listConsultations = impl.listConsultations;
export const getConsultation = impl.getConsultation;
export const getLastConsultation = impl.getLastConsultation;
export const createConsultation = impl.createConsultation;
export const updateConsultation = impl.updateConsultation;

// --- Consultation types & billing ------------------------------------------
export const listConsultationTypes = impl.listConsultationTypes;
export const createConsultationType = impl.createConsultationType;
export const updateConsultationType = impl.updateConsultationType;
export const deleteConsultationType = impl.deleteConsultationType;
export const listBillingEntries = impl.listBillingEntries;
export const createBillingEntry = impl.createBillingEntry;
export const updateBillingEntry = impl.updateBillingEntry;
export const deleteBillingEntry = impl.deleteBillingEntry;

// --- Plans -----------------------------------------------------------------
export const listPlans = impl.listPlans;
export const getPlan = impl.getPlan;
export const createPlan = impl.createPlan;
export const updatePlan = impl.updatePlan;
export const duplicatePlan = impl.duplicatePlan;

// --- Foods database (BOO-57) -----------------------------------------------
export const listFoods = impl.listFoods;
export const getFood = impl.getFood;
export const createFood = impl.createFood;
export const updateFood = impl.updateFood;
export const deleteFood = impl.deleteFood;

// --- Recipes (BOO-58) ------------------------------------------------------
export const listRecipes = impl.listRecipes;
export const getRecipe = impl.getRecipe;
export const createRecipe = impl.createRecipe;
export const updateRecipe = impl.updateRecipe;
export const deleteRecipe = impl.deleteRecipe;

// --- Recommendations -------------------------------------------------------
export const listRecommendations = impl.listRecommendations;
export const createRecommendation = impl.createRecommendation;

// --- Templates -------------------------------------------------------------
export const listTemplates = impl.listTemplates;
export const getTemplate = impl.getTemplate;
export const createTemplate = impl.createTemplate;

// --- Appointments ----------------------------------------------------------
export const listAppointments = impl.listAppointments;
export const listAllAppointments = impl.listAllAppointments;
export const getAppointment = impl.getAppointment;
export const createAppointment = impl.createAppointment;
export const updateAppointment = impl.updateAppointment;
export const markReminderSent = impl.markReminderSent;

// --- Uploaded PDF templates ------------------------------------------------
export const listPdfTemplates = impl.listPdfTemplates;
export const getPdfTemplate = impl.getPdfTemplate;
export const createPdfTemplate = impl.createPdfTemplate;
export const deletePdfTemplate = impl.deletePdfTemplate;

// --- SMS outbox ------------------------------------------------------------
export const addSentMessage = impl.addSentMessage;
export const listSentMessages = impl.listSentMessages;

// --- Dashboard aggregates --------------------------------------------------
export const getDashboardStats = impl.getDashboardStats;

// --- Backend-agnostic helpers ----------------------------------------------
const uid = (p: string) =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${p}-${Math.random().toString(36).slice(2, 9)}`;

export function newMessageId(): string {
  return uid("msg");
}

export function blankMeal(name = ""): Meal {
  return { id: uid("meal"), name, options: [{ id: uid("opt"), content: "" }] };
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
