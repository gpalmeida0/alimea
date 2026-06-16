import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { createClientAction } from "@/app/actions";

export default async function NewClientPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("clients");
  const tc = await getTranslations("common");

  const action = createClientAction.bind(null, locale);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/clients" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {tc("back")}
      </Link>
      <PageHeader title={t("createTitle")} />
      <Card>
        <CardContent className="pt-5">
          <form action={action} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("name")} name="name" required />
              <Field label={t("email")} name="email" type="email" />
              <Field label={t("phone")} name="phone" />
              <Field label={t("birthDate")} name="birthDate" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goals">{t("goals")}</Label>
              <Textarea id="goals" name="goals" rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">{t("notes")}</Label>
              <Textarea id="notes" name="notes" rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Link href="/clients">
                <Button type="button" variant="ghost">
                  {tc("cancel")}
                </Button>
              </Link>
              <Button type="submit">{tc("save")}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} />
    </div>
  );
}
