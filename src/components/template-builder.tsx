"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Trash2, Loader2, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { saveAsTemplateAction } from "@/app/actions";
import type { Meal, PlanLanguage } from "@/lib/types";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

interface DraftMeal {
  id: string;
  name: string;
  content: string;
}

/**
 * Full template creation: not just a name, but language, the meal blocks,
 * supplementation and notes — so a model can be reused as a real starting point.
 */
export function TemplateBuilder() {
  const t = useTranslations("templates");
  const tp = useTranslations("plan");
  const tcom = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState("");
  const [language, setLanguage] = useState<PlanLanguage>("pt-PT");
  const [supplementation, setSupplementation] = useState("");
  const [notes, setNotes] = useState("");
  const [meals, setMeals] = useState<DraftMeal[]>([{ id: uid(), name: "", content: "" }]);

  const addMeal = () => setMeals((m) => [...m, { id: uid(), name: "", content: "" }]);
  const removeMeal = (id: string) => setMeals((m) => m.filter((x) => x.id !== id));
  const patchMeal = (id: string, patch: Partial<DraftMeal>) =>
    setMeals((m) => m.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const builtMeals: Meal[] = meals
      .filter((m) => m.name.trim() || m.content.trim())
      .map((m) => ({
        id: uid(),
        name: m.name.trim(),
        options: [{ id: uid(), content: m.content.trim() }],
      }));
    start(async () => {
      await saveAsTemplateAction(locale, {
        name: name.trim(),
        language,
        meals: builtMeals,
        supplementation: supplementation.trim(),
        notes: notes.trim(),
      });
      router.refresh();
      setName("");
      setSupplementation("");
      setNotes("");
      setMeals([{ id: uid(), name: "", content: "" }]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <Card className="h-fit">
      <CardContent className="pt-5">
        <h3 className="mb-3 font-serif text-lg font-semibold">{t("new")}</h3>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">{t("title")}</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-language">{tp("planLanguage")}</Label>
            <select
              id="tpl-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as PlanLanguage)}
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
            >
              <option value="pt-PT">Português</option>
              <option value="en">English</option>
            </select>
          </div>

          {/* Meal blocks */}
          <div className="space-y-2">
            <Label>{tp("meals")}</Label>
            {meals.map((m, i) => (
              <div key={m.id} className="space-y-1.5 rounded-md border border-border p-2.5">
                <div className="flex items-center gap-2">
                  <Input
                    value={m.name}
                    onChange={(e) => patchMeal(m.id, { name: e.target.value })}
                    placeholder={tp("addMealPlaceholder")}
                    className="h-8 flex-1"
                  />
                  {meals.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMeal(m.id)}
                      aria-label={tcom("delete")}
                    >
                      <Trash2 className="text-muted-foreground" />
                    </Button>
                  )}
                </div>
                <Textarea
                  value={m.content}
                  onChange={(e) => patchMeal(m.id, { content: e.target.value })}
                  placeholder={tp("optionPlaceholder")}
                  rows={2}
                />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addMeal} className="w-full">
              <Plus /> {tp("addMeal")}
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-supp">{tp("supplementation")}</Label>
            <Textarea
              id="tpl-supp"
              value={supplementation}
              onChange={(e) => setSupplementation(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-notes">{tp("notes")}</Label>
            <Textarea
              id="tpl-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : saved ? <Check /> : null}
            {saved ? tcom("saved") : tcom("save")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("createHint")}</p>
        </form>
      </CardContent>
    </Card>
  );
}
