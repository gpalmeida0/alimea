"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Download, Pencil, Plus, Receipt, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback";
import { Field, Input, NumberInput, Select, Textarea } from "@/components/ui/input";
import { Badge, EmptyState } from "@/components/ui/misc";
import { useServerAction } from "@/hooks/use-server-action";
import { formatDate, todayISO } from "@/lib/utils";
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

interface EntryData {
  clientId?: string;
  clientName: string;
  typeName: string;
  amount: number;
  date: string;
  status: "pending" | "paid";
  notes?: string;
}

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

export function BillingManager({
  entries,
  types,
  clients,
}: {
  entries: BillingEntry[];
  types: TypeLite[];
  clients: { id: string; name: string }[];
}) {
  const t = useTranslations("billing");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { confirm } = useFeedback();
  const { run, pending } = useServerAction();
  const [status, setStatus] = useState<"all" | "pending" | "paid">("all");
  const [month, setMonth] = useState<string>("all");
  const [dialog, setDialog] = useState<{ kind: "new" } | { kind: "edit"; entry: BillingEntry } | { kind: "types" } | null>(null);

  const eur = useMemo(
    () => new Intl.NumberFormat(locale === "en" ? "en-IE" : "pt-PT", { style: "currency", currency: "EUR" }),
    [locale],
  );

  const months = useMemo(() => [...new Set(entries.map((e) => e.date.slice(0, 7)))].sort().reverse(), [entries]);
  const visible = entries.filter((e) => (status === "all" || e.status === status) && (month === "all" || e.date.startsWith(month)));

  const total = visible.reduce((sum, e) => sum + e.amount, 0);

  function exportCsv() {
    const header = [t("date"), t("client"), t("type"), t("amount"), t("status"), t("notes")];
    const rows = visible.map((e) => [e.date, e.clientName, e.typeName, e.amount.toFixed(2), e.status === "paid" ? t("statusPaid") : t("statusPending"), e.notes ?? ""]);
    const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `alimea-${t("fileName")}-${month === "all" ? todayISO() : month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const monthLabel = (ym: string) =>
    formatDate(`${ym}-01`, locale, { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl font-semibold">{t("entries")}</h2>
        <p className="text-sm text-muted-foreground">{t("entriesSummary", { count: visible.length, total: eur.format(total) })}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-auto" aria-label={t("status")}>
            <option value="all">{t("allStatuses")}</option>
            <option value="pending">{t("statusPending")}</option>
            <option value="paid">{t("statusPaid")}</option>
          </Select>
          <Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" aria-label={t("month")}>
            <option value="all">{t("allMonths")}</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!visible.length}>
            <Download /> CSV
          </Button>
          <Button variant="outline" onClick={() => setDialog({ kind: "types" })}>
            <Settings2 /> {t("manageTypes")}
          </Button>
          <Button onClick={() => setDialog({ kind: "new" })}>
            <Plus /> {t("addEntry")}
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={<Receipt />} title={t("noEntries")} description={t("noEntriesHint")} />
      ) : (
        <div className="card-surface divide-y divide-border overflow-hidden">
          {visible.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{e.clientName || "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(e.date, locale)} · {e.typeName || "—"}
                  {e.source === "auto" ? ` · ${t("fromConsultation")}` : ""}
                  {e.notes ? ` · ${e.notes}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="font-serif text-lg font-semibold lining-nums tabular-nums">{eur.format(e.amount)}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => updateBillingEntryAction(locale, e.id, { status: e.status === "paid" ? "pending" : "paid" }))}
                  title={e.status === "paid" ? t("markPending") : t("markPaid")}
                  className="disabled:opacity-50"
                >
                  {e.status === "paid" ? (
                    <Badge>
                      <Check className="size-3" /> {t("statusPaid")}
                    </Badge>
                  ) : (
                    <Badge variant="accent">{t("statusPending")}</Badge>
                  )}
                </button>
                <Button variant="ghost" size="icon-sm" onClick={() => setDialog({ kind: "edit", entry: e })} aria-label={tc("edit")}>
                  <Pencil className="text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={tc("delete")}
                  onClick={async () => {
                    if (await confirm({ title: t("deleteTitle"), body: `${e.clientName} · ${eur.format(e.amount)}`, destructive: true })) {
                      run(() => deleteBillingEntryAction(locale, e.id), { success: tc("deleted") });
                    }
                  }}
                >
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(dialog?.kind === "new" || dialog?.kind === "edit") && (
        <EntryDialog
          types={types}
          clients={clients}
          initial={dialog.kind === "edit" ? dialog.entry : undefined}
          pending={pending}
          onClose={() => setDialog(null)}
          onSubmit={(data) =>
            run(
              () =>
                dialog.kind === "edit"
                  ? updateBillingEntryAction(locale, dialog.entry.id, {
                      clientName: data.clientName,
                      typeName: data.typeName,
                      amount: data.amount,
                      date: data.date,
                      status: data.status,
                      notes: data.notes,
                    })
                  : createBillingEntryAction(locale, data),
              { success: tc("saved"), onDone: () => setDialog(null) },
            )
          }
        />
      )}
      {dialog?.kind === "types" && <TypesDialog types={types} onClose={() => setDialog(null)} />}
    </div>
  );
}

function EntryDialog({
  types,
  clients,
  initial,
  onClose,
  onSubmit,
  pending,
}: {
  types: TypeLite[];
  clients: { id: string; name: string }[];
  initial?: BillingEntry;
  onClose: () => void;
  onSubmit: (data: EntryData) => void;
  pending: boolean;
}) {
  const t = useTranslations("billing");
  const tc = useTranslations("common");
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [clientName, setClientName] = useState(initial?.clientName ?? "");
  const [typeName, setTypeName] = useState(initial?.typeName ?? types[0]?.name ?? "");
  const [custom, setCustom] = useState(Boolean(initial && !types.some((x) => x.name === initial.typeName)));
  const [amount, setAmount] = useState<number | undefined>(initial?.amount ?? types[0]?.price ?? 0);
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [status, setStatus] = useState<"pending" | "paid">(initial?.status ?? "pending");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <Dialog title={initial ? t("editTitle") : t("createTitle")} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ clientId: clientId || undefined, clientName: clientName.trim(), typeName: typeName.trim(), amount: amount ?? 0, date, status, notes: notes.trim() || undefined });
        }}
      >
        {!initial?.clientId && clients.length > 0 && (
          <Field label={t("client")} htmlFor="b-client">
            <Select
              id="b-client"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                const c = clients.find((x) => x.id === e.target.value);
                if (c) setClientName(c.name);
              }}
            >
              <option value="">{t("otherClient")}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {(!clientId || initial) && (
          <Field label={t("clientName")} htmlFor="b-name">
            <Input id="b-name" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("type")} htmlFor="b-type">
            <Select
              id="b-type"
              value={custom ? "__custom" : typeName}
              onChange={(e) => {
                if (e.target.value === "__custom") {
                  setCustom(true);
                  setTypeName("");
                } else {
                  setCustom(false);
                  setTypeName(e.target.value);
                  const ct = types.find((x) => x.name === e.target.value);
                  if (ct) setAmount(ct.price);
                }
              }}
            >
              {types.map((ct) => (
                <option key={ct.id} value={ct.name}>
                  {ct.name}
                </option>
              ))}
              <option value="__custom">{t("customType")}</option>
            </Select>
            {custom && <Input value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder={t("typeName")} className="mt-1.5" autoFocus />}
          </Field>
          <Field label={`${t("amount")} (€)`} htmlFor="b-amount">
            <NumberInput id="b-amount" value={amount} onValueChange={setAmount} min={0} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("date")} htmlFor="b-date">
            <Input id="b-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label={t("status")} htmlFor="b-status">
            <Select id="b-status" value={status} onChange={(e) => setStatus(e.target.value as "pending" | "paid")}>
              <option value="pending">{t("statusPending")}</option>
              <option value="paid">{t("statusPaid")}</option>
            </Select>
          </Field>
        </div>
        <Field label={t("notes")} htmlFor="b-notes">
          <Textarea id="b-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" loading={pending}>
            {tc("save")}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function TypesDialog({ types, onClose }: { types: TypeLite[]; onClose: () => void }) {
  const t = useTranslations("billing");
  const locale = useLocale();
  const { run, pending } = useServerAction();
  const { confirm } = useFeedback();
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState<number | undefined>(undefined);

  return (
    <Dialog title={t("manageTypes")} description={t("typesHint")} onClose={onClose}>
      <div className="space-y-2">
        {types.map((ct) => (
          <TypeRow
            key={`${ct.id}-${ct.name}-${ct.price}`}
            type={ct}
            pending={pending}
            onSave={(patch) => run(() => updateConsultationTypeAction(locale, ct.id, patch))}
            onDelete={async () => {
              if (await confirm({ title: t("deleteTypeTitle", { name: ct.name }), body: t("deleteTypeBody"), destructive: true })) {
                run(() => deleteConsultationTypeAction(locale, ct.id));
              }
            }}
          />
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          run(() => createConsultationTypeAction(locale, { name: newName.trim(), price: newPrice ?? 0 }), {
            onDone: () => {
              setNewName("");
              setNewPrice(undefined);
            },
          });
        }}
        className="mt-4 flex items-end gap-2 border-t border-border pt-4"
      >
        <Field label={t("newType")} htmlFor="nt-name" className="flex-1">
          <Input id="nt-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("typeName")} />
        </Field>
        <Field label={`${t("price")} (€)`} htmlFor="nt-price" className="w-24">
          <NumberInput id="nt-price" value={newPrice} onValueChange={setNewPrice} min={0} />
        </Field>
        <Button type="submit" size="icon" loading={pending} disabled={!newName.trim()} aria-label={t("newType")}>
          <Plus />
        </Button>
      </form>
    </Dialog>
  );
}

function TypeRow({
  type,
  pending,
  onSave,
  onDelete,
}: {
  type: TypeLite;
  pending: boolean;
  onSave: (patch: { name: string; price: number }) => void;
  onDelete: () => void;
}) {
  const tc = useTranslations("common");
  const [name, setName] = useState(type.name);
  const [price, setPrice] = useState<number | undefined>(type.price);
  const dirty = name.trim() !== type.name || (price ?? 0) !== type.price;
  return (
    <div className="flex items-center gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 flex-1" aria-label={tc("name")} />
      <NumberInput value={price} onValueChange={setPrice} className="h-8 w-20 text-right" min={0} aria-label="€" />
      <Button variant="ghost" size="icon-sm" disabled={pending || !dirty || !name.trim()} onClick={() => onSave({ name: name.trim(), price: price ?? 0 })} aria-label={tc("save")}>
        <Check className="text-brand" />
      </Button>
      <Button variant="ghost" size="icon-sm" disabled={pending} onClick={onDelete} aria-label={tc("delete")}>
        <Trash2 className="text-muted-foreground" />
      </Button>
    </div>
  );
}
