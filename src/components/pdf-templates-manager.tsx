"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { FileText, Trash2, Upload, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { deletePdfTemplateAction, uploadPdfTemplateAction } from "@/app/actions";

export function PdfTemplatesManager({
  templates,
}: {
  templates: { id: string; name: string; storagePath: string }[];
}) {
  const t = useTranslations("settings");
  const tcom = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>{t("pdfTemplatesTitle")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("pdfTemplatesHint")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {templates.length > 0 && (
          <ul className="space-y-2">
            {templates.map((tpl) => (
              <li
                key={tpl.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <a
                  href={tpl.storagePath}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm hover:underline"
                >
                  <FileText className="size-4 text-brand" /> {tpl.name}
                </a>
                <button
                  onClick={() =>
                    start(async () => {
                      await deletePdfTemplateAction(locale, tpl.id);
                      router.refresh();
                    })
                  }
                  disabled={pending}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                  aria-label={tcom("delete")}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              await uploadPdfTemplateAction(locale, fd);
              formRef.current?.reset();
              router.refresh();
            });
          }}
          className="space-y-3 border-t border-border pt-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="tplname">{t("pdfTemplateName")}</Label>
            <Input id="tplname" name="name" placeholder={t("pdfTemplateNamePlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tplfile">PDF</Label>
            <Input
              id="tplfile"
              name="file"
              type="file"
              accept="application/pdf"
              required
              className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Upload />} {t("uploadTemplate")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
