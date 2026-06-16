"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, Users, Plus, LayoutDashboard, Sparkles } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";

interface ClientLite {
  id: string;
  name: string;
}

export function CommandPalette({ clients }: { clients: ClientLite[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const actions = useMemo(
    () => [
      { label: t("dashboard.title"), href: "/", icon: LayoutDashboard },
      { label: t("clients.new"), href: "/clients/new", icon: Plus },
      { label: t("nav.clients"), href: "/clients", icon: Users },
      { label: t("nav.recommendations"), href: "/recommendations", icon: Sparkles },
    ],
    [t],
  );

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground hover:bg-muted"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">{t("common.search")}</span>
        <kbd className="ml-2 hidden rounded bg-muted px-1.5 text-[10px] font-medium sm:inline">⌘K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-[12vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="size-4 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("common.search")}
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-80 overflow-y-auto scroll-thin p-2">
              <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("dashboard.quickActions")}
              </p>
              {actions.map((a) => {
                const Icon = a.icon;
                return (
                  <Link
                    key={a.href}
                    href={a.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
                  >
                    <Icon className="size-4 text-brand" />
                    {a.label}
                  </Link>
                );
              })}
              {filtered.length > 0 && (
                <>
                  <p className="mt-2 px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("nav.clients")}
                  </p>
                  {filtered.slice(0, 8).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setOpen(false);
                        router.push(`/clients/${c.id}`);
                      }}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                    >
                      <Users className="size-4 text-muted-foreground" />
                      {c.name}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
