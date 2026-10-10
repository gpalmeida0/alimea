import {
  Apple,
  CalendarDays,
  ChefHat,
  FileText,
  LayoutDashboard,
  LayoutTemplate,
  Receipt,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";

export interface NavItem {
  href: string;
  key: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

/** Primary navigation, grouped: daily work / clinical library / admin. */
export const NAV_GROUPS: { key: string; items: NavItem[] }[] = [
  {
    key: "work",
    items: [
      { href: "/", key: "dashboard", icon: LayoutDashboard, exact: true },
      { href: "/clients", key: "clients", icon: Users },
      { href: "/appointments", key: "appointments", icon: CalendarDays },
      { href: "/plans", key: "plans", icon: FileText },
    ],
  },
  {
    key: "library",
    items: [
      { href: "/foods", key: "foods", icon: Apple },
      { href: "/recipes", key: "recipes", icon: ChefHat },
      { href: "/templates", key: "templates", icon: LayoutTemplate },
      { href: "/recommendations", key: "recommendations", icon: Sparkles },
    ],
  },
  {
    key: "admin",
    items: [
      { href: "/billing", key: "billing", icon: Receipt },
      { href: "/settings", key: "settings", icon: Settings },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export function isActive(item: NavItem, pathname: string): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
