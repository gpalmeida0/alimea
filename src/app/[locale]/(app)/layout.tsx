import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getAuthNid, getProfile, listAppointments, listClients } from "@/lib/data/repo";
import { fileUrl } from "@/lib/files";
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
  const [profile, clients, appts] = await Promise.all([getProfile(), listClients(), listAppointments()]);

  const names = new Map(clients.map((c) => [c.id, c.name]));
  const now = Date.now();
  const upcoming = appts
    .filter((a) => {
      const t = new Date(a.date).getTime();
      return a.status === "scheduled" && t >= now - 15 * 60_000 && t <= now + 24 * 3600_000;
    })
    .map((a) => ({ id: a.id, clientId: a.clientId, clientName: names.get(a.clientId) ?? "—", date: a.date }));

  const user = { name: profile.name, credential: profile.credential, logo: fileUrl(profile.logoUrl) };

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <Sidebar user={user} />
      <div className="md:pl-64">
        <Topbar user={user} clients={clients.map((c) => ({ id: c.id, name: c.name }))} upcoming={upcoming} />
        <main id="main" className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-8 md:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
