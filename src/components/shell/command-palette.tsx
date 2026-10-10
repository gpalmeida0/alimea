"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CornerDownLeft, Search, UserPlus, Users } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { cn, normalizeSearch } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

interface Entry {
  id: string;
  label: string;
  group: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** ⌘K / Ctrl+K palette: jump to any page or client, fully keyboard driven. */
export function CommandPalette({ clients }: { clients: { id: string; name: string }[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setQ("");
      setActive(0);
    }
  }, [open]);

  const entries = useMemo<Entry[]>(() => {
    const nq = normalizeSearch(q.trim());
    const match = (s: string) => !nq || normalizeSearch(s).includes(nq);
    const pages: Entry[] = [
      { id: "new-client", label: t("clients.new"), group: t("palette.actions"), href: "/clients/new", icon: UserPlus },
      ...NAV_ITEMS.map((n) => ({
        id: `nav-${n.key}`,
        label: t(`nav.${n.key}`),
        group: t("palette.pages"),
        href: n.href,
        icon: n.icon,
      })),
    ].filter((e) => match(e.label));
    const people: Entry[] = clients
      .filter((c) => match(c.name))
      .slice(0, nq ? 12 : 6)
      .map((c) => ({ id: c.id, label: c.name, group: t("nav.clients"), href: `/clients/${c.id}`, icon: Users }));
    return nq ? [...people, ...pages] : [...pages, ...people];
  }, [q, clients, t]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(e?: Entry) {
    if (!e) return;
    setOpen(false);
    router.push(e.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, entries.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(entries[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  let lastGroup = "";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t("palette.placeholder")}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-muted sm:w-full sm:max-w-xs sm:px-3"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden truncate sm:inline">{t("palette.placeholder")}</span>
        <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 font-sans text-[10px] font-medium sm:inline">
          {isMac ? "⌘" : "Ctrl"} K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/30 p-4 pt-[12vh] backdrop-blur-[2px] animate-in fade-in-0"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("common.search")}
            className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95"
          >
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="size-4 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t("palette.placeholder")}
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                aria-activedescendant={entries[active] ? `palette-${entries[active].id}` : undefined}
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="rounded border border-border bg-muted px-1.5 text-[10px] text-muted-foreground">esc</kbd>
            </div>
            <div ref={listRef} id="palette-list" role="listbox" className="max-h-80 overflow-y-auto p-2 scroll-thin">
              {entries.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("foods.noResults")}</p>
              )}
              {entries.map((e, i) => {
                const header = e.group !== lastGroup ? e.group : null;
                lastGroup = e.group;
                const Icon = e.icon;
                return (
                  <div key={e.id}>
                    {header && (
                      <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {header}
                      </p>
                    )}
                    <button
                      id={`palette-${e.id}`}
                      data-index={i}
                      role="option"
                      aria-selected={i === active}
                      onMouseMove={() => setActive(i)}
                      onClick={() => go(e)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm",
                        i === active ? "bg-brand-50 text-brand-700" : "text-foreground",
                      )}
                    >
                      <Icon className={cn("size-4", i === active ? "text-brand" : "text-muted-foreground")} />
                      <span className="flex-1 truncate">{e.label}</span>
                      {i === active && <CornerDownLeft className="size-3.5 text-brand" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
