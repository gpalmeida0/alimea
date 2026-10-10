"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { deleteClientAction, updateClientAction } from "@/app/actions";
import type { Client } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback";
import { useServerAction } from "@/hooks/use-server-action";
import { ClientFields } from "./client-form";

export function ClientActions({ client }: { client: Client }) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { confirm } = useFeedback();
  const { run, pending } = useServerAction();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  async function remove() {
    setMenu(false);
    const ok = await confirm({
      title: t("deleteTitle", { name: client.name }),
      body: t("deleteBody"),
      destructive: true,
    });
    if (ok) run(() => deleteClientAction(locale, client.id));
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil /> {tc("edit")}
      </Button>
      <div className="relative">
        <Button variant="outline" size="icon" aria-label={tc("more")} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          <MoreHorizontal />
        </Button>
        {menu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
            <div className="absolute right-0 z-50 mt-1 w-48 rounded-lg border border-border bg-card p-1 shadow-lg animate-in fade-in-0 zoom-in-95">
              <button
                onClick={remove}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-4" /> {t("delete")}
              </button>
            </div>
          </>
        )}
      </div>

      {open && (
        <Dialog title={t("editTitle")} onClose={() => setOpen(false)} size="lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(() => updateClientAction(locale, client.id, fd), {
                success: tc("saved"),
                onDone: () => setOpen(false),
              });
            }}
          >
            <ClientFields client={client} />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" loading={pending}>
                {tc("save")}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}
    </>
  );
}
