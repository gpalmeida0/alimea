"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Languages, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge, EmptyState } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/tabs";
import { useServerAction } from "@/hooks/use-server-action";
import { deleteRecommendationAction, saveRecommendationAction } from "@/app/actions";
import type { Recommendation, RecommendationCategory } from "@/lib/types";

const CATEGORIES: RecommendationCategory[] = ["hydration", "behavior", "supplementation", "restrictions", "general"];
type Draft = { id?: string; title: string; category: RecommendationCategory; pt: string; en: string };

export function RecommendationsManager({ items }: { items: Recommendation[] }) {
  const t = useTranslations("recommendations");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { confirm } = useFeedback();
  const { run, pending } = useServerAction();
  const [filter, setFilter] = useState<"all" | RecommendationCategory>("all");
  const [draft, setDraft] = useState<Draft | null>(null);

  const visible = items.filter((r) => filter === "all" || r.category === filter);
  const used = new Set(items.map((r) => r.category));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          size="sm"
          items={[
            { value: "all" as const, label: tc("all") },
            ...CATEGORIES.filter((c) => used.has(c)).map((c) => ({ value: c, label: t(`categories.${c}`) })),
          ]}
        />
        <Button onClick={() => setDraft({ title: "", category: "general", pt: "", en: "" })}>
          <Plus /> {t("new")}
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={<Sparkles />} title={t("noItems")} description={t("hint")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-2 pt-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-serif text-lg font-semibold">{r.title}</h3>
                    <Badge variant="muted">{t(`categories.${r.category}`)}</Badge>
                  </div>
                  <div className="flex shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={tc("edit")}
                      onClick={() => setDraft({ id: r.id, title: r.title, category: r.category, pt: r.content["pt-PT"], en: r.content.en })}
                    >
                      <Pencil className="text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={tc("delete")}
                      onClick={async () => {
                        if (await confirm({ title: t("deleteTitle", { title: r.title }), destructive: true })) {
                          run(() => deleteRecommendationAction(locale, r.id), { success: tc("deleted") });
                        }
                      }}
                    >
                      <Trash2 className="text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm">
                  <span className="mr-1.5 text-[10px] font-semibold text-muted-foreground">PT</span>
                  {r.content["pt-PT"] || <span className="italic text-muted-foreground">—</span>}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="mr-1.5 text-[10px] font-semibold">EN</span>
                  {r.content.en || <span className="italic">{t("missingTranslation")}</span>}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {draft && (
        <RecommendationDialog
          draft={draft}
          setDraft={setDraft}
          pending={pending}
          onClose={() => setDraft(null)}
          onSave={() =>
            run(
              () =>
                saveRecommendationAction(locale, {
                  id: draft.id,
                  title: draft.title,
                  category: draft.category,
                  content: { "pt-PT": draft.pt, en: draft.en },
                }),
              { success: tc("saved"), onDone: () => setDraft(null) },
            )
          }
        />
      )}
    </div>
  );
}

function RecommendationDialog({
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
  const t = useTranslations("recommendations");
  const tc = useTranslations("common");
  const tai = useTranslations("ai");
  const { toast } = useFeedback();
  const [translating, setTranslating] = useState(false);

  async function translate() {
    setTranslating(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "translate", text: draft.pt, targetLanguage: "en" }),
      });
      const data = (await res.json()) as { result?: string; configured?: boolean };
      if (!res.ok) throw new Error();
      if (data.configured === false) toast(tai("notConfigured"), "error");
      else setDraft({ ...draft, en: data.result ?? draft.en });
    } catch {
      toast(tai("failed"), "error");
    } finally {
      setTranslating(false);
    }
  }

  return (
    <Dialog title={draft.id ? t("edit") : t("new")} onClose={onClose} size="lg">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.title.trim()) onSave();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <Field label={t("titleLabel")} htmlFor="rec-title">
            <Input id="rec-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required maxLength={200} />
          </Field>
          <Field label={t("category")} htmlFor="rec-cat">
            <Select id="rec-cat" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as RecommendationCategory })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`categories.${c}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={`${t("content")} · Português`} htmlFor="rec-pt">
          <Textarea id="rec-pt" value={draft.pt} onChange={(e) => setDraft({ ...draft, pt: e.target.value })} rows={3} />
        </Field>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="rec-en" className="text-xs font-medium text-muted-foreground">
              {t("content")} · English
            </label>
            <Button variant="link" size="sm" className="text-xs" onClick={translate} loading={translating} disabled={!draft.pt.trim()}>
              <Languages /> {t("translateFromPt")}
            </Button>
          </div>
          <Textarea id="rec-en" value={draft.en} onChange={(e) => setDraft({ ...draft, en: e.target.value })} rows={3} />
        </div>
        <p className="text-[11px] text-muted-foreground">{t("usageHint")}</p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" loading={pending} disabled={!draft.title.trim()}>
            {tc("save")}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
