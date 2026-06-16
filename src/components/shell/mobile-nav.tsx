"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Menu,
  X,
  LayoutDashboard,
  Users,
  FileText,
  Sparkles,
  LayoutTemplate,
  Apple,
  ChefHat,
  CalendarDays,
  Receipt,
  Settings,
  Leaf,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const items: {
  href: string;
  key: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}[] = [
  { href: "/", key: "dashboard", icon: LayoutDashboard, exact: true },
  { href: "/clients", key: "clients", icon: Users },
  { href: "/plans", key: "plans", icon: FileText },
  { href: "/recommendations", key: "recommendations", icon: Sparkles },
  { href: "/templates", key: "templates", icon: LayoutTemplate },
  { href: "/foods", key: "foods", icon: Apple },
  { href: "/recipes", key: "recipes", icon: ChefHat },
  { href: "/appointments", key: "appointments", icon: CalendarDays },
  { href: "/billing", key: "billing", icon: Receipt },
  { href: "/settings", key: "settings", icon: Settings },
];

export function MobileNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        className="flex size-9 items-center justify-center rounded-md border border-border bg-card text-foreground"
        aria-label="Menu"
      >
        <Menu className="size-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setOpen(false)}>
          <div
            className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-card shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-16 items-center justify-between px-5">
              <span className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-white">
                  <Leaf className="size-5" />
                </span>
                <span className="font-serif text-2xl font-semibold">Alimea</span>
              </span>
              <button onClick={() => setOpen(false)} className="text-muted-foreground">
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 px-3 py-2">
              {items.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-brand-50 text-brand-600"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {t(item.key)}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
