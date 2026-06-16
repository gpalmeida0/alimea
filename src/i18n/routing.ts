import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const routing = defineRouting({
  locales: ["pt-PT", "en"],
  defaultLocale: "pt-PT",
  // Keep the default locale prefix so URLs are explicit (/pt-PT, /en)
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
