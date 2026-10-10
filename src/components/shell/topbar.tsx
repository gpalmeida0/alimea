import { CommandPalette } from "./command-palette";
import { LanguageSwitcher } from "./language-switcher";
import { Notifications, type UpcomingAppt } from "./notifications";
import { MobileNav, type ShellUser } from "./sidebar";

export function Topbar({
  user,
  clients,
  upcoming,
}: {
  user: ShellUser;
  clients: { id: string; name: string }[];
  upcoming: UpcomingAppt[];
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <MobileNav user={user} />
        <CommandPalette clients={clients} />
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <Notifications upcoming={upcoming} />
        <LanguageSwitcher />
      </div>
    </header>
  );
}
