"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Bell,
  BellOff,
  Check,
  Send,
  Loader2,
  X,
  MessageSquare,
  Phone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { cn, formatDate } from "@/lib/utils";
import {
  createAppointmentAction,
  editAppointmentAction,
  processDueRemindersAction,
  sendReminderNowAction,
  setAppointmentStatusAction,
  toggleReminderAction,
} from "@/app/actions";

/** ISO → "YYYY-MM-DDTHH:mm" in local time, for <input type="datetime-local">. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface ApptVM {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone?: string;
  date: string;
  durationMin: number;
  note?: string;
  status: "scheduled" | "completed" | "cancelled";
  reminderEnabled: boolean;
  reminderSentAt?: string;
  due: boolean;
}

export interface MsgVM {
  id: string;
  clientName: string;
  to: string;
  body: string;
  status: string;
  createdAt: string;
}

interface Props {
  appointments: ApptVM[];
  clients: { id: string; name: string; phone?: string }[];
  messages: MsgVM[];
  smsConfigured: boolean;
  nowISO: string;
  locale: string;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function AppointmentsView(props: Props) {
  const t = useTranslations("appointments");
  const tr = useTranslations("reminders");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const now = useMemo(() => new Date(props.nowISO), [props.nowISO]);

  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState<ApptVM | null>(null);
  const [editing, setEditing] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newClientId, setNewClientId] = useState("");
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);

  const refresh = () => router.refresh();

  // Build a 6-week (Mon-first) grid for the cursor month.
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday = 0
    const start = new Date(first);
    start.setDate(first.getDate() - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const weekdays = useMemo(() => {
    const monday = new Date(2024, 0, 1); // a Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
    });
  }, [locale]);

  const apptsByDay = (d: Date) =>
    props.appointments
      .filter((a) => sameDay(new Date(a.date), d))
      .sort((a, b) => a.date.localeCompare(b.date));

  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(cursor);

  const upcoming = props.appointments
    .filter((a) => new Date(a.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && a.status === "scheduled")
    .slice(0, 6);

  function run(fn: () => Promise<unknown>, after?: () => void) {
    startTransition(async () => {
      await fn();
      refresh();
      after?.();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* Calendar */}
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              <ChevronLeft />
            </Button>
            <h2 className="min-w-32 text-center font-serif text-lg font-semibold capitalize sm:min-w-44 sm:text-xl">
              {monthLabel}
            </h2>
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              <ChevronRight />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCursor(new Date(now.getFullYear(), now.getMonth(), 1))}>
              {t("today")}
            </Button>
          </div>
          <Button onClick={() => setShowNew(true)}>
            <Plus /> {t("new")}
          </Button>
        </div>

        <div className="card-surface overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-muted/50">
            {weekdays.map((w) => (
              <div key={w} className="px-2 py-2 text-center text-xs font-medium capitalize text-muted-foreground">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              const inMonth = d.getMonth() === cursor.getMonth();
              const isToday = sameDay(d, now);
              const dayAppts = apptsByDay(d);
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-16 border-b border-r border-border p-1 last:border-r-0 sm:min-h-24 sm:p-1.5",
                    !inMonth && "bg-muted/30 text-muted-foreground",
                    i % 7 === 6 && "border-r-0",
                  )}
                >
                  <div className="mb-1 flex justify-end">
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs",
                        isToday && "bg-brand font-semibold text-white",
                      )}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayAppts.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setSelected(a)}
                        className={cn(
                          "flex w-full items-center gap-1 truncate rounded px-1.5 py-1 text-left text-[11px] transition-colors",
                          a.status === "cancelled"
                            ? "bg-muted text-muted-foreground line-through"
                            : "bg-brand-50 text-brand-600 hover:bg-brand-100",
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            a.reminderSentAt
                              ? "bg-brand"
                              : a.due
                                ? "bg-accent"
                                : "bg-secondary",
                          )}
                          title={a.reminderSentAt ? tr("sent") : a.due ? tr("due") : tr("scheduled")}
                        />
                        <span className="truncate">
                          {formatDate(a.date, locale, { hour: "2-digit", minute: "2-digit" })} {a.clientName.split(" ")[0]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-secondary" /> {tr("scheduled")}</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-accent" /> {tr("due")}</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-brand" /> {tr("sent")}</span>
        </div>
      </div>

      {/* Reminders panel */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="size-4 text-brand" /> {tr("title")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{tr("subtitle")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {!props.smsConfigured && (
              <p className="rounded-md bg-accent/10 px-3 py-2 text-xs text-accent">{tr("previewMode")}</p>
            )}
            <Button
              className="w-full"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const summary = await processDueRemindersAction(locale);
                  setFlash(
                    summary.processed === 0
                      ? tr("processedNone")
                      : tr("processedCount", { count: summary.processed }),
                  );
                  refresh();
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <Send />} {tr("processDue")}
            </Button>
            {flash && <p className="text-center text-xs text-brand-600">{flash}</p>}
            <p className="text-xs italic text-muted-foreground">{tr("secretary")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("upcoming")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">{t("noItems")}</p>}
            {upcoming.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelected(a)}
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
              >
                <div>
                  <p className="font-medium">{a.clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(a.date, locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {a.reminderSentAt ? (
                  <Badge><Check className="mr-1 size-3" /> {tr("sent")}</Badge>
                ) : a.due ? (
                  <Badge variant="accent">{tr("due")}</Badge>
                ) : a.reminderEnabled ? (
                  <Bell className="size-4 text-muted-foreground" />
                ) : (
                  <BellOff className="size-4 text-muted-foreground" />
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="size-4 text-brand" /> {tr("outbox")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {props.messages.length === 0 && <p className="text-sm text-muted-foreground">{tr("noMessages")}</p>}
            {props.messages.slice(0, 5).map((m) => (
              <div key={m.id} className="rounded-md border border-border p-2.5">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">{m.clientName}</span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="size-3" /> {m.to}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{m.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* New appointment modal */}
      {showNew && (
        <Modal title={t("createTitle")} onClose={() => setShowNew(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(() => createAppointmentAction(locale, fd), () => setShowNew(false));
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label>{t("client")}</Label>
              <select
                name="clientId"
                required
                value={newClientId}
                onChange={(e) => setNewClientId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
              >
                <option value="">{t("selectClient")}</option>
                {props.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {newClientId &&
                (props.clients.find((c) => c.id === newClientId)?.phone ? (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="size-3" /> {props.clients.find((c) => c.id === newClientId)?.phone}
                  </p>
                ) : (
                  <p className="text-xs text-accent">{tr("noPhone")}</p>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("dateTime")}</Label>
                <Input type="datetime-local" name="date" required />
              </div>
              <div className="space-y-1.5">
                <Label>{t("duration")}</Label>
                <Input type="number" name="durationMin" defaultValue={45} step={5} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("note")}</Label>
              <Input name="note" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="reminderEnabled" defaultChecked className="size-4 accent-[#2E7D32]" />
              {tr("auto")}
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowNew(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : null} {tc("save")}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Appointment details modal */}
      {selected && (
        <Modal title={t("details")} onClose={() => { setSelected(null); setEditing(false); }}>
          <div className="space-y-4">
            <div>
              <div className="flex items-start justify-between">
                <p className="font-serif text-xl font-semibold">{selected.clientName}</p>
                <button
                  onClick={() => setEditing((v) => !v)}
                  className="text-xs text-brand-600 hover:underline"
                >
                  {editing ? tc("cancel") : tc("edit")}
                </button>
              </div>
              {editing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    run(() => editAppointmentAction(locale, selected.id, fd), () => {
                      setEditing(false);
                      setSelected(null);
                    });
                  }}
                  className="mt-2 space-y-3"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>{t("dateTime")}</Label>
                      <Input type="datetime-local" name="date" defaultValue={toLocalInput(selected.date)} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("duration")}</Label>
                      <Input type="number" name="durationMin" defaultValue={selected.durationMin} step={5} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("note")}</Label>
                    <Input name="note" defaultValue={selected.note ?? ""} />
                  </div>
                  <Button type="submit" size="sm" className="w-full" disabled={pending}>
                    {pending ? <Loader2 className="animate-spin" /> : <Check />} {tc("save")}
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {formatDate(selected.date, locale, {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {selected.durationMin} min
                </p>
              )}
              {!editing && selected.note && <p className="mt-1 text-sm">{selected.note}</p>}
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="muted">{t(`status.${selected.status}`)}</Badge>
                {selected.clientPhone ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="size-3" /> {selected.clientPhone}
                  </span>
                ) : (
                  <span className="text-xs text-accent">{tr("noPhone")}</span>
                )}
              </div>
            </div>

            {/* Reminder status + actions */}
            <div className="rounded-md border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Bell className="size-4 text-brand" /> {tr("title")}
                </span>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => run(() => toggleReminderAction(locale, selected.id, !selected.reminderEnabled))}
                >
                  {selected.reminderEnabled ? tr("enabled") : tr("disabled")}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {selected.reminderSentAt
                  ? tr("sentAt", { date: formatDate(selected.reminderSentAt, locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) })
                  : selected.due
                    ? tr("due")
                    : tr("scheduled")}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                disabled={pending || !selected.clientPhone}
                onClick={() =>
                  run(
                    async () => {
                      await sendReminderNowAction(locale, selected.id);
                    },
                    () => setSelected(null),
                  )
                }
              >
                {pending ? <Loader2 className="animate-spin" /> : <Send />} {tr("sendNow")}
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => run(() => setAppointmentStatusAction(locale, selected.id, "completed"), () => setSelected(null))}
              >
                <Check /> {t("markCompleted")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-destructive"
                onClick={() => run(() => setAppointmentStatusAction(locale, selected.id, "cancelled"), () => setSelected(null))}
              >
                <X /> {t("markCancelled")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
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
