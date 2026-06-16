"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { METS, metCategories, metKcal, searchMets } from "@/lib/nutrition/mets";

export function MetsExplorer() {
  const t = useTranslations("mets");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [weight, setWeight] = useState(70);
  const [minutes, setMinutes] = useState(30);
  const categories = useMemo(() => metCategories(), []);
  const results = useMemo(() => searchMets(q, category || undefined, 300), [q, category]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-md border border-input bg-card px-3 text-sm sm:w-52"
        >
          <option value="">{t("allCategories")}</option>
          {categories.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <div className="flex items-end gap-2">
          <label className="text-xs text-muted-foreground">
            {t("weight")}
            <Input
              type="number"
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value) || 0)}
              className="mt-1 h-9 w-20"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            {t("minutes")}
            <Input
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value) || 0)}
              className="mt-1 h-9 w-20"
            />
          </label>
        </div>
      </div>

      <p className="mb-2 text-xs text-muted-foreground">
        {t("count", { shown: results.length, total: METS.length })}
      </p>

      <div className="card-surface overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">{t("activity")}</th>
              <th className="px-3 py-2 text-right font-medium">MET</th>
              <th className="px-3 py-2 text-right font-medium">{t("estimate")}</th>
            </tr>
          </thead>
          <tbody>
            {results.map((m, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2">
                  <p className="font-medium">{m.activity}</p>
                  <p className="text-xs text-muted-foreground">{m.category}</p>
                </td>
                <td className="px-3 py-2 text-right font-medium">{m.met}</td>
                <td className="px-3 py-2 text-right text-brand-600">
                  {metKcal(m.met, weight, minutes)} kcal
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
