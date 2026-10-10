"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LayoutTemplate, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge, EmptyState } from "@/components/ui/misc";
import { useServerAction } from "@/hooks/use-server-action";
import { deleteTemplateAction, saveAsTemplateAction, updateTemplateAction } from "@/app/actions";
import type { Meal, PlanLanguage, PlanTemplate } from "@/lib/types";
import { newId } from "@/lib/utils";

type Draft = { id?: string; name: string; language: PlanLanguage; meals: Meal[]; supplementation: string; notes: string };

const emptyMeal = (): Meal => ({ id: newId("meal"), name: "", options: [{ id: newId("opt"), content: "" }] });

export function TemplatesManager({ templates }: { templates: PlanTemplate[] }) {
  const t = useTranslations("templates");
  const tp = useTranslations("plan");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { confirm } = useFeedback();
  const { run, pending } = useServerAction();
  const [draft, setDraft] = useState<Draft | null>(null);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("createHint")}</p>
        <Button onClick={() => setDraft({ name: "", language: "pt-PT", meals: [emptyMeal()], supplementation: "", notes: "" })}>
          <Plus /> {t("new")}
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState icon={<LayoutTemplate />} title={t("noItems")} description={t("emptyHint")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 pt-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="flex min-w-0 items-center gap-2 font-serif text-lg font-semibold">
                    <LayoutTemplate className="size-4 shrink-0 text-brand" /> <span className="truncate">{tpl.name}</span>
                  </h3>
                  <Badge variant="muted">{tpl.language === "en" ? "EN" : "PT"}</Badge>
                </div>
                <ol className="flex-1 space-y-1 text-sm text-muted-foreground">
                  {tpl.meals.length === 0 && <li className="italic">{tp("emptyMeals")}</li>}
                  {tpl.meals.slice(0, 6).map((m) => (
                    <li key={m.id} className="flex justify-between gap-2">
                      <span className="truncate">{m.name || "—"}</span>
                      {m.options.length > 1 && <span className="shrink-0 text-xs">{t("optionsCount", { n: m.options.length })}</span>}
                    </li>
                  ))}
                </ol>
                <div className="flex justify-end gap-1 border-t border-border pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setDraft({
                        id: tpl.id,
                        name: tpl.name,
                        language: tpl.language,
                        meals: tpl.meals.length ? tpl.meals : [emptyMeal()],
                        supplementation: tpl.supplementation ?? "",
                        notes: tpl.notes ?? "",
                      })
                    }
                  >
                    <Pencil /> {tc("edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={async () => {
                      if (await confirm({ title: t("deleteTitle", { name: tpl.name }), destructive: true })) {
                        run(() => deleteTemplateAction(locale, tpl.id), { success: tc("deleted") });
                      }
                    }}
                  >
                    <Trash2 /> {tc("delete")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {draft && (
        <TemplateDialog
          draft={draft}
          setDraft={setDraft}
          pending={pending}
          onClose={() => setDraft(null)}
          onSave={() => {
            const data = {
              name: draft.name,
              language: draft.language,
              meals: draft.meals.filter((m) => m.name.trim() || m.options.some((o) => o.content.trim() || o.items?.length)),
              supplementation: draft.supplementation,
              notes: draft.notes,
            };
            run(() => (draft.id ? updateTemplateAction(locale, draft.id, data) : saveAsTemplateAction(locale, data)), {
              success: tc("saved"),
              onDone: () => setDraft(null),
            });
          }}
        />
      )}
    </div>
  );
}

function TemplateDialog({
  draft,
  setDraft,
  onSave,
  onClose,
  pending,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSave: () => void;
  onClose: () => void;
  pending: boolean;
}) {
  const t = useTranslations("templates");
  const tp = useTranslations("plan");
  const tc = useTranslations("common");
  const setMeal = (id: string, fn: (m: Meal) => Meal) => setDraft({ ...draft, meals: draft.meals.map((m) => (m.id === id ? fn(m) : m)) });

  return (
    <Dialog title={draft.id ? t("edit") : t("new")} onClose={onClose} size="lg">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.name.trim()) onSave();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <Field label={t("name")} htmlFor="tpl-name">
            <Input id="tpl-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required maxLength={200} />
          </Field>
          <Field label={tp("planLanguage")} htmlFor="tpl-lang">
            <Select id="tpl-lang" value={draft.language} onChange={(e) => setDraft({ ...draft, language: e.target.value as PlanLanguage })}>
              <option value="pt-PT">Português</option>
              <option value="en">English</option>
            </Select>
          </Field>
        </div>

        <div className="space-y-2">
          <Label>{tp("meals")}</Label>
          {draft.meals.map((m) => (
            <div key={m.id} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={m.name}
                  onChange={(e) => setMeal(m.id, (x) => ({ ...x, name: e.target.value }))}
                  placeholder={tp("addMealPlaceholder")}
                  className="h-8 flex-1 font-medium"
                  aria-label={tp("mealName")}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDraft({ ...draft, meals: draft.meals.filter((x) => x.id !== m.id) })}
                  aria-label={tc("delete")}
                >
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </div>
              {m.options.map((o, i) => (
                <div key={o.id} className="flex items-start gap-2">
                  {m.options.length > 1 && <span className="mt-2 w-14 shrink-0 text-[11px] font-semibold uppercase text-brand">{tp("option", { n: i + 1 })}</span>}
                  <Textarea
                    value={o.content}
                    onChange={(e) =>
                      setMeal(m.id, (x) => ({ ...x, options: x.options.map((oo) => (oo.id === o.id ? { ...oo, content: e.target.value } : oo)) }))
                    }
                    placeholder={tp("optionPlaceholder")}
                    rows={2}
                    className="min-h-0 flex-1"
                    aria-label={tp("option", { n: i + 1 })}
                  />
                  {m.options.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setMeal(m.id, (x) => ({ ...x, options: x.options.filter((oo) => oo.id !== o.id) }))}
                      className="mt-2 text-muted-foreground hover:text-destructive"
                      aria-label={tc("remove")}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMeal(m.id, (x) => ({ ...x, options: [...x.options, { id: newId("opt"), content: "" }] }))}
              >
                <Plus /> {tp("addOption")}
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={() => setDraft({ ...draft, meals: [...draft.meals, emptyMeal()] })}>
            <Plus /> {tp("addMeal")}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tp("supplementation")} htmlFor="tpl-supp">
            <Textarea id="tpl-supp" value={draft.supplementation} onChange={(e) => setDraft({ ...draft, supplementation: e.target.value })} rows={3} />
          </Field>
          <Field label={tp("notes")} htmlFor="tpl-notes">
            <Textarea id="tpl-notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={3} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" loading={pending} disabled={!draft.name.trim()}>
            {tc("save")}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
