# Alimea — Product Backlog (Linear)

This is the planning backlog for the **alimea** Linear project: milestones (releases),
epics (labels), and user stories with acceptance criteria. A companion
`linear-import.csv` is provided for Linear's CSV importer.

> Status legend: ✅ Done · 🟡 In progress · ⬜ Backlog

---

## Milestones (Releases)

| Milestone | Theme | Status |
|-----------|-------|--------|
| **M1 — Clinical MVP** | Auth, clients, consultations, plan editor, PDF engine, i18n | ✅ Done |
| **M2 — Productivity & Calendar** | Templates, reusable recommendations, smart duplication, calendar + SMS reminders, notifications | ✅ Done |
| **M3 — Nutrition Engine** | Food database, energy/macro calculators, food totals, recipes, METs | 🟡 In progress |
| **M4 — Production Hardening** | Supabase persistence, real auth & storage, deployment, tests | ⬜ Backlog |
| **M5 — Advanced Clinical** | Pediatrics growth charts, anamnese questionnaire, custom-PDF field mapping | ⬜ Backlog |

---

## Epics (Labels)

- `epic:auth` — Authentication & multi-tenant
- `epic:clients` — Clients & consultations
- `epic:plans` — Meal plans & PDF generation
- `epic:nutrition` — Nutrition calculations & food data
- `epic:calendar` — Calendar & reminders
- `epic:i18n` — Internationalisation
- `epic:productivity` — Templates, recommendations, duplication
- `epic:dashboard` — Dashboard & analytics
- `epic:infra` — Persistence & infrastructure
- `epic:pediatrics` — Pediatrics

---

## User Stories

### epic:auth — Authentication & multi-tenant
- ✅ **As the studio, I create each nutritionist's account** (no public signup).
  - AC: `npm run admin -- invite` creates the account and a single-use set-password link; accounts can be disabled.
- ✅ **As a nutritionist, I can log in** so my workspace is private.
  - AC: email/password login; protected routes redirect to /login; attempts are rate limited.
- ✅ **As a nutritionist, my data is isolated from other accounts** (multi-tenant).
  - AC: clients/plans/recommendations/templates/appointments scoped per nutritionist id.
- ✅ **As a nutritionist, I can reset my password** so I can recover access.
  - AC: emailed single-use link → choose a new password (Supabase Auth + SMTP provider).
- ✅ **As a nutritionist, I can change my password and sign-in email** in Settings.
- ✅ **As a nutritionist, I can protect my account with two-step verification** (TOTP).
  - AC: enrol with QR code; code required at every sign-in; studio can reset it.
- ✅ **As a nutritionist, I can stay logged in securely** with signed/rotating sessions.
  - AC: Supabase JWT session refreshed in the proxy.

### epic:clients — Clients & consultations
- ✅ **As a nutritionist, I can create and edit clients** (name, contacts, goals, notes).
- ✅ **As a nutritionist, I can start a consultation**, optionally duplicating the last one.
  - AC: measurements pre-filled from previous consultation; opens the consultation editor.
- ✅ **As a nutritionist, I can record anthropometry** (weight, height, perimeters, skinfolds, body fat, muscle).
- ✅ **As a nutritionist, I can see each client's progress** (weight, BMI, composition, perimeters charts).
- ⬜ **As a nutritionist, I can attach photos/files to a client** (progress photos, exams).
- ⬜ **As a client, I can receive a shareable read-only progress link.**

### epic:plans — Meal plans & PDF
- ✅ **As a nutritionist, I can build a flexible meal plan** (any meals, multiple options each).
- ✅ **As a nutritionist, I can generate a branded PDF** identical to my template, in PT or EN.
- ✅ **As a nutritionist, I can pick the meal time with a time picker.**
- ✅ **As a nutritionist, I can choose a PDF template per plan** (classic or uploaded).
- ✅ **As a nutritionist, I can upload my own PDF templates.**
- ⬜ **As a nutritionist, I can map dynamic fields onto my uploaded PDF** (coordinate mapping editor).
- ⬜ **As a nutritionist, I can email the generated plan to the client** directly.

### epic:nutrition — Nutrition calculations & food data
- 🟡 **As a nutritionist, I can search a food database** (kcal + macros per portion).
  - AC: 567 foods imported from Excel; search by name/group. ✅
- 🟡 **As a nutritionist, I can compute energy needs** (BMR, TDEE, target) and macro split.
  - AC: Mifflin/Harris-Benedict, activity factor, goal adjustment, macro grams + g/kg. ✅
- 🟡 **As a nutritionist, I can add foods to a meal and see kcal/macros totals** per meal and per plan vs target.
  - AC: structured food items with quantity; live totals; plan summary compared to target. (this milestone)
- ⬜ **As a nutritionist, I can compute energy needs with paediatric/athlete equations** (Schofield, FAO bands, Cunningham, Ten-Haaf).
- ⬜ **As a nutritionist, I can estimate activity expenditure from METs** (823-entry table from Excel).
- ⬜ **As a nutritionist, I can browse recipes** with ingredients and nutrition (RECEITAS sheet).

### epic:calendar — Calendar & reminders
- ✅ **As a nutritionist, I can see all appointments in a month calendar.**
- ✅ **As a nutritionist, the system sends an automatic SMS reminder 1 day before** each appointment.
  - AC: idempotent daily job; localized message; preview mode without Twilio; per-appointment send-now.
- ✅ **As a nutritionist, I can edit an appointment's date/time** and reminder on/off.
- ✅ **As a nutritionist, I get in-app notifications for consultations in the next hour.**
- ⬜ **As a nutritionist, I can also remind clients via WhatsApp/email** (multi-channel).
- ⬜ **As a client, I can confirm/reschedule from the reminder** (reply handling).

### epic:i18n — Internationalisation
- ✅ **As a user, I can switch the whole UI between PT-PT and EN.**
- ✅ **As a nutritionist, I can choose the plan/PDF language independently.**
- ⬜ **As a user, I can use the app in ES/FR** (add locales).

### epic:productivity — Templates, recommendations, duplication
- ✅ **As a nutritionist, I can save and apply reusable meal-plan templates.**
- ✅ **As a nutritionist, I can toggle reusable recommendation blocks** into a plan (multilingual).
- ✅ **As a nutritionist, I can duplicate a plan** for fast iteration.
- ✅ **As a nutritionist, the AI assistant can translate/improve my text** (never autonomous).

### epic:dashboard — Dashboard & analytics
- ✅ **As a nutritionist, I see practice metrics** (active clients, consultations this month, plans, upcoming).
- ⬜ **As a nutritionist, I see revenue/no-show analytics.**
- ⬜ **As a nutritionist, I can export reports.**

### epic:infra — Persistence & infrastructure
- ⬜ **As the product, data persists in Postgres (Supabase)** with the existing schema + RLS.
- ⬜ **As the product, uploaded files persist in object storage** (logos, PDF templates).
- ⬜ **As the team, the app is deployed (Vercel) with the reminder cron live.**
- ⬜ **As the team, there is an automated test suite** (unit for calculators/PDF, e2e for core flows).

### epic:pediatrics — Pediatrics
- ⬜ **As a nutritionist, I can plot paediatric growth (WHO percentiles)** from the PEDIATRIA sheets.
- ⬜ **As a nutritionist, I can fill an anamnese questionnaire** (ANAMNESE sheet) per client.
