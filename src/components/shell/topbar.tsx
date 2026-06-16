import { getClient, listAppointments, listClients } from "@/lib/data/repo";
import { CommandPalette } from "./command-palette";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";
import { Notifications, type UpcomingAppt } from "./notifications";

export async function Topbar() {
  const [clients, appts] = await Promise.all([listClients(), listAppointments()]);
  const now = Date.now();
  const horizon = now + 24 * 60 * 60 * 1000; // next 24h

  const upcoming: UpcomingAppt[] = (
    await Promise.all(
      appts
        .filter((a) => {
          const t = new Date(a.date).getTime();
          return a.status === "scheduled" && t >= now && t <= horizon;
        })
        .map(async (a) => {
          const c = await getClient(a.clientId);
          return { id: a.id, clientId: a.clientId, clientName: c?.name ?? "—", date: a.date };
        }),
    )
  );

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-4 supports-[backdrop-filter]:bg-background/85 supports-[backdrop-filter]:backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
        <CommandPalette clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
      </div>
      <div className="flex items-center gap-3">
        <Notifications upcoming={upcoming} />
        <LanguageSwitcher />
      </div>
    </header>
  );
}
