import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getAuthNid, getProfile } from "@/lib/data/repo";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

// Per-tenant data — never statically cache these routes.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Auth guard (middleware also gates these routes; this is a safety net).
  if (!(await getAuthNid())) redirect({ href: "/login", locale });
  const profile = await getProfile();

  return (
    <div className="min-h-screen">
      <Sidebar name={profile.name} credential={profile.credential} />
      <div className="md:pl-60">
        <Topbar />
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">{children}</main>
      </div>
    </div>
  );
}
