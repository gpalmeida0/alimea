"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FOODS, foodGroups, searchFoods } from "@/lib/nutrition/foods";

const fmt = (v: number | null) => (v == null ? "—" : String(v));

export function FoodExplorer() {
  const t = useTranslations("foods");
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const groups = useMemo(() => foodGroups(), []);
  const results = useMemo(() => searchFoods(q, group || undefined, 300), [q, group]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
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
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          className="h-9 rounded-md border border-input bg-card px-3 text-sm sm:w-64"
        >
          <option value="">{t("allGroups")}</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <p className="mb-2 text-xs text-muted-foreground">
        {t("count", { shown: results.length, total: FOODS.length })}
      </p>

      <div className="card-surface overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">{t("food")}</th>
              <th className="px-3 py-2 font-medium">{t("portion")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("kcal")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("protein")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("carbs")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("fat")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("fibre")}</th>
            </tr>
          </thead>
          <tbody>
            {results.map((f, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2">
                  <p className="font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{f.group}</p>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {f.portion}
                  {f.qtyG ? ` · ${f.qtyG}g` : ""}
                </td>
                <td className="px-3 py-2 text-right font-medium">{fmt(f.kcal)}</td>
                <td className="px-3 py-2 text-right">{fmt(f.protein)}</td>
                <td className="px-3 py-2 text-right">{fmt(f.carbs)}</td>
                <td className="px-3 py-2 text-right">{fmt(f.fat)}</td>
                <td className="px-3 py-2 text-right">{fmt(f.fibre)}</td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  {t("noResults")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
