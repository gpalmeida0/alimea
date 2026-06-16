import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, FileText, TrendingUp } from "lucide-react";
import {
  getClient,
  listConsultations,
  listConsultationTypes,
  listPlans,
} from "@/lib/data/repo";
import { computeBmi } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/misc";
import { Link } from "@/i18n/routing";
import { ConsultationButtons } from "@/components/consultation-buttons";
import { ClientEditButton } from "@/components/client-edit";
import { ProgressDashboard, type ProgressPoint } from "@/components/progress-dashboard";
import { ageFromBirth, formatDate } from "@/lib/utils";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("client");
  const tc = await getTranslations("consultation");
  const tcl = await getTranslations("clients");

  const client = await getClient(id);
  if (!client) notFound();

  const [consults, plans, consultationTypes] = await Promise.all([
    listConsultations(id),
    listPlans(id),
    listConsultationTypes(),
  ]);
  const age = ageFromBirth(client.birthDate);

  // progress series (oldest → newest)
  const series = [...consults]
    .reverse()
    .map<ProgressPoint>((c) => ({
      date: c.date,
      weight: c.measurements.weightKg,
      bmi: computeBmi(c.measurements),
      bodyFat: c.measurements.bodyFatPct,
      muscle: c.measurements.muscleMassKg,
      waist: c.measurements.perimeters.waist,
      arm: c.measurements.perimeters.arm,
      hip: c.measurements.perimeters.hip,
      thigh: c.measurements.perimeters.thigh,
      calf: c.measurements.perimeters.calf,
    }));

  return (
    <div>
      <Link
        href="/clients"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {tcl("title")}
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-50 font-serif text-2xl font-semibold text-brand-600">
            {client.name.charAt(0)}
          </span>
          <div className="min-w-0">
            <h1 className="break-words font-serif text-2xl font-semibold tracking-tight sm:text-3xl">{client.name}</h1>
            <p className="text-sm text-muted-foreground">
              {client.email ?? ""} {age ? `· ${t("age", { age })}` : ""}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <ClientEditButton
            clientId={id}
            name={client.name}
            email={client.email}
            phone={client.phone}
            goals={client.goals}
            notes={client.notes}
          />
          <ConsultationButtons
            clientId={id}
            hasPrevious={consults.length > 0}
            types={consultationTypes.map((ct) => ({ id: ct.id, name: ct.name, price: ct.price }))}
          />
        </div>
      </div>

      {/* Progress dashboard — weight, composition, perimeters */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="size-5 text-brand" />
          <h2 className="font-serif text-xl font-semibold">{t("progress")}</h2>
        </div>
        {series.length > 1 ? (
          <ProgressDashboard points={series} locale={locale} />
        ) : (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            {t("noConsultations")}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle>{t("history")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {consults.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("noConsultations")}</p>
              )}
              {consults.map((c) => {
                const bmi = computeBmi(c.measurements);
                return (
                  <Link
                    key={c.id}
                    href={c.planId ? `/clients/${id}/plans/${c.planId}` : `/clients/${id}`}
                    className="flex items-center justify-between rounded-md border border-border px-4 py-3 transition-colors hover:bg-muted"
                  >
                    <div>
                      <p className="text-sm font-medium">{formatDate(c.date, locale)}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.measurements.weightKg ? `${c.measurements.weightKg} kg` : "—"}
                        {bmi ? ` · ${tc("bmiShort")} ${bmi}` : ""}
                        {c.measurements.bodyFatPct ? ` · ${c.measurements.bodyFatPct}% ${tc("fatShort")}` : ""}
                      </p>
                    </div>
                    {c.planId && (
                      <Badge>
                        <FileText className="mr-1 size-3" /> {t("plans")}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{tcl("goals")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-foreground">{client.goals ?? "—"}</p>
              <div className="border-t border-border pt-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {tcl("notes")}
                </p>
                <p className="whitespace-pre-wrap text-foreground">{client.notes ?? "—"}</p>
              </div>
              <div className="border-t border-border pt-3 text-xs text-muted-foreground">
                <p>{tcl("phone")}: {client.phone ?? "—"}</p>
                <p>{t("since", { date: formatDate(client.createdAt, locale) })}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{t("plans")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {plans.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("noConsultations")}</p>
              )}
              {plans.map((p) => (
                <Link
                  key={p.id}
                  href={`/clients/${id}/plans/${p.id}`}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted"
                >
                  <span>{formatDate(p.updatedAt, locale)}</span>
                  <Badge variant="muted">{p.language === "en" ? "EN" : "PT"}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
