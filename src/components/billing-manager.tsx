"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  Receipt,
  Wallet,
  Clock,
  CalendarDays,
  Settings2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge, Stat } from "@/components/ui/misc";
import { formatDate } from "@/lib/utils";
import {
  createBillingEntryAction,
  createConsultationTypeAction,
  deleteBillingEntryAction,
  deleteConsultationTypeAction,
  updateBillingEntryAction,
  updateConsultationTypeAction,
} from "@/app/actions";
import type { BillingEntry } from "@/lib/types";

interface TypeLite {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
}

interface Props {
  entries: BillingEntry[];
  types: TypeLite[];
  clients: { id: string; name: string }[];
  locale: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export function BillingManager({ entries, types, clients, locale }: Props) {
  const t = useTranslations("billing");
  const tcom = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<BillingEntry | null>(null);
  const [showTypes, setShowTypes] = useState(false);

  const eur = useMemo(
    () =>
      new Intl.NumberFormat(locale === "en" ? "en-IE" : "pt-PT", {
        style: "currency",
        currency: "EUR",
      }),
    [locale],
  );

  const run = (fn: () => Promise<unknown>, after?: () => void) =>
    start(async () => {
      await fn();
      router.refresh();
      after?.();
    });

  const visible = entries.filter((e) => filter === "all" || e.status === filter);

  const totals = useMemo(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    let total = 0;
    let paid = 0;
    let pendingSum = 0;
    let month = 0;
    for (const e of entries) {
      total += e.amount;
      if (e.status === "paid") paid += e.amount;
      else pendingSum += e.amount;
      if (new Date(e.date) >= monthStart) month += e.amount;
    }
    return { total, paid, pendingSum, month };
  }, [entries]);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("total")} value={eur.format(totals.total)} icon={<Receipt />} />
        <Stat label={t("paid")} value={eur.format(totals.paid)} icon={<Wallet />} />
        <Stat label={t("pending")} value={eur.format(totals.pendingSum)} icon={<Clock />} />
        <Stat label={t("thisMonth")} value={eur.format(totals.month)} icon={<CalendarDays />} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="h-9 rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="all">{t("allStatuses")}</option>
          <option value="pending">{t("statusPending")}</option>
          <option value="paid">{t("statusPaid")}</option>
        </select>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowTypes(true)}>
            <Settings2 /> {t("manageTypes")}
          </Button>
          <Button onClick={() => setShowNew(true)}>
            <Plus /> {t("addEntry")}
          </Button>
        </div>
      </div>

      {/* Entries */}
      <div className="card-surface divide-y divide-border overflow-hidden">
        {visible.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">{t("noEntries")}</p>
        )}
        {visible.map((e) => (
          <div
            key={e.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{e.clientName || "—"}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(e.date, locale)} · {e.typeName || "—"}
                {e.source === "auto" ? ` · ${t("fromConsultation")}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-serif text-lg font-semibold">{eur.format(e.amount)}</span>
              <button
                onClick={() =>
                  run(() =>
                    updateBillingEntryAction(locale, e.id, {
                      status: e.status === "paid" ? "pending" : "paid",
                    }),
                  )
                }
                disabled={pending}
                title={e.status === "paid" ? t("markPending") : t("markPaid")}
              >
                {e.status === "paid" ? (
                  <Badge>
                    <Check className="mr-1 size-3" /> {t("statusPaid")}
                  </Badge>
                ) : (
                  <Badge variant="accent">{t("statusPending")}</Badge>
                )}
              </button>
              <button
                onClick={() => setEditing(e)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={tcom("edit")}
              >
                <Pencil className="size-4" />
              </button>
              <button
                onClick={() => run(() => deleteBillingEntryAction(locale, e.id))}
                disabled={pending}
                className="text-muted-foreground hover:text-destructive"
                aria-label={tcom("delete")}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showNew && (
        <EntryModal
          title={t("createTitle")}
          types={types}
          clients={clients}
          onClose={() => setShowNew(false)}
          onSubmit={(data, done) =>
            run(() => createBillingEntryAction(locale, data), () => {
              done();
              setShowNew(false);
            })
          }
          pending={pending}
        />
      )}

      {editing && (
        <EntryModal
          title={t("editTitle")}
          types={types}
          clients={clients}
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(data, done) =>
            run(
              () =>
                updateBillingEntryAction(locale, editing.id, {
                  clientName: data.clientName,
                  typeName: data.typeName,
                  amount: data.amount,
                  date: data.date,
                  status: data.status,
                  notes: data.notes,
                }),
              () => {
                done();
                setEditing(null);
              },
            )
          }
          pending={pending}
        />
      )}

      {showTypes && (
        <TypesModal types={types} locale={locale} onClose={() => setShowTypes(false)} />
      )}
    </div>
  );
}

interface EntryData {
  clientId?: string;
  clientName: string;
  typeName: string;
  amount: number;
  date: string;
  status: "pending" | "paid";
  notes?: string;
}

function EntryModal({
  title,
  types,
  clients,
  initial,
  onClose,
  onSubmit,
  pending,
}: {
  title: string;
  types: TypeLite[];
  clients: { id: string; name: string }[];
  initial?: BillingEntry;
  onClose: () => void;
  onSubmit: (data: EntryData, done: () => void) => void;
  pending: boolean;
}) {
  const t = useTranslations("billing");
  const tcom = useTranslations("common");
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [clientName, setClientName] = useState(initial?.clientName ?? "");
  const [typeName, setTypeName] = useState(initial?.typeName ?? types[0]?.name ?? "");
  const [amount, setAmount] = useState<number>(initial?.amount ?? types[0]?.price ?? 0);
  const [date, setDate] = useState(initial?.date ?? today());
  const [status, setStatus] = useState<"pending" | "paid">(initial?.status ?? "pending");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  function pickType(name: string) {
    setTypeName(name);
    const ct = types.find((x) => x.name === name);
    if (ct) setAmount(ct.price);
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(
            { clientId: clientId || undefined, clientName, typeName, amount, date, status, notes },
            () => undefined,
          );
        }}
        className="space-y-3"
      >
        {clients.length > 0 && (
          <div className="space-y-1.5">
            <Label>{t("client")}</Label>
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                const c = clients.find((x) => x.id === e.target.value);
                if (c) setClientName(c.name);
              }}
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
            >
              <option value="">{t("manualClient")}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>{t("manualClient")}</Label>
          <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t("type")}</Label>
            <select
              value={types.some((x) => x.name === typeName) ? typeName : "__custom"}
              onChange={(e) => {
                if (e.target.value === "__custom") setTypeName("");
                else pickType(e.target.value);
              }}
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
            >
              {types.map((ct) => (
                <option key={ct.id} value={ct.name}>
                  {ct.name}
                </option>
              ))}
              <option value="__custom">{tcom("add")}…</option>
            </select>
            {!types.some((x) => x.name === typeName) && (
              <Input
                value={typeName}
                onChange={(e) => setTypeName(e.target.value)}
                placeholder={t("typeName")}
                className="mt-1.5"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>{t("amount")} (€)</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t("date")}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>{t("status")}</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "pending" | "paid")}
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
            >
              <option value="pending">{t("statusPending")}</option>
              <option value="paid">{t("statusPaid")}</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t("notes")}</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tcom("cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null} {tcom("save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TypesModal({
  types,
  locale,
  onClose,
}: {
  types: TypeLite[];
  locale: string;
  onClose: () => void;
}) {
  const t = useTranslations("billing");
  const tcom = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState<number>(0);

  const run = (fn: () => Promise<unknown>, after?: () => void) =>
    start(async () => {
      await fn();
      router.refresh();
      after?.();
    });

  return (
    <Modal title={t("manageTypes")} onClose={onClose}>
      <div className="space-y-2">
        {types.map((ct) => (
          <TypeRow key={ct.id} type={ct} locale={locale} pending={pending} run={run} />
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          run(() => createConsultationTypeAction(locale, { name: newName.trim(), price: newPrice }), () => {
            setNewName("");
            setNewPrice(0);
          });
        }}
        className="mt-4 flex items-end gap-2 border-t border-border pt-4"
      >
        <div className="flex-1 space-y-1.5">
          <Label>{t("newType")}</Label>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("typeName")} />
        </div>
        <div className="w-24 space-y-1.5">
          <Label>{t("price")} (€)</Label>
          <Input
            type="number"
            step="0.01"
            value={newPrice}
            onChange={(e) => setNewPrice(Number(e.target.value) || 0)}
          />
        </div>
        <Button type="submit" size="icon" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Plus />}
        </Button>
      </form>
    </Modal>
  );
}

function TypeRow({
  type,
  locale,
  pending,
  run,
}: {
  type: TypeLite;
  locale: string;
  pending: boolean;
  run: (fn: () => Promise<unknown>, after?: () => void) => void;
}) {
  const tcom = useTranslations("common");
  const [name, setName] = useState(type.name);
  const [price, setPrice] = useState<number>(type.price);
  const dirty = name !== type.name || price !== type.price;

  return (
    <div className="flex items-center gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 flex-1" />
      <Input
        type="number"
        step="0.01"
        value={price}
        onChange={(e) => setPrice(Number(e.target.value) || 0)}
        className="h-8 w-20 text-right"
      />
      <Button
        variant="ghost"
        size="icon"
        disabled={pending || !dirty}
        onClick={() => run(() => updateConsultationTypeAction(locale, type.id, { name, price }))}
        aria-label={tcom("save")}
      >
        <Check className="size-4 text-brand" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={pending}
        onClick={() => run(() => deleteConsultationTypeAction(locale, type.id))}
        aria-label={tcom("delete")}
      >
        <Trash2 className="size-4 text-muted-foreground" />
      </Button>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
