"use client";

import { useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileText, Trash2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { useServerAction } from "@/hooks/use-server-action";
import { deletePdfTemplateAction, uploadPdfTemplateAction } from "@/app/actions";

export function PdfTemplatesManager({ templates }: { templates: { id: string; name: string; url: string }[] }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast, confirm } = useFeedback();
  const { run, pending } = useServerAction();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("pdfTemplatesTitle")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("pdfTemplatesHint")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {templates.length > 0 && (
          <ul className="space-y-2">
            {templates.map((tpl) => (
              <li key={tpl.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <a href={tpl.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-sm hover:underline">
                  <FileText className="size-4 shrink-0 text-brand" /> <span className="truncate">{tpl.name}</span>
                </a>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={tc("delete")}
                  onClick={async () => {
                    if (await confirm({ title: t("deleteTemplateTitle", { name: tpl.name }), body: t("deleteTemplateBody"), destructive: true })) {
                      run(() => deletePdfTemplateAction(locale, tpl.id), { success: tc("deleted") });
                    }
                  }}
                >
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => uploadPdfTemplateAction(locale, fd), {
              onDone: (res) => {
                if (!res) return;
                if (!res.ok) return toast(t(`errors.${res.error}`), "error");
                formRef.current?.reset();
                toast(t("templateUploaded"));
              },
            });
          }}
          className="grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <Field label={t("pdfTemplateName")} htmlFor="tplname">
            <Input id="tplname" name="name" placeholder={t("pdfTemplateNamePlaceholder")} />
          </Field>
          <Field label="PDF" htmlFor="tplfile">
            <Input
              id="tplfile"
              name="file"
              type="file"
              accept="application/pdf"
              required
              className="cursor-pointer py-1.5 file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:text-xs"
            />
          </Field>
          <Button type="submit" loading={pending}>
            <Upload /> {t("uploadTemplate")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
