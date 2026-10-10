import { computeBmi, type Client, type Meal } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { monthStartISO, newId, onOrAfter } from "@/lib/utils";
import type { Repository } from "./repo-types";
import * as memory from "./repo-memory";
import * as supabase from "./repo-supabase";

// ---------------------------------------------------------------------------
// Repository facade — the single data boundary of the app.
//
//   • repo-memory.ts   — zero-setup in-memory store (default, demo/local)
//   • repo-supabase.ts — Supabase/Postgres with RLS (production)
//
// Both modules are checked against the Repository contract below, so they
// can never drift apart. Supabase is used whenever its env vars are present.
// ---------------------------------------------------------------------------

const memoryRepo: Repository = memory;
const supabaseRepo: Repository = supabase;

export const backend: "supabase" | "memory" = isSupabaseConfigured() ? "supabase" : "memory";
const impl: Repository = backend === "supabase" ? supabaseRepo : memoryRepo;

export const {
  authenticate,
  signOut,
  getAuthNid,
  getLoginEmail,
  requestPasswordReset,
  redeemEmailLink,
  setPassword,
  changePassword,
  changeLoginEmail,
  getMfaStatus,
  startMfaEnrollment,
  verifyMfa,
  disableMfa,
  getProfile,
  updateProfile,
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  listConsultations,
  listAllConsultations,
  getConsultation,
  createConsultation,
  updateConsultation,
  deleteConsultation,
  listConsultationTypes,
  createConsultationType,
  updateConsultationType,
  deleteConsultationType,
  listBillingEntries,
  createBillingEntry,
  updateBillingEntry,
  deleteBillingEntry,
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
  listFoods,
  createFood,
  updateFood,
  listRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  listRecommendations,
  createRecommendation,
  updateRecommendation,
  deleteRecommendation,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  listSentMessages,
  tenantReminderStore,
  cronReminderStore,
  listPdfTemplates,
  getPdfTemplate,
  createPdfTemplate,
  deletePdfTemplate,
  putFile,
  getFile,
  deleteFile,
} = impl;

// --- Backend-agnostic helpers ----------------------------------------------

export function blankMeal(name = ""): Meal {
  return { id: newId("meal"), name, options: [{ id: newId("opt"), content: "" }] };
}

export async function getLastConsultation(clientId: string) {
  return (await listConsultations(clientId))[0];
}

/** Clients keyed by id — for joining names onto lists without N+1 lookups. */
export async function clientMap(): Promise<Map<string, Client>> {
  return new Map((await listClients()).map((c) => [c.id, c]));
}

/** Autocomplete suggestions from a client's history (meal option texts seen before). */
export async function getMealSuggestions(clientId: string): Promise<string[]> {
  const plans = await listPlans(clientId);
  const set = new Set<string>();
  for (const p of plans) {
    for (const meal of p.meals) {
      for (const opt of meal.options) {
        const text = opt.content.trim();
        if (text && text.length < 120) set.add(text);
      }
    }
  }
  return [...set].slice(0, 30);
}

export async function getDashboardStats() {
  const [clients, consultations, appts, plans, billing] = await Promise.all([
    listClients(),
    listAllConsultations(),
    listAppointments(),
    listPlans(),
    listBillingEntries(),
  ]);
  const byId = new Map(clients.map((c) => [c.id, c]));
  const monthStart = monthStartISO();
  const now = Date.now();

  const upcoming = appts
    .filter((a) => a.status === "scheduled" && new Date(a.date).getTime() >= now)
    .sort((a, b) => a.date.localeCompare(b.date));

  // A client is "active" when seen in the last 6 months.
  const sixMonthsAgo = new Date(now - 182 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const activeIds = new Set(consultations.filter((c) => c.date >= sixMonthsAgo).map((c) => c.clientId));

  return {
    totalClients: clients.length,
    activeClients: activeIds.size,
    newClientsThisMonth: clients.filter((c) => onOrAfter(c.createdAt, monthStart)).length,
    totalConsultations: consultations.length,
    consultationsThisMonth: consultations.filter((c) => c.date >= monthStart).length,
    plansGenerated: plans.length,
    upcomingCount: upcoming.length,
    revenueThisMonth: billing.filter((b) => b.date >= monthStart).reduce((s, b) => s + b.amount, 0),
    pendingRevenue: billing.filter((b) => b.status === "pending").reduce((s, b) => s + b.amount, 0),
    recentConsultationList: consultations.slice(0, 6).map((c) => ({
      consultation: c,
      client: byId.get(c.clientId),
      bmi: computeBmi(c.measurements),
    })),
    upcomingList: upcoming.slice(0, 5).map((a) => ({ appointment: a, client: byId.get(a.clientId) })),
  };
}
