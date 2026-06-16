"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

interface Row {
  id: string;
  name: string;
  email?: string;
  lastConsultation?: string;
  consultations: number;
}

export function ClientsList({ rows, locale }: { rows: Row[]; locale: string }) {
  const t = useTranslations("clients");
  const [q, setQ] = useState("");
  const filtered = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      (r.email ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="pl-9"
        />
      </div>

      <div className="card-surface divide-y divide-border overflow-hidden">
        {filtered.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">{t("noClients")}</p>
        )}
        {filtered.map((r) => (
          <Link
            key={r.id}
            href={`/clients/${r.id}`}
            className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-muted"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-brand-50 font-serif text-sm font-semibold text-brand-600">
                {r.name.charAt(0)}
              </span>
              <div>
                <p className="text-sm font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">{r.email ?? "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-right text-xs text-muted-foreground">
              <div className="hidden sm:block">
                <p className="text-foreground">{r.consultations}</p>
                <p>{t("consultations")}</p>
              </div>
              <div className="hidden sm:block">
                <p className="text-foreground">{formatDate(r.lastConsultation, locale)}</p>
                <p>{t("lastConsultation")}</p>
              </div>
              <ChevronRight className="size-4" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
