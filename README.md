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

Without Supabase env vars the app runs on an **in-memory demo store** seeded with
a realistic clinic (dates are relative to today, so the calendar and reminders
always look alive). Demo login: `eduarda@alimea.app` / `alimea`. Demo data is
lost on restart.

```bash
npm run check      # typecheck + lint + tests
npm test           # unit tests (formulas, reminders, dates, PDF engine)
npm run build      # production build
npm run pdf:sample # write a sample PDF from the seed data
```

## Architecture

```
src/
  app/[locale]/(app)/      Authenticated pages (dashboard, clients, consultation, …)
  app/actions.ts           Server actions — validated with zod, tenant-scoped
  app/api/pdf/[planId]/    PDF generation (auth required)
  app/api/files/[...key]/  Serves uploaded logo / PDF templates (auth required)
  app/api/ai/              Non-autonomous AI assistant (auth required)
  app/api/cron/reminders/  Daily SMS reminder job (CRON_SECRET)
  components/ui/           Primitives: Dialog, feedback (toasts + confirm), inputs, tabs
  components/              Feature components (plan editor, consultation workspace, …)
  hooks/                   useServerAction, useAutosave
  lib/data/repo-types.ts   The Repository contract both backends implement
  lib/data/repo.ts         Facade: picks Supabase or memory, shared aggregates
  lib/nutrition/           Energy (GEB/GET), body composition, macros, food items
  lib/messaging/           Reminder engine (store injected) + SMS providers
  lib/pdf/                 Template engine (pdf-lib) + fonts
tests/                     node:test suites (run with tsx)
supabase/migrations/       Schema, RLS, storage bucket, policies
```

Key behaviours:

- **One data boundary.** Every read/write goes through `lib/data/repo.ts`; both
  backends are type-checked against `Repository`, and every by-id access is
  scoped to the signed-in nutritionist (RLS in Supabase, explicit checks in memory).
- **Consultation workspace** keeps anamnesis, anthropometry, results, energy,
  macros and the meal plan in one client-side draft that **autosaves** (and on
  ⌘S), warns before leaving with unsaved changes, and always saves before
  generating a PDF.
- **Time zones.** Appointment times are converted to instants in the browser;
  everything shown to people (UI, SMS) is formatted in `NEXT_PUBLIC_APP_TIME_ZONE`.
  Date-only values never shift a day.
- **Reminders** are due from the day before the appointment (clinic time) until
  it starts, so one daily cron run covers all of tomorrow. User-triggered sends
  only ever see the user's own appointments.
- **Files** (logo, uploaded PDF templates) live in a private Supabase Storage
  bucket (`alimea-files`, per-tenant folders) or in memory for the demo.

## Supabase (production)

1. Apply `supabase/migrations/*.sql` in order (`supabase db push`). `0004` adds
   the storage bucket + integrity rules, `0005` optimises the RLS policies.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` (see `.env.example`).
3. Configure authentication as described in *Accounts & authentication* below.

## Accounts & authentication

Alimea is sold directly: **the studio creates every account** — there is no
public signup. Run the admin tool from your own machine (it uses the
service-role key from `.env.local`, plus `NEXT_PUBLIC_SITE_URL`):

```bash
npm run admin -- invite ana@clinic.pt "Ana Silva"   # creates the account, prints a set-password link
npm run admin -- invite ana@clinic.pt "Ana Silva" --email   # …or have Supabase email the invite
npm run admin -- reset-link ana@clinic.pt   # password-reset link to send by hand
npm run admin -- reset-mfa ana@clinic.pt    # lost phone: remove two-step verification
npm run admin -- disable ana@clinic.pt      # block sign-in (enable to undo)
npm run admin -- list
```

What nutritionists can do themselves: sign in, reset a forgotten password by
email, change password and sign-in email, and turn on two-step verification
(authenticator app) under *Settings → Account & security*. Sign-in, 2FA and
reset attempts are rate limited (`src/lib/auth/rate-limit.ts`).

One-time Supabase dashboard setup (Authentication):

1. **Sign In / Providers** — turn **off** "Allow new users to sign up" (invites
   still work), and turn on *leaked password protection*; minimum length 10.
2. **URL Configuration** — set *Site URL* to the production URL.
3. **Emails → SMTP** — add a custom SMTP provider (e.g. Resend's free tier).
   Supabase's built-in sender only delivers to your own team.
4. **Emails → Templates** — every link must land on the app's `/confirm` screen:

   | Template | Link |
   |----------|------|
   | Invite user | `{{ .SiteURL }}/confirm?token_hash={{ .TokenHash }}&type=invite` |
   | Reset password | `{{ .SiteURL }}/confirm?token_hash={{ .TokenHash }}&type=recovery` |
   | Change email address | `{{ .SiteURL }}/confirm?token_hash={{ .TokenHash }}&type=email_change` |

5. **Multi-Factor** — keep TOTP enabled.

## CI

`.github/workflows/ci.yml` runs typecheck, lint, tests and a production build on
every push and pull request, on GitHub's hosted runners.
