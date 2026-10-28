"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeftRight, Check, Copy, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback";
import { Label } from "@/components/ui/input";
import { Segmented } from "@/components/ui/tabs";
import { FOODS } from "@/lib/nutrition/foods";
import { formatItem, itemTotals } from "@/lib/nutrition/items";
import { formatQuantity, shoppingList, shoppingListText } from "@/lib/nutrition/shopping-list";
import { candidatePool, findSubstitutes, substituteToItem, type Substitute } from "@/lib/nutrition/substitutes";
import type { DbFood, FoodItem, Meal, Recipe } from "@/lib/types";
import { cn } from "@/lib/utils";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Equivalent foods for one plan item: same energy, similar macros. */
export function SubstituteDialog({
  item,
  dbFoods,
  onReplace,
  onClose,
}: {
  item: FoodItem;
  dbFoods: DbFood[];
  onReplace: (next: FoodItem) => void;
  onClose: () => void;
}) {
  const t = useTranslations("plan.swap");
  const tp = useTranslations("plan");
  const tc = useTranslations("common");
  const { toast } = useFeedback();
  const substitutes = useMemo(() => findSubstitutes(item, candidatePool(dbFoods, FOODS)), [item, dbFoods]);
  const original = itemTotals(item);
  const line = (s: Substitute) => formatItem(substituteToItem(item, s), tp("portion"));
  const signed = (v: number) => {
    const r = Math.round(v) || 0; // no "+0" or "-0"
    return `${r > 0 ? "+" : ""}${r}`;
  };

  return (
    <Dialog title={t("title")} description={t("subtitle")} onClose={onClose}>
      <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
        <p className="font-medium">{formatItem(item, tp("portion"))}</p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {Math.round(original.kcal)} kcal · P {Math.round(original.protein)}g · HC {Math.round(original.carbs)}g · G {Math.round(original.fat)}g
        </p>
      </div>

      {substitutes.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t(item.kind === "recipe" ? "noneRecipe" : "none")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {substitutes.map((s) => (
            <li key={`${s.candidate.refId ?? ""}${s.candidate.name}`} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{line(s)}</p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {Math.round(s.totals.kcal)} kcal · P {signed(s.delta.protein)}g · HC {signed(s.delta.carbs)}g · G {signed(s.delta.fat)}g
                  {s.candidate.group ? ` · ${s.candidate.group}` : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onReplace(substituteToItem(item, s));
                  onClose();
                }}
              >
                <ArrowLeftRight /> {t("replace")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <DialogFooter>
        {substitutes.length > 0 && (
          <Button
            variant="ghost"
            onClick={async () => {
              const text = `${t("copyHeading", { food: formatItem(item, tp("portion")) })}\n${substitutes.map((s) => `• ${line(s)}`).join("\n")}`;
              const ok = await copyText(text);
              toast(ok ? t("copied") : tc("error"), ok ? undefined : "error");
            }}
          >
            <Copy /> {t("copy")}
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>
          {tc("close")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

const DAY_CHOICES = ["1", "7", "14"] as const;

/** Everything the plan needs for a number of days, grouped and ready to send. */
export function ShoppingListDialog({
  meals,
  dbFoods,
  recipes,
  onClose,
}: {
  meals: Meal[];
  dbFoods: DbFood[];
  recipes: Recipe[];
  onClose: () => void;
}) {
  const t = useTranslations("plan.shopping");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useFeedback();
  const [days, setDays] = useState<(typeof DAY_CHOICES)[number]>("7");
  const [scope, setScope] = useState<"first" | "all">("first");
  const [done, setDone] = useState<Set<string>>(new Set());
  const hasAlternatives = meals.some((m) => m.options.filter((o) => o.items?.length).length > 1);

  const groups = useMemo(
    () => shoppingList(meals, { days: Number(days), scope, dbFoods, recipes, staticFoods: FOODS }),
    [meals, days, scope, dbFoods, recipes],
  );
  const portionWord = (count: number) => t("portions", { count });
  const text = () => shoppingListText(groups, { title: t("textTitle", { count: Number(days) }), otherGroup: t("other"), locale, portionWord });
  const toggle = (key: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  function print() {
    const w = window.open("", "_blank", "width=640,height=800");
    if (!w) return toast(tc("error"), "error");
    const pre = w.document.createElement("pre");
    pre.style.cssText = "font: 14px/1.6 system-ui, sans-serif; white-space: pre-wrap; margin: 32px;";
    pre.textContent = text();
    w.document.title = t("title");
    w.document.body.appendChild(pre);
    w.print();
  }

  return (
    <Dialog title={t("title")} description={t("subtitle")} onClose={onClose} size="lg">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label>{t("period")}</Label>
          <Segmented size="sm" value={days} onChange={setDays} items={DAY_CHOICES.map((d) => ({ value: d, label: t("days", { count: Number(d) }) }))} />
        </div>
        {hasAlternatives && (
          <div className="space-y-1.5">
            <Label>{t("options")}</Label>
            <Segmented
              size="sm"
              value={scope}
              onChange={setScope}
              items={[
                { value: "first", label: t("firstOption") },
                { value: "all", label: t("allOptions") },
              ]}
            />
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="mt-4 max-h-[50vh] space-y-4 overflow-y-auto pr-1 scroll-thin">
          {groups.map((g) => (
            <section key={g.group}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.group || t("other")}</h3>
              <ul className="divide-y divide-border rounded-md border border-border">
                {g.lines.map((l) => {
                  const key = `${l.name}|${l.unit}`;
                  const checked = done.has(key);
                  return (
                    <li key={key}>
                      <button type="button" onClick={() => toggle(key)} aria-pressed={checked} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50">
                        <span className={cn("flex size-4 shrink-0 items-center justify-center rounded border", checked ? "border-brand bg-brand text-primary-foreground" : "border-muted-foreground/40")}>
                          {checked && <Check className="size-3" />}
                        </span>
                        <span className={cn("min-w-0 flex-1 truncate", checked && "text-muted-foreground line-through")}>{l.name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{formatQuantity(l.qty, l.unit, locale, portionWord)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">{t("hint")}</p>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          {tc("close")}
        </Button>
        <Button variant="outline" disabled={!groups.length} onClick={print}>
          <Printer /> {t("print")}
        </Button>
        <Button disabled={!groups.length} onClick={async () => {
            const ok = await copyText(text());
            toast(ok ? t("copied") : tc("error"), ok ? undefined : "error");
          }}>
          <Copy /> {t("copy")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
