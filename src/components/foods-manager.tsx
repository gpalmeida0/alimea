"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Apple, Archive, ArchiveRestore, Pencil, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, NumberInput, Select } from "@/components/ui/input";
import { Badge, EmptyState } from "@/components/ui/misc";
import { useServerAction } from "@/hooks/use-server-action";
import { archiveFoodAction, saveFoodAction } from "@/app/actions";
import type { DbFood } from "@/lib/types";
import { formatNumber, normalizeSearch } from "@/lib/utils";

type FormState = {
  id?: string;
  name: string;
  brand: string;
  category: string;
  baseUnit: "g" | "mL";
  refQty?: number;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

const blank: FormState = { name: "", brand: "", category: "", baseUnit: "g", refQty: 100 };

export function FoodsManager({ foods }: { foods: DbFood[] }) {
  const t = useTranslations("nutrition");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { run, pending } = useServerAction();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<FormState | null>(null);

  const categories = useMemo(() => [...new Set(foods.map((f) => f.category).filter(Boolean) as string[])].sort(), [foods]);
  const filtered = useMemo(() => {
    const nq = normalizeSearch(q.trim());
    return foods.filter(
      (f) =>
        (showArchived || !f.archived) &&
        (!category || f.category === category) &&
        (!nq || normalizeSearch(`${f.name} ${f.brand ?? ""} ${f.category ?? ""}`).includes(nq)),
    );
  }, [foods, q, category, showArchived]);

  // Kcal implied by the macros (4/4/9) — flags likely typos.
  const kcalMismatch = (f: FormState) => {
    if (f.kcal == null || (!f.protein && !f.carbs && !f.fat)) return false;
    const est = (f.protein ?? 0) * 4 + (f.carbs ?? 0) * 4 + (f.fat ?? 0) * 9;
    return est > 0 && Math.abs(est - f.kcal) / Math.max(est, f.kcal) > 0.25;
  };

  function submit() {
    if (!editing?.name.trim()) return;
    run(
      () =>
        saveFoodAction(locale, {
          id: editing.id,
          name: editing.name.trim(),
          brand: editing.brand.trim() || undefined,
          category: editing.category.trim() || undefined,
          baseUnit: editing.baseUnit,
          refQty: editing.refQty || 100,
          kcal: editing.kcal ?? 0,
          protein: editing.protein ?? 0,
          carbs: editing.carbs ?? 0,
          fat: editing.fat ?? 0,
        }),
      { success: tc("saved"), onDone: () => setEditing(null) },
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchFood")} className="pl-9" aria-label={t("searchFood")} />
        </div>
        {categories.length > 0 && (
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-48" aria-label={t("category")}>
            <option value="">{t("allCategories")}</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        )}
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="size-4 accent-brand" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          {t("showArchived")}
        </label>
        <Button onClick={() => setEditing({ ...blank })}>
          <Plus /> {t("addFood")}
        </Button>
      </div>

      {foods.length === 0 ? (
        <EmptyState icon={<Apple />} title={t("noFoods")} description={t("noFoodsHint")} />
      ) : (
        <div className="card-surface overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("name")}</th>
                <th className="px-3 py-2 font-medium">{t("category")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("refQty")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("kcal")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("protein")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("carbs")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("fat")}</th>
                <th className="px-3 py-2 text-right font-medium">
                  <span className="sr-only">{tc("actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.id} className={`border-b border-border/60 last:border-0 hover:bg-muted/30 ${f.archived ? "opacity-50" : ""}`}>
                  <td className="px-3 py-2">
                    <p className="font-medium">
                      {f.name} {f.archived && <Badge variant="muted">{t("archived")}</Badge>}
                    </p>
                    {f.brand && <p className="text-xs text-muted-foreground">{f.brand}</p>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{f.category ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {f.refQty}
                    {f.baseUnit}
                  </td>
                  <td className="px-3 py-2 text-right font-medium lining-nums tabular-nums">{formatNumber(f.kcal, locale)}</td>
                  <td className="px-3 py-2 text-right lining-nums tabular-nums">{formatNumber(f.protein, locale)}</td>
                  <td className="px-3 py-2 text-right lining-nums tabular-nums">{formatNumber(f.carbs, locale)}</td>
                  <td className="px-3 py-2 text-right lining-nums tabular-nums">{formatNumber(f.fat, locale)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={tc("edit")}
                        onClick={() =>
                          setEditing({
                            id: f.id,
                            name: f.name,
                            brand: f.brand ?? "",
                            category: f.category ?? "",
                            baseUnit: f.baseUnit,
                            refQty: f.refQty,
                            kcal: f.kcal,
                            protein: f.protein,
                            carbs: f.carbs,
                            fat: f.fat,
                          })
                        }
                      >
                        <Pencil className="text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={pending}
                        aria-label={f.archived ? t("unarchive") : t("archive")}
                        title={f.archived ? t("unarchive") : t("archive")}
                        onClick={() => run(() => archiveFoodAction(locale, f.id, !f.archived))}
                      >
                        {f.archived ? <ArchiveRestore className="text-muted-foreground" /> : <Archive className="text-muted-foreground" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    {t("noMatches")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Dialog title={editing.id ? t("editFood") : t("addFood")} onClose={() => setEditing(null)}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Field label={t("name")} htmlFor="f-name">
              <Input id="f-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("brand")} htmlFor="f-brand">
                <Input id="f-brand" value={editing.brand} onChange={(e) => setEditing({ ...editing, brand: e.target.value })} />
              </Field>
              <Field label={t("category")} htmlFor="f-cat">
                <Input id="f-cat" list="food-categories" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
                <datalist id="food-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label={t("baseUnit")} htmlFor="f-unit">
                <Select id="f-unit" value={editing.baseUnit} onChange={(e) => setEditing({ ...editing, baseUnit: e.target.value as "g" | "mL" })}>
                  <option value="g">{t("gram")}</option>
                  <option value="mL">{t("ml")}</option>
                </Select>
              </Field>
              <Field label={t("refQty")} htmlFor="f-ref">
                <NumberInput id="f-ref" value={editing.refQty} onValueChange={(v) => setEditing({ ...editing, refQty: v })} min={0} />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">{t("perRef", { qty: editing.refQty || 100, unit: editing.baseUnit })}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["kcal", "protein", "carbs", "fat"] as const).map((k) => (
                <Field key={k} label={t(k)} htmlFor={`f-${k}`}>
                  <NumberInput id={`f-${k}`} value={editing[k]} onValueChange={(v) => setEditing({ ...editing, [k]: v })} min={0} />
                </Field>
              ))}
            </div>
            {kcalMismatch(editing) && <p className="text-xs text-accent-700">{t("kcalMismatch")}</p>}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" loading={pending} disabled={!editing.name.trim()}>
                {tc("save")}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}
    </div>
  );
}
