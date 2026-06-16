"use client";

import { useTranslations } from "next-intl";
import {
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
import { LogoutButton } from "./logout-button";

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

export function Sidebar({ name, credential }: { name: string; credential: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card md:flex">
      <div className="flex h-16 items-center gap-2 px-6">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-white">
          <Leaf className="size-5" />
        </span>
        <span className="font-serif text-2xl font-semibold text-foreground">Alimea</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
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
      <div className="border-t border-border p-4">
        <p className="truncate text-sm font-medium">{name || "—"}</p>
        {credential && <p className="text-xs text-muted-foreground">CP {credential}</p>}
        <LogoutButton className="mt-2" />
      </div>
    </aside>
  );
}
