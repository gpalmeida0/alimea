"use client";

import { useTranslations } from "next-intl";
import { CalendarDays, FileText, LayoutDashboard, Menu, Users } from "lucide-react";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { isActive, type NavItem } from "./nav-items";
import { openMobileMenu } from "./sidebar";

/** What a nutritionist reaches for on the phone; everything else is under "More". */
const TABS: (NavItem & { label: string })[] = [
  { href: "/", key: "dashboard", label: "home", icon: LayoutDashboard, exact: true },
  { href: "/appointments", key: "appointments", label: "agenda", icon: CalendarDays },
  { href: "/clients", key: "clients", label: "clients", icon: Users },
  { href: "/plans", key: "plans", label: "plans", icon: FileText },
];

/** App-style tab bar, phones only. */
export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const item = "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors";

  return (
    <nav
      aria-label={t("main")}
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-card/85 md:hidden"
    >
      {TABS.map((tab) => {
        const active = isActive(tab, pathname);
        const Icon = tab.icon;
        return (
          <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined} className={cn(item, active ? "text-brand-600" : "text-muted-foreground")}>
            <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-brand-50")}>
              <Icon className="size-5" />
            </span>
            <span className="truncate">{t(tab.label)}</span>
          </Link>
        );
      })}
      <button type="button" onClick={openMobileMenu} className={cn(item, "text-muted-foreground")}>
        <span className="flex h-7 w-12 items-center justify-center">
          <Menu className="size-5" />
        </span>
        {t("more")}
      </button>
    </nav>
  );
}
