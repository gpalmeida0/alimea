import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  Users,
  FileText,
  CalendarDays,
  UserPlus,
  Plus,
  ArrowRight,
  CalendarClock,
} from "lucide-react";
import { getDashboardStats, getProfile } from "@/lib/data/repo";
import { Stat } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("consultation");
  const [stats, profile] = await Promise.all([getDashboardStats(), getProfile()]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            {t("welcome", { name: profile.name.split(" ")[0] })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/clients">
            <Button variant="outline">
              <Users /> {t("viewClients")}
            </Button>
          </Link>
          <Link href="/clients/new">
            <Button>
              <UserPlus /> {t("newClient")}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("activeClients")} value={stats.activeClients} hint={stats.newClientsThisMonth ? t("newThisMonth", { n: stats.newClientsThisMonth }) : undefined} icon={<Users />} />
        <Stat label={t("consultationsThisMonth")} value={stats.consultationsThisMonth} hint={t("totalConsults", { n: stats.totalConsultations })} icon={<CalendarDays />} />
        <Stat label={t("plansGenerated")} value={stats.plansGenerated} icon={<FileText />} />
        <Stat label={t("upcoming")} value={stats.upcomingCount} icon={<CalendarClock />} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("recentActivity")}</CardTitle>
            <Link href="/clients" className="text-sm text-brand-600 hover:underline">
              {t("viewAll")}
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {stats.recentConsultationList.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("noActivity")}</p>
            )}
            {stats.recentConsultationList.map(({ consultation, client, bmi }) => (
              <Link
                key={consultation.id}
                href={`/clients/${client?.id ?? ""}`}
                className="flex items-center justify-between rounded-md px-3 py-2.5 hover:bg-muted"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-brand-50 font-serif text-sm font-semibold text-brand-600">
                    {client?.name.charAt(0) ?? "?"}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{client?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(consultation.date, locale)}
                      {consultation.measurements.weightKg
                        ? ` · ${consultation.measurements.weightKg} kg`
                        : ""}
                      {bmi ? ` · ${tc("bmiShort")} ${bmi}` : ""}
                    </p>
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("upcomingAppointments")}</CardTitle>
            <Link href="/appointments" className="text-sm text-brand-600 hover:underline">
              {t("viewAll")}
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {stats.upcomingList.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("noUpcoming")}</p>
            )}
            {stats.upcomingList.map(({ appointment, client }) => (
              <Link
                key={appointment.id}
                href={`/clients/${client?.id ?? ""}`}
                className="flex items-center justify-between rounded-md px-3 py-2.5 hover:bg-muted"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <CalendarClock className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{client?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(appointment.date, locale, {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
