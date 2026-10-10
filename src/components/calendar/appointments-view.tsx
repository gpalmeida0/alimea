"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Bell,
  BellOff,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  List,
  MessageSquare,
  Phone,
  Plus,
  RotateCcw,
  Send,
  Stethoscope,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback";
import { Field, Input, NumberInput, Select } from "@/components/ui/input";
import { Badge, EmptyState } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/tabs";
import { Link } from "@/i18n/routing";
import { useServerAction } from "@/hooks/use-server-action";
import { cn, formatDate, toLocalInput } from "@/lib/utils";
import {
  createAppointmentAction,
  deleteAppointmentAction,
  editAppointmentAction,
  processDueRemindersAction,
  sendReminderNowAction,
  setAppointmentStatusAction,
  startConsultationAction,
  toggleReminderAction,
} from "@/app/actions";

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
  preselectClientId?: string;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "YYYY-MM-DDT09:00" for a given local day — default time when booking from the grid. */
const dayAt = (d: Date, hour = 9) => toLocalInput(new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour).toISOString());

export function AppointmentsView(props: Props) {
  const t = useTranslations("appointments");
  const tr = useTranslations("reminders");
  const locale = useLocale();
  const { toast } = useFeedback();
  const { run, pending } = useServerAction();
  const now = useMemo(() => new Date(props.nowISO), [props.nowISO]);

  const [view, setView] = useState<"month" | "agenda">("month");
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ clientId?: string; date?: string } | null>(
    props.preselectClientId ? { clientId: props.preselectClientId } : null,
  );

  // Use the agenda on phones by default.
  useEffect(() => {
    if (window.matchMedia("(max-width: 640px)").matches) setView("agenda");
  }, []);

  // Always read the selected appointment from fresh props (never a stale copy).
  const selected = props.appointments.find((a) => a.id === selectedId) ?? null;

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7)); // Monday first
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [cursor]);

  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2024, 0, 1 + i)).replace(".", "").slice(0, 3),
      ),
    [locale],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, ApptVM[]>();
    for (const a of props.appointments) {
      const d = new Date(a.date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    for (const list of map.values()) list.sort((a, b) => a.date.localeCompare(b.date));
    return map;
  }, [props.appointments]);
  const apptsOn = (d: Date) => byDay.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) ?? [];

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const upcoming = props.appointments.filter((a) => a.status === "scheduled" && new Date(a.date) >= startOfToday);
  const dueCount = props.appointments.filter((a) => a.due).length;
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(cursor);
  const time = (iso: string) => formatDate(iso, locale, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {view === "month" && (
              <>
                <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label={t("prevMonth")}>
                  <ChevronLeft />
                </Button>
                <h2 className="min-w-36 text-center font-serif text-xl font-semibold first-letter:uppercase sm:min-w-48">{monthLabel}</h2>
                <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label={t("nextMonth")}>
                  <ChevronRight />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCursor(new Date(now.getFullYear(), now.getMonth(), 1))}>
                  {t("today")}
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Segmented
              value={view}
              onChange={setView}
              size="sm"
              items={[
                { value: "month", label: t("viewMonth"), icon: <CalendarDays /> },
                { value: "agenda", label: t("viewAgenda"), icon: <List /> },
              ]}
            />
            <Button onClick={() => setDraft({})}>
              <Plus /> {t("new")}
            </Button>
          </div>
        </div>

        {view === "month" ? (
          <>
            <div className="card-surface overflow-hidden">
              <div className="grid grid-cols-7 border-b border-border bg-muted/50">
                {weekdays.map((w) => (
                  <div key={w} className="px-1 py-2 text-center text-xs font-medium capitalize text-muted-foreground">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((d, i) => {
                  const inMonth = d.getMonth() === cursor.getMonth();
                  const isToday = sameDay(d, now);
                  const list = apptsOn(d);
                  return (
                    <div
                      key={i}
                      className={cn(
                        "group relative min-h-20 border-b border-r border-border p-1 sm:min-h-28 sm:p-1.5",
                        !inMonth && "bg-muted/30 text-muted-foreground",
                        i % 7 === 6 && "border-r-0",
                        i >= 35 && "border-b-0",
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setDraft({ date: dayAt(d) })}
                          className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100"
                          aria-label={t("newOn", { date: d.toLocaleDateString(locale) })}
                        >
                          <Plus className="size-3.5" />
                        </button>
                        <span className={cn("flex size-6 items-center justify-center rounded-full text-xs", isToday && "bg-brand font-semibold text-white")}>
                          {d.getDate()}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {list.slice(0, 3).map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setSelectedId(a.id)}
                            className={cn(
                              "flex w-full items-center gap-1 truncate rounded px-1.5 py-1 text-left text-[11px] transition-colors",
                              a.status === "cancelled"
                                ? "bg-muted text-muted-foreground line-through"
                                : a.status === "completed"
                                  ? "bg-muted text-foreground"
                                  : "bg-brand-50 text-brand-700 hover:bg-brand-100",
                            )}
                          >
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full",
                                a.reminderSentAt ? "bg-brand" : a.due ? "bg-accent" : "bg-brand-200",
                              )}
                            />
                            <span className="truncate">
                              <span className="hidden sm:inline">{time(a.date)} </span>
                              {a.clientName.split(" ")[0]}
                            </span>
                          </button>
                        ))}
                        {list.length > 3 && (
                          <button type="button" onClick={() => setView("agenda")} className="px-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                            +{list.length - 3}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand-200" /> {tr("scheduled")}</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" /> {tr("due")}</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand" /> {tr("sent")}</span>
            </div>
          </>
        ) : (
          <Agenda appointments={upcoming} locale={locale} onSelect={setSelectedId} onNew={() => setDraft({})} />
        )}
      </div>

      {/* Reminders panel */}
      <div className="grid gap-4 md:grid-cols-2 xl:block xl:space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="size-4 text-brand" /> {tr("title")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{tr("subtitle")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {!props.smsConfigured && <p className="rounded-md bg-accent/10 px-3 py-2 text-xs text-accent-700">{tr("previewMode")}</p>}
            <Button
              className="w-full"
              variant={dueCount ? "default" : "outline"}
              loading={pending}
              onClick={() =>
                run(() => processDueRemindersAction(locale), {
                  onDone: (s) =>
                    toast(
                      s.processed === 0 ? tr("processedNone") : tr("processedCount", { count: s.processed }),
                      s.failed ? "error" : "success",
                    ),
                })
              }
            >
              <Send /> {tr("processDue")}
              {dueCount > 0 && <span className="rounded-full bg-white/20 px-1.5 text-[11px]">{dueCount}</span>}
            </Button>
            <p className="text-xs text-muted-foreground">{tr("cronHint")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("upcoming")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">{t("noItems")}</p>}
            {upcoming.slice(0, 6).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedId(a.id)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(a.date, locale, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <ReminderIcon a={a} />
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
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium">{m.clientName}</span>
                  <Badge variant={m.status === "failed" ? "destructive" : m.status === "sent" ? "default" : "muted"}>
                    {tr(`status.${m.status}`)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{m.body}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {m.to} · {formatDate(m.createdAt, locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {draft && (
        <AppointmentForm
          clients={props.clients}
          initial={draft}
          pending={pending}
          onClose={() => setDraft(null)}
          onSubmit={(data) =>
            run(() => createAppointmentAction(locale, data), { success: t("created"), onDone: () => setDraft(null) })
          }
        />
      )}

      {selected && (
        <AppointmentDetails appt={selected} clients={props.clients} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

function ReminderIcon({ a }: { a: ApptVM }) {
  const tr = useTranslations("reminders");
  if (a.reminderSentAt)
    return (
      <Badge>
        <Check className="size-3" /> {tr("sentShort")}
      </Badge>
    );
  if (a.due) return <Badge variant="accent">{tr("dueShort")}</Badge>;
  return a.reminderEnabled ? (
    <Bell className="size-4 shrink-0 text-muted-foreground" aria-label={tr("enabled")} />
  ) : (
    <BellOff className="size-4 shrink-0 text-muted-foreground" aria-label={tr("disabled")} />
  );
}

function Agenda({
  appointments,
  locale,
  onSelect,
  onNew,
}: {
  appointments: ApptVM[];
  locale: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const t = useTranslations("appointments");
  if (!appointments.length) {
    return (
      <EmptyState
        icon={<CalendarDays />}
        title={t("noItems")}
        action={
          <Button size="sm" onClick={onNew}>
            <Plus /> {t("new")}
          </Button>
        }
      />
    );
  }
  const groups = new Map<string, ApptVM[]>();
  for (const a of appointments) {
    const key = new Date(a.date).toDateString();
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  return (
    <div className="space-y-4">
      {[...groups.values()].map((list) => (
        <div key={list[0].id}>
          <p className="mb-2 text-sm font-medium text-muted-foreground first-letter:uppercase">
            {formatDate(list[0].date, locale, { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <div className="card-surface divide-y divide-border overflow-hidden">
            {list.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onSelect(a.id)}
                className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-muted/50"
              >
                <span className="w-12 font-serif text-lg font-semibold lining-nums tabular-nums">
                  {formatDate(a.date, locale, { hour: "2-digit", minute: "2-digit" })}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.clientName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.durationMin} min{a.note ? ` · ${a.note}` : ""}
                  </p>
                </div>
                <ReminderIcon a={a} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AppointmentForm({
  clients,
  initial,
  onSubmit,
  onClose,
  pending,
  editing,
}: {
  clients: { id: string; name: string; phone?: string }[];
  initial: { clientId?: string; date?: string; durationMin?: number; note?: string; reminderEnabled?: boolean };
  onSubmit: (data: { clientId: string; date: string; durationMin: number; note?: string; reminderEnabled: boolean }) => void;
  onClose: () => void;
  pending: boolean;
  editing?: boolean;
}) {
  const t = useTranslations("appointments");
  const tr = useTranslations("reminders");
  const tc = useTranslations("common");
  const [clientId, setClientId] = useState(initial.clientId ?? "");
  const [date, setDate] = useState(initial.date ?? "");
  const [duration, setDuration] = useState<number | undefined>(initial.durationMin ?? 45);
  const [note, setNote] = useState(initial.note ?? "");
  const [reminder, setReminder] = useState(initial.reminderEnabled ?? true);
  const client = clients.find((c) => c.id === clientId);
  const inPast = date && new Date(date).getTime() < Date.now();

  return (
    <Dialog title={editing ? t("editTitle") : t("createTitle")} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!clientId || !date) return;
          // Convert the local wall-clock time to an absolute instant here, in the
          // browser's time zone — never on the (UTC) server.
          onSubmit({ clientId, date: new Date(date).toISOString(), durationMin: duration ?? 45, note: note.trim() || undefined, reminderEnabled: reminder });
        }}
      >
        {!editing && (
          <Field label={t("client")} htmlFor="appt-client" hint={clientId ? (client?.phone ? `☎ ${client.phone}` : tr("noPhone")) : undefined}>
            <Select id="appt-client" required value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">{t("selectClient")}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label={t("dateTime")} htmlFor="appt-date" hint={inPast ? t("inPast") : undefined}>
            <Input id="appt-date" type="datetime-local" required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t("duration")} htmlFor="appt-duration">
            <NumberInput id="appt-duration" value={duration} onValueChange={setDuration} min={5} max={600} />
          </Field>
        </div>
        <Field label={t("note")} htmlFor="appt-note">
          <Input id="appt-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
        {!editing && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={reminder} onChange={(e) => setReminder(e.target.checked)} className="size-4 accent-brand" />
            {tr("auto")}
          </label>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" loading={pending} disabled={!clientId || !date}>
            {tc("save")}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function AppointmentDetails({
  appt,
  clients,
  onClose,
}: {
  appt: ApptVM;
  clients: { id: string; name: string; phone?: string }[];
  onClose: () => void;
}) {
  const t = useTranslations("appointments");
  const tr = useTranslations("reminders");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast, confirm } = useFeedback();
  const { run, pending } = useServerAction();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <AppointmentForm
        editing
        clients={clients}
        initial={{ clientId: appt.clientId, date: toLocalInput(appt.date), durationMin: appt.durationMin, note: appt.note }}
        pending={pending}
        onClose={() => setEditing(false)}
        onSubmit={(data) =>
          run(() => editAppointmentAction(locale, appt.id, data), { success: tc("saved"), onDone: () => setEditing(false) })
        }
      />
    );
  }

  const scheduled = appt.status === "scheduled";

  return (
    <Dialog
      title={appt.clientName}
      description={
        <>
          <span className="inline-block first-letter:uppercase">
            {formatDate(appt.date, locale, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
          </span>{" "}
          · {appt.durationMin} min
        </>
      }
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={appt.status === "cancelled" ? "destructive" : appt.status === "completed" ? "muted" : "default"}>
            {t(`status.${appt.status}`)}
          </Badge>
          {appt.clientPhone ? (
            <a href={`tel:${appt.clientPhone.replace(/\s/g, "")}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Phone className="size-3" /> {appt.clientPhone}
            </a>
          ) : (
            <span className="text-xs text-accent-700">{tr("noPhone")}</span>
          )}
        </div>
        {appt.note && <p className="rounded-md bg-muted/60 px-3 py-2 text-sm">{appt.note}</p>}

        {scheduled && (
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Bell className="size-4 text-brand" /> {tr("title")}
              </span>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4 accent-brand"
                  checked={appt.reminderEnabled}
                  disabled={pending}
                  onChange={(e) => run(() => toggleReminderAction(locale, appt.id, e.target.checked))}
                />
                {appt.reminderEnabled ? tr("enabled") : tr("disabled")}
              </label>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {appt.reminderSentAt
                ? tr("sentAt", { date: formatDate(appt.reminderSentAt, locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) })
                : appt.due
                  ? tr("due")
                  : tr("scheduled")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              disabled={!appt.clientPhone}
              loading={pending}
              onClick={() =>
                run(() => sendReminderNowAction(locale, appt.id), {
                  onDone: (o) =>
                    toast(
                      o?.status === "failed" ? `${tr("failed")}${o.error ? `: ${o.error}` : ""}` : tr("sentNow"),
                      o?.status === "failed" ? "error" : "success",
                    ),
                })
              }
            >
              <Send /> {appt.reminderSentAt ? tr("resend") : tr("sendNow")}
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Link href={`/clients/${appt.clientId}`} className="flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
            <User className="size-4" /> {t("openClient")}
          </Link>
          {scheduled ? (
            <Button
              variant="secondary"
              onClick={() =>
                run(async () => {
                  await setAppointmentStatusAction(locale, appt.id, "completed");
                  await startConsultationAction(locale, appt.clientId, { duplicateLast: true });
                })
              }
              loading={pending}
            >
              <Stethoscope /> {t("startConsultation")}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => run(() => setAppointmentStatusAction(locale, appt.id, "scheduled"))} loading={pending}>
              <RotateCcw /> {t("reopen")}
            </Button>
          )}
        </div>

        <DialogFooter className="justify-between border-t border-border pt-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            onClick={async () => {
              if (await confirm({ title: t("deleteTitle"), body: t("deleteBody"), destructive: true })) {
                run(() => deleteAppointmentAction(locale, appt.id), { success: tc("deleted"), onDone: onClose });
              }
            }}
          >
            <Trash2 /> {tc("delete")}
          </Button>
          <div className="flex flex-wrap gap-2">
            {scheduled && (
              <>
                <Button variant="ghost" size="sm" onClick={() => run(() => setAppointmentStatusAction(locale, appt.id, "cancelled"))}>
                  <X /> {t("markCancelled")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => run(() => setAppointmentStatusAction(locale, appt.id, "completed"))}>
                  <Check /> {t("markCompleted")}
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              {tc("edit")}
            </Button>
          </div>
        </DialogFooter>
      </div>
    </Dialog>
  );
}
