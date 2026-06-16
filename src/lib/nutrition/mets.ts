import data from "./mets.json";

export interface Met {
  met: number;
  category: string;
  activity: string;
}

// Compendium of Physical Activities (METs) imported from the Excel.
export const METS = data as Met[];

export function metCategories(): string[] {
  return [...new Set(METS.map((m) => m.category))].sort((a, b) => a.localeCompare(b));
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function searchMets(query: string, category?: string, limit = 100): Met[] {
  const q = normalize(query.trim());
  return METS.filter(
    (m) =>
      (!category || m.category === category) &&
      (!q || normalize(m.activity).includes(q) || normalize(m.category).includes(q)),
  ).slice(0, limit);
}

/** Energy expended: 1 MET ≈ 1 kcal per kg per hour. */
export function metKcal(met: number, weightKg: number, minutes: number): number {
  return Math.round(met * weightKg * (minutes / 60));
}
