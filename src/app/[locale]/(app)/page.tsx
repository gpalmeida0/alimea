import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, CalendarClock, CalendarDays, Euro, UserPlus, Users } from "lucide-react";
import { getDashboardStats, getProfile } from "@/lib/data/repo";
import { Avatar, EmptyState, Stat } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { APP_TIME_ZONE, formatDate, formatNumber } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "dashboard" });
  return { title: t("title") };
}

function greetingKey(): "morning" | "afternoon" | "evening" {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: APP_TIME_ZONE }).format(new Date()),
  );
  return hour < 12 ? "morning" : hour < 19 ? "afternoon" : "evening";
}

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("consultation");
  const [stats, profile] = await Promise.all([getDashboardStats(), getProfile()]);
  const eur = new Intl.NumberFormat(locale === "en" ? "en-IE" : "pt-PT", { style: "currency", currency: "EUR" });
  const firstName = profile.name.trim().split(/\s+/)[0] ?? "";
  const todayRaw = formatDate(new Date().toISOString(), locale, { weekday: "long", day: "numeric", month: "long" });
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{today}</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            {t(`greeting.${greetingKey()}`, { name: firstName })}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/appointments" className={buttonVariants({ variant: "outline" })}>
            <CalendarDays /> {t("schedule")}
          </Link>
          <Link href="/clients/new" className={buttonVariants()}>
            <UserPlus /> {t("newClient")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          label={t("activeClients")}
          value={stats.activeClients}
          hint={t("ofTotal", { n: stats.totalClients, newCount: stats.newClientsThisMonth })}
          icon={<Users />}
        />
        <Stat
          label={t("consultationsThisMonth")}
          value={stats.consultationsThisMonth}
          hint={t("totalConsults", { n: stats.totalConsultations })}
          icon={<CalendarDays />}
        />
        <Stat
          label={t("revenueThisMonth")}
          value={eur.format(stats.revenueThisMonth)}
          hint={stats.pendingRevenue > 0 ? t("pendingRevenue", { amount: eur.format(stats.pendingRevenue) }) : undefined}
          icon={<Euro />}
        />
        <Stat label={t("upcoming")} value={stats.upcomingCount} hint={t("plansHint", { n: stats.plansGenerated })} icon={<CalendarClock />} tone="accent" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg">{t("upcomingAppointments")}</CardTitle>
            <Link href="/appointments" className="text-sm text-brand-600 hover:underline">
              {t("viewAll")}
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {stats.upcomingList.length === 0 && (
              <EmptyState icon={<CalendarClock />} title={t("noUpcoming")} className="py-8" />
            )}
            {stats.upcomingList.map(({ appointment, client }) => (
              <Link
                key={appointment.id}
                href={`/clients/${client?.id ?? ""}`}
                className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted"
              >
                <div className="flex w-12 shrink-0 flex-col items-center rounded-md bg-accent/10 py-1 text-accent-700">
                  <span className="text-[10px] font-semibold uppercase">
                    {formatDate(appointment.date, locale, { month: "short" })}
                  </span>
                  <span className="font-serif text-lg font-semibold leading-none">
                    {formatDate(appointment.date, locale, { day: "numeric" })}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{client?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(appointment.date, locale, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                    {appointment.note ? ` · ${appointment.note}` : ""}
                  </p>
                </div>
                <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg">{t("recentActivity")}</CardTitle>
            <Link href="/clients" className="text-sm text-brand-600 hover:underline">
              {t("viewAll")}
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {stats.recentConsultationList.length === 0 && (
              <EmptyState
                icon={<Users />}
                title={t("noActivity")}
                action={
                  <Link href="/clients/new" className={buttonVariants({ size: "sm" })}>
                    <UserPlus /> {t("newClient")}
                  </Link>
                }
                className="py-8"
              />
            )}
            {stats.recentConsultationList.map(({ consultation, client, bmi }) => (
              <Link
                key={consultation.id}
                href={consultation.planId ? `/clients/${consultation.clientId}/plans/${consultation.planId}` : `/clients/${consultation.clientId}`}
                className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted"
              >
                <Avatar name={client?.name ?? "?"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{client?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(consultation.date, locale)}
                    {consultation.measurements.weightKg
                      ? ` · ${formatNumber(consultation.measurements.weightKg, locale)} kg`
                      : ""}
                    {bmi ? ` · ${tc("bmiShort")} ${formatNumber(bmi, locale)}` : ""}
                  </p>
                </div>
                <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
