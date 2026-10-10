"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Plus, Search } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { useServerAction } from "@/hooks/use-server-action";
import { saveFoodAction } from "@/app/actions";
import { FOODS, foodGroups, searchFoods, type Food } from "@/lib/nutrition/foods";
import { formatNumber, normalizeSearch } from "@/lib/utils";

/** Read-only built-in food composition table, with one-click copy into "My foods". */
export function FoodExplorer({ ownNames }: { ownNames: string[] }) {
  const t = useTranslations("foods");
  const tn = useTranslations("nutrition");
  const locale = useLocale();
  const { run } = useServerAction();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [copied, setCopied] = useState<Set<string>>(() => new Set(ownNames.map(normalizeSearch)));
  const groups = useMemo(() => foodGroups(), []);
  const results = useMemo(() => searchFoods(q, group || undefined, 300), [q, group]);
  const fmt = (v: number | null) => (v == null ? "—" : formatNumber(v, locale));

  function copy(f: Food) {
    const qty = f.qtyG && f.qtyG > 0 ? f.qtyG : 100;
    setCopied((s) => new Set(s).add(normalizeSearch(f.name)));
    run(
      () =>
        saveFoodAction(locale, {
          name: f.name,
          category: f.group,
          baseUnit: "g",
          refQty: qty,
          kcal: f.kcal ?? 0,
          protein: f.protein ?? 0,
          carbs: f.carbs ?? 0,
          fat: f.fat ?? 0,
        }),
      { success: tn("addedToMyFoods", { name: f.name }) },
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} className="pl-9" aria-label={t("searchPlaceholder")} />
        </div>
        <Select value={group} onChange={(e) => setGroup(e.target.value)} className="sm:w-64" aria-label={t("allGroups")}>
          <option value="">{t("allGroups")}</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
      </div>

      <p className="mb-2 text-xs text-muted-foreground">{t("count", { shown: results.length, total: FOODS.length })}</p>

      <div className="card-surface overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">{t("food")}</th>
              <th className="px-3 py-2 font-medium">{t("portion")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("kcal")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("protein")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("carbs")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("fat")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("fibre")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {results.map((f, i) => {
              const isCopied = copied.has(normalizeSearch(f.name));
              return (
                <tr key={`${f.name}-${i}`} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <p className="font-medium">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{f.group}</p>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {f.portion}
                    {f.qtyG ? ` · ${f.qtyG}g` : ""}
                  </td>
                  <td className="px-3 py-2 text-right font-medium lining-nums tabular-nums">{fmt(f.kcal)}</td>
                  <td className="px-3 py-2 text-right lining-nums tabular-nums">{fmt(f.protein)}</td>
                  <td className="px-3 py-2 text-right lining-nums tabular-nums">{fmt(f.carbs)}</td>
                  <td className="px-3 py-2 text-right lining-nums tabular-nums">{fmt(f.fat)}</td>
                  <td className="px-3 py-2 text-right lining-nums tabular-nums">{fmt(f.fibre)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => copy(f)}
                      disabled={isCopied}
                      title={isCopied ? tn("inMyFoods") : tn("addToMyFoods")}
                      aria-label={isCopied ? tn("inMyFoods") : tn("addToMyFoods")}
                      className="rounded p-1 text-muted-foreground hover:bg-brand-50 hover:text-brand disabled:text-brand"
                    >
                      {isCopied ? <Check className="size-4" /> : <Plus className="size-4" />}
                    </button>
                  </td>
                </tr>
              );
            })}
            {results.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
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
