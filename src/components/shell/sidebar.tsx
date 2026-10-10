"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Leaf, Menu, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/misc";
import { LogoutButton } from "./logout-button";
import { NAV_GROUPS, isActive } from "./nav-items";

export interface ShellUser {
  name: string;
  credential: string;
  logo?: string;
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-white shadow-sm">
        <Leaf className="size-[18px]" />
      </span>
      <span className="font-serif text-2xl font-semibold tracking-tight text-foreground">Alimea</span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2 scroll-thin" aria-label={t("main")}>
      {NAV_GROUPS.map((group) => (
        <div key={group.key}>
          <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
            {t(`groups.${group.key}`)}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item, pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className={cn("size-4", active && "text-brand")} />
                  {t(item.key)}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function UserCard({ user }: { user: ShellUser }) {
  return (
    <div className="border-t border-border p-4">
      <div className="flex items-center gap-3">
        {user.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.logo} alt="" className="size-9 rounded-full border border-border object-cover" />
        ) : (
          <Avatar name={user.name || "?"} />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{user.name || "—"}</p>
          {user.credential && <p className="truncate text-xs text-muted-foreground">CP {user.credential}</p>}
        </div>
      </div>
      <LogoutButton className="mt-3" />
    </div>
  );
}

export function Sidebar({ user }: { user: ShellUser }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card md:flex">
      <div className="flex h-16 items-center px-6">
        <Brand />
      </div>
      <NavList />
      <UserCard user={user} />
    </aside>
  );
}

export function MobileNav({ user }: { user: ShellUser }) {
  const t = useTranslations("common");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        className="flex size-9 items-center justify-center rounded-md border border-border bg-card text-foreground"
        aria-label={t("menu")}
        aria-expanded={open}
      >
        <Menu className="size-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-foreground/40 animate-in fade-in-0" onClick={() => setOpen(false)}>
          <div
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-card shadow-2xl animate-in slide-in-from-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-16 items-center justify-between px-5">
              <Brand />
              <button onClick={() => setOpen(false)} className="text-muted-foreground" aria-label={t("close")}>
                <X className="size-5" />
              </button>
            </div>
            <NavList onNavigate={() => setOpen(false)} />
            <UserCard user={user} />
          </div>
        </div>
      )}
    </div>
  );
}
