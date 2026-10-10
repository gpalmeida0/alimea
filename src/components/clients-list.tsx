"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarClock, ChevronRight, Search, UserPlus, Users } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Input, Select } from "@/components/ui/input";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatNumber, normalizeSearch } from "@/lib/utils";

export interface ClientRow {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  age?: number;
  lastConsultation?: string;
  lastWeight?: number;
  nextAppointment?: string;
  consultations: number;
  createdAt: string;
}

type Sort = "name" | "recent" | "newest";

export function ClientsList({ rows, locale }: { rows: ClientRow[]; locale: string }) {
  const t = useTranslations("clients");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("name");

  const filtered = useMemo(() => {
    const nq = normalizeSearch(q.trim());
    const digits = q.replace(/\D/g, "");
    const list = rows.filter(
      (r) =>
        !nq ||
        normalizeSearch(r.name).includes(nq) ||
        normalizeSearch(r.email ?? "").includes(nq) ||
        (digits.length >= 3 && (r.phone ?? "").replace(/\D/g, "").includes(digits)),
    );
    const cmp: Record<Sort, (a: ClientRow, b: ClientRow) => number> = {
      name: (a, b) => a.name.localeCompare(b.name, locale),
      recent: (a, b) => (b.lastConsultation ?? "").localeCompare(a.lastConsultation ?? ""),
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    };
    return [...list].sort(cmp[sort]);
  }, [rows, q, sort, locale]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Users />}
        title={t("noClients")}
        description={t("noClientsHint")}
        action={
          <Link href="/clients/new" className={buttonVariants()}>
            <UserPlus /> {t("new")}
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
            aria-label={t("searchPlaceholder")}
          />
        </div>
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="sm:w-56" aria-label={t("sortBy")}>
          <option value="name">{t("sort.name")}</option>
          <option value="recent">{t("sort.recent")}</option>
          <option value="newest">{t("sort.newest")}</option>
        </Select>
      </div>

      <p className="mb-2 text-xs text-muted-foreground">{t("count", { n: filtered.length })}</p>

      <div className="card-surface divide-y divide-border overflow-hidden">
        {filtered.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">{t("noMatches")}</p>}
        {filtered.map((r) => (
          <Link
            key={r.id}
            href={`/clients/${r.id}`}
            className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/60 sm:px-5"
          >
            <Avatar name={r.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[r.age != null ? t("ageShort", { age: r.age }) : null, r.email ?? r.phone].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
            <div className="hidden w-28 text-right text-xs md:block">
              <p className="font-medium text-foreground">{r.lastWeight != null ? `${formatNumber(r.lastWeight, locale)} kg` : "—"}</p>
              <p className="text-muted-foreground">{t("lastWeight")}</p>
            </div>
            <div className="hidden w-32 text-right text-xs sm:block">
              <p className="font-medium text-foreground">{r.lastConsultation ? formatDate(r.lastConsultation, locale) : "—"}</p>
              <p className="text-muted-foreground">{t("consultationsCount", { n: r.consultations })}</p>
            </div>
            <div className="hidden w-32 text-right text-xs lg:block">
              {r.nextAppointment ? (
                <p className="inline-flex items-center gap-1 font-medium text-accent-700">
                  <CalendarClock className="size-3" />
                  {formatDate(r.nextAppointment, locale, { day: "2-digit", month: "short" })}
                </p>
              ) : (
                <p className="text-muted-foreground">—</p>
              )}
              <p className="text-muted-foreground">{t("nextAppointment")}</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </div>
  );
}
