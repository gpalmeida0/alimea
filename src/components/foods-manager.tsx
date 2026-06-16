"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Pencil, Search, X, Loader2, Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { archiveFoodAction, saveFoodAction } from "@/app/actions";
import type { DbFood } from "@/lib/types";
import { useRouter } from "next/navigation";

type FormState = {
  id?: string;
  name: string;
  brand: string;
  category: string;
  baseUnit: "g" | "mL";
  refQty: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

const blank: FormState = {
  name: "",
  brand: "",
  category: "",
  baseUnit: "g",
  refQty: 100,
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

export function FoodsManager({ foods }: { foods: DbFood[] }) {
  const t = useTranslations("nutrition");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const norm = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const nq = norm(q.trim());
    return foods
      .filter((f) => (showArchived ? true : !f.archived))
      .filter((f) => !nq || norm(f.name).includes(nq) || norm(f.category ?? "").includes(nq));
  }, [foods, q, showArchived]);

  function openNew() {
    setEditing({ ...blank });
  }
  function openEdit(f: DbFood) {
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
    });
  }

  function submit() {
    if (!editing || !editing.name.trim()) return;
    start(async () => {
      await saveFoodAction(locale, {
        id: editing.id,
        name: editing.name.trim(),
        brand: editing.brand || undefined,
        category: editing.category || undefined,
        baseUnit: editing.baseUnit,
        refQty: editing.refQty || 100,
        kcal: editing.kcal || 0,
        protein: editing.protein || 0,
        carbs: editing.carbs || 0,
        fat: editing.fat || 0,
      });
      setEditing(null);
      router.refresh();
    });
  }

  function toggleArchive(f: DbFood) {
    start(async () => {
      await archiveFoodAction(locale, f.id, !f.archived);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchFood")} className="pl-9" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          {t("showArchived")}
        </label>
        <Button onClick={openNew}>
          <Plus /> {t("addFood")}
        </Button>
      </div>

      <div className="card-surface overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">{t("name")}</th>
              <th className="px-3 py-2 font-medium">{t("category")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("refQty")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("kcal")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("protein")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("carbs")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("fat")}</th>
              <th className="px-3 py-2 text-right font-medium">{tc("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.id} className={`border-b border-border/60 last:border-0 hover:bg-muted/30 ${f.archived ? "opacity-50" : ""}`}>
                <td className="px-3 py-2">
                  <p className="font-medium">{f.name}</p>
                  {f.brand && <p className="text-xs text-muted-foreground">{f.brand}</p>}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{f.category ?? "—"}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {f.refQty}{f.baseUnit}
                </td>
                <td className="px-3 py-2 text-right font-medium">{f.kcal}</td>
                <td className="px-3 py-2 text-right">{f.protein}</td>
                <td className="px-3 py-2 text-right">{f.carbs}</td>
                <td className="px-3 py-2 text-right">{f.fat}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(f)} className="rounded p-1 text-muted-foreground hover:text-foreground" title={tc("edit")}>
                      <Pencil className="size-4" />
                    </button>
                    <button onClick={() => toggleArchive(f)} className="rounded p-1 text-muted-foreground hover:text-foreground" title={f.archived ? t("unarchive") : t("archive")}>
                      {f.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  {t("noFoods")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold">{editing.id ? t("editFood") : t("addFood")}</h3>
              <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t("name")}</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("brand")}</Label>
                  <Input value={editing.brand} onChange={(e) => setEditing({ ...editing, brand: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("category")}</Label>
                  <Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("baseUnit")}</Label>
                  <select
                    value={editing.baseUnit}
                    onChange={(e) => setEditing({ ...editing, baseUnit: e.target.value as "g" | "mL" })}
                    className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                  >
                    <option value="g">{t("gram")}</option>
                    <option value="mL">{t("ml")}</option>
                  </select>
                </div>
                <NumberField label={t("refQty")} value={editing.refQty} onChange={(v) => setEditing({ ...editing, refQty: v })} />
              </div>
              <p className="text-xs text-muted-foreground">{t("perRef", { qty: editing.refQty || 100, unit: editing.baseUnit })}</p>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label={t("kcal")} value={editing.kcal} onChange={(v) => setEditing({ ...editing, kcal: v })} />
                <NumberField label={t("protein")} value={editing.protein} onChange={(v) => setEditing({ ...editing, protein: v })} />
                <NumberField label={t("carbs")} value={editing.carbs} onChange={(v) => setEditing({ ...editing, carbs: v })} />
                <NumberField label={t("fat")} value={editing.fat} onChange={(v) => setEditing({ ...editing, fat: v })} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  {tc("cancel")}
                </Button>
                <Button onClick={submit} disabled={pending || !editing.name.trim()}>
                  {pending ? <Loader2 className="animate-spin" /> : null} {tc("save")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px]">{label}</Label>
      <Input
        type="number"
        step="0.1"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className="h-9"
      />
    </div>
  );
}
