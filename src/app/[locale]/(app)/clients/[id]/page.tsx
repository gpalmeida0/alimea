import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AlertTriangle, ArrowLeft, CalendarClock, FileText, Mail, Phone, TrendingUp } from "lucide-react";
import {
  getClient,
  listAppointments,
  listConsultations,
  listConsultationTypes,
  listPlans,
} from "@/lib/data/repo";
import { bodyFatOf, muscleMassOf, computeBmi } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, Badge, EmptyState } from "@/components/ui/misc";
import { Link } from "@/i18n/routing";
import { ConsultationButtons } from "@/components/consultation-buttons";
import { ClientActions } from "@/components/client-edit";
import { ConsultationRowMenu } from "@/components/consultation-row-menu";
import { ProgressDashboard, type ProgressPoint } from "@/components/progress-dashboard";
import { ageFromBirth, formatDate, formatNumber } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const client = await getClient((await params).id);
  return { title: client?.name };
}

export default async function ClientDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("client");
  const tc = await getTranslations("consultation");
  const tcl = await getTranslations("clients");
  const tn = await getTranslations("nutrition");

  const client = await getClient(id);
  if (!client) notFound();

  const [consults, plans, types, appts] = await Promise.all([
    listConsultations(id),
    listPlans(id),
    listConsultationTypes(),
    listAppointments(),
  ]);
  const age = ageFromBirth(client.birthDate);
  const typeName = new Map(types.map((ct) => [ct.id, ct.name]));
  const now = Date.now();
  const upcoming = appts.filter((a) => a.clientId === id && a.status === "scheduled" && new Date(a.date).getTime() >= now);
  const standalonePlans = plans.filter((p) => !p.consultationId);

  // Progress series (oldest → newest).
  const series = [...consults].reverse().map<ProgressPoint>((c) => ({
    date: c.date,
    weight: c.measurements.weightKg,
    bmi: computeBmi(c.measurements),
    bodyFat: bodyFatOf(c.measurements),
    muscle: muscleMassOf(c.measurements),
    waist: c.measurements.perimeters.waist,
    abdominal: c.measurements.perimeters.abdominal,
    arm: c.measurements.perimeters.arm,
    hip: c.measurements.perimeters.hip,
    thigh: c.measurements.perimeters.thigh,
    calf: c.measurements.perimeters.calf,
  }));

  const facts = [
    age != null ? t("age", { age }) : null,
    client.sex ? tn(client.sex) : null,
    client.profession || null,
  ].filter(Boolean);
  const alerts = [
    client.anamnesis?.allergies ? { label: tn("allergies"), value: client.anamnesis.allergies } : null,
    client.anamnesis?.medication ? { label: tn("medication"), value: client.anamnesis.medication } : null,
  ].filter((x): x is { label: string; value: string } => Boolean(x));

  return (
    <div className="space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {tcl("title")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={client.name} className="size-14 text-xl" />
          <div className="min-w-0">
            <h1 className="break-words font-serif text-3xl font-semibold tracking-tight">{client.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {facts.length > 0 && <span>{facts.join(" · ")}</span>}
              {client.phone && (
                <a href={`tel:${client.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 hover:text-foreground">
                  <Phone className="size-3.5" /> {client.phone}
                </a>
              )}
              {client.email && (
                <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                  <Mail className="size-3.5" /> {client.email}
                </a>
              )}
              {client.nif && <span>NIF {client.nif}</span>}
              {client.healthInsurer && <span>{[client.healthInsurer, client.insuranceNumber].filter(Boolean).join(" · ")}</span>}
              {client.nutritionVoucher && <Badge variant="accent">{t("voucherBadge")}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ClientActions client={client} />
        </div>
      </div>

      <ConsultationButtons
        clientId={id}
        hasPrevious={consults.length > 0}
        types={types.map((ct) => ({ id: ct.id, name: ct.name, price: ct.price }))}
        defaultTypeId={consults[0]?.consultationTypeId}
      />

      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-accent/25 bg-accent/5 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" />
          {alerts.map((a) => (
            <p key={a.label}>
              <span className="font-medium">{a.label}:</span> <span className="text-muted-foreground">{a.value}</span>
            </p>
          ))}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="size-5 text-brand" />
          <h2 className="font-serif text-xl font-semibold">{t("progress")}</h2>
        </div>
        {series.length > 1 ? (
          <ProgressDashboard points={series} locale={locale} />
        ) : (
          <EmptyState icon={<TrendingUp />} title={t("progressEmpty")} description={t("progressEmptyHint")} className="py-8" />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">{t("history")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {consults.length === 0 && <EmptyState title={t("noConsultations")} description={t("noConsultationsHint")} className="py-8" />}
            {consults.map((c) => {
              const bmi = computeBmi(c.measurements);
              const m = c.measurements;
              return (
                <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border transition-colors hover:bg-muted/50">
                  <Link
                    href={c.planId ? `/clients/${id}/plans/${c.planId}` : `/clients/${id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted font-serif text-sm font-semibold">
                      {c.consultationNumber ?? "·"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {formatDate(c.date, locale)}
                        {c.consultationTypeId && typeName.get(c.consultationTypeId) && (
                          <span className="ml-2 font-normal text-muted-foreground">· {typeName.get(c.consultationTypeId)}</span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[
                          m.weightKg != null ? `${formatNumber(m.weightKg, locale)} kg` : null,
                          bmi ? `${tc("bmiShort")} ${formatNumber(bmi, locale)}` : null,
                          bodyFatOf(m) != null ? `${formatNumber(bodyFatOf(m), locale)}% ${tc("fatShort")}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || tc("noMeasurements")}
                      </p>
                    </div>
                    {c.planId && (
                      <Badge>
                        <FileText className="size-3" /> {t("plan")}
                      </Badge>
                    )}
                  </Link>
                  <ConsultationRowMenu consultationId={c.id} clientId={id} />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-lg">{t("nextAppointments")}</CardTitle>
              <Link href={`/appointments?client=${id}`} className="text-sm text-brand-600 hover:underline">
                {t("schedule")}
              </Link>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {upcoming.length === 0 && <p className="text-sm text-muted-foreground">{t("noAppointments")}</p>}
              {upcoming.slice(0, 3).map((a) => (
                <p key={a.id} className="flex items-center gap-2 text-sm">
                  <CalendarClock className="size-4 text-accent" />
                  {formatDate(a.date, locale, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{tcl("goals")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="whitespace-pre-wrap">{client.goals || "—"}</p>
              <div className="border-t border-border pt-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">{tcl("notes")}</p>
                <p className="whitespace-pre-wrap">{client.notes || "—"}</p>
              </div>
              <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                {t("since", { date: formatDate(client.createdAt, locale) })}
              </p>
            </CardContent>
          </Card>

          {standalonePlans.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("otherPlans")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {standalonePlans.map((p) => (
                  <Link
                    key={p.id}
                    href={`/clients/${id}/plans/${p.id}`}
                    className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted"
                  >
                    <span>{formatDate(p.updatedAt, locale)}</span>
                    <Badge variant="muted">{p.language === "en" ? "EN" : "PT"}</Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
