"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { updateAppearanceAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFeedback } from "@/components/ui/feedback";
import { Label } from "@/components/ui/input";
import { Segmented } from "@/components/ui/tabs";
import {
  BRAND_PRESETS,
  CORNER_STYLES,
  DEFAULT_APPEARANCE,
  HEADING_FONTS,
  themeCss,
  type Appearance,
  type AppearanceMode,
} from "@/lib/theme";

const MODE_ICONS: Record<AppearanceMode, React.ReactNode> = {
  light: <Sun className="size-4" />,
  dark: <Moon className="size-4" />,
  system: <Monitor className="size-4" />,
};

export function AppearanceSettings({ appearance }: { appearance: Appearance }) {
  const t = useTranslations("settings.appearance");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useFeedback();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(appearance);
  const [draft, setDraft] = useState(appearance);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (patch: Partial<Appearance>) => setDraft((d) => ({ ...d, ...patch }));

  function save() {
    start(async () => {
      try {
        const next = await updateAppearanceAction(locale, draft);
        setSaved(next);
        setDraft(next);
        toast(tc("saved"));
        router.refresh();
      } catch {
        toast(tc("error"), "error");
      }
    });
  }

  return (
    <Card>
      {/* Live preview: later in the document than the saved theme, so it wins. */}
      {dirty && <style>{themeCss(draft)}</style>}
      <CardHeader>
        <CardTitle className="text-lg">{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>{t("mode")}</Label>
          <Segmented
            size="sm"
            value={draft.mode}
            onChange={(mode) => set({ mode })}
            items={(["light", "dark", "system"] as const).map((m) => ({ value: m, label: t(`modes.${m}`), icon: MODE_ICONS[m] }))}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("brandColor")}</Label>
          <div className="flex flex-wrap items-center gap-2">
            {BRAND_PRESETS.map((p) => {
              const active = draft.brandColor.toUpperCase() === p.hex;
              return (
                <button
                  key={p.id}
                  type="button"
                  title={t(`colors.${p.id}`)}
                  aria-label={t(`colors.${p.id}`)}
                  aria-pressed={active}
                  onClick={() => set({ brandColor: p.hex })}
                  style={{ backgroundColor: p.hex }}
                  className="flex size-8 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-card transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:ring-2 aria-pressed:ring-foreground"
                >
                  {active && <Check className="size-4" />}
                </button>
              );
            })}
            <label className="ml-1 flex h-8 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-2 text-xs text-muted-foreground">
              <input
                type="color"
                value={draft.brandColor}
                onChange={(e) => set({ brandColor: e.target.value.toUpperCase() })}
                className="size-5 cursor-pointer border-0 bg-transparent p-0"
                aria-label={t("customColor")}
              />
              {t("customColor")}
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">{t("brandColorHint")}</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("corners")}</Label>
            <Segmented
              size="sm"
              value={draft.corners}
              onChange={(corners) => set({ corners })}
              items={CORNER_STYLES.map((c) => ({ value: c, label: t(`cornerStyles.${c}`) }))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("headingFont")}</Label>
            <Segmented
              size="sm"
              value={draft.headingFont}
              onChange={(headingFont) => set({ headingFont })}
              items={HEADING_FONTS.map((f) => ({ value: f, label: t(`headingFonts.${f}`) }))}
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" disabled={pending} onClick={() => setDraft(DEFAULT_APPEARANCE)}>
            {t("reset")}
          </Button>
          <Button disabled={!dirty} loading={pending} onClick={save}>
            {tc("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
