# Alimea

**Produtividade clínica para nutricionistas** — a SaaS that automates the
administrative work around meal plans, clinical documentation and client
follow-up, so the nutritionist keeps full clinical control while spending far
less time on repetitive tasks.

> Core principle: **any information entered once is reused everywhere it can be.**
> Smart duplication, reusable templates, autocomplete, contextual suggestions,
> minimal clicks.

## Highlights

- 🇵🇹 / 🇬🇧 **Full bilingual support** — the entire UI is translatable (next-intl,
  `pt-PT` default + `en`) and **the plan language is chosen independently**: the
  generated PDF and AI text follow the language the nutritionist selects.
- 📄 **Template-faithful PDF engine** — reproduces the supplied
  `template/template_plano_alimentar.pdf` layout (cover, measurements sheet, meal
  pages, supplementation/notes, back cover) using `pdf-lib` with the original
  typefaces (Cormorant SC + Caudex). Branding (logo, name, licence, contacts) is
  per-nutritionist, so it works for any clinic.
- ⚡ **Productivity-first flow** — open client → duplicate last consultation
  (pre-fills measurements + clones the previous plan) → adjust → choose language →
  **Gerar Plano** → PDF in seconds.
- 🔁 **Reuse everywhere** — reusable multilingual recommendation blocks, internal
  plan templates, smart plan/consultation duplication, history-based autocomplete.
- 🤖 **Non-autonomous AI assistant** — translate / improve / summarise text the
  nutritionist already wrote. It never creates plans or makes clinical decisions.
- 📅 **Calendar + automatic SMS reminders** — a month calendar of every
  appointment, with a reminder sent to the client **by SMS 1 day before** —
  replacing the secretary's reminder calls. Runs in preview mode (in-app outbox)
  with zero setup; add Twilio for real delivery.
- 📊 Dashboard, weight/BMI evolution charts, consultation comparison, command
  palette (⌘K), fixed sidebar, premium minimalist identity.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn-style components ·
next-intl · pdf-lib · Supabase/PostgreSQL (optional) · OpenAI (optional).

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000  → redirects to /pt-PT
```

The app **runs out of the box** with an in-memory data store seeded with a
realistic Portuguese clinic (Eduarda Carvalho + clients/consultations/plans), so
you can explore the full flow immediately. Switch language with the PT/EN toggle
top-right.

Useful scripts:

```bash
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run pdf:sample # generate a sample PDF to /tmp from the seed data
```

## Project structure

```
src/
  app/[locale]/            Localised App Router pages (dashboard, clients, plans, …)
  app/api/pdf/[planId]/    PDF generation endpoint (?lang=pt-PT|en)
  app/api/ai/              Non-autonomous AI assistant endpoint
  app/actions.ts           Server actions (CRUD, start consultation, save plan)
  components/              UI + shell (sidebar, command palette) + plan editor
  i18n/                    next-intl routing/request config
  lib/data/                Repository API + in-memory store + seed
  lib/pdf/                 Template engine (generate.ts, fonts.ts, labels.ts) + fonts
  lib/supabase/            Supabase client setup (production backend)
  lib/types.ts             Domain model (shared by data layer, UI and PDF)
messages/                  pt-PT.json / en.json translations
supabase/migrations/       0001_init.sql — full schema + RLS (multi-tenant)
template/                  The reference PDF supplied by the nutritionist
public/pdf-assets/         Default clinic logo used on PDFs
```

## The template engine

`src/lib/pdf/generate.ts` rebuilds the template's six-page design on A4 with the
sampled palette (cream `#F4F1EE`, ink `#4A4A4A`, taupe `#B49D8A`) and the
original fonts. Dynamic fields — client name, measurements (with a comparison
column vs. the previous consultation), meals & options, supplementation, notes,
motivational quote, next appointment, and the nutritionist's branding — are
filled in the selected language. Clinical labels live in `labels.ts` per language.

## Switching to Supabase (production)

1. `supabase db push` (or run `supabase/migrations/0001_init.sql`) — creates all
   tables with row-level security scoped to `auth.uid()` (one tenant per
   nutritionist) and a trigger that provisions a profile on sign-up.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see
   `.env.example`).
3. The repository API in `src/lib/data/repo.ts` is the single data boundary —
   point it at `src/lib/supabase/server.ts`. The SQL schema already matches the
   types in `src/lib/types.ts`.

Set `OPENAI_API_KEY` to enable the AI assistant; without it, AI actions return
the input text unchanged.

## Appointment reminders (SMS)

- The **calendar** lives at `/[locale]/appointments`: month view, create
  appointments, per-appointment reminder status, manual "send now", and an SMS
  outbox. Reminder state per appointment: 🟢 sent · 🟠 due (within 24h) · 🟢 scheduled.
- The engine (`src/lib/messaging/reminders.ts`) sends a localized SMS **once,
  within the 24h before** each scheduled appointment (idempotent).
- **Channel:** SMS via `src/lib/messaging/sms.ts`. Default is a preview provider
  (logs to the in-app outbox); set `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` /
  `TWILIO_FROM` to send real messages — no extra dependency, the Twilio REST API
  is called with `fetch`.
- **Scheduling:** hit `GET /api/cron/reminders` once a day.
  - On Vercel, `vercel.json` already registers a daily cron (09:00).
  - Self-hosted: a system crontab line, Supabase `pg_cron`, or a GitHub Action.
  - Set `CRON_SECRET` to require `Authorization: Bearer <CRON_SECRET>` on the endpoint.

```bash
# manual run (preview mode prints the SMS it would send)
curl http://localhost:3000/api/cron/reminders
```
