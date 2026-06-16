-- ===========================================================================
-- Alimea — initial schema
-- Multi-tenant by nutritionist. Each row is owned by auth.uid().
-- ===========================================================================

create extension if not exists "pgcrypto";

-- --- Nutritionist profile (1:1 with auth.users) ----------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  credential text not null default '',
  instagram text,
  phone text,
  address text,
  logo_url text,
  pdf_template text not null default 'classic',
  interface_language text not null default 'pt-PT'
    check (interface_language in ('pt-PT', 'en')),
  created_at timestamptz not null default now()
);

-- --- Clients ----------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  birth_date date,
  goals text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists clients_nutritionist_idx on public.clients (nutritionist_id);

-- --- Consultations ----------------------------------------------------------
create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  date date not null default current_date,
  -- anthropometry stored as JSONB for flexibility (Measurements type)
  measurements jsonb not null default '{}'::jsonb,
  notes text,
  plan_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists consultations_client_idx on public.consultations (client_id);

-- --- Meal plans (meals stored as JSONB, fully flexible) ---------------------
create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  consultation_id uuid references public.consultations (id) on delete set null,
  language text not null default 'pt-PT'
    check (language in ('pt-PT', 'en')),
  pdf_template_id text not null default 'classic',
  meals jsonb not null default '[]'::jsonb,
  supplementation text,
  notes text,
  motivational_quote text,
  next_appointment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meal_plans_client_idx on public.meal_plans (client_id);

-- Normalised meal/option tables are available for reporting/search;
-- the canonical editable copy lives in meal_plans.meals (JSONB).
create table if not exists public.meal_options (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.meal_plans (id) on delete cascade,
  meal_name text not null,
  meal_time text,
  position int not null default 0,
  content text not null
);
create index if not exists meal_options_plan_idx on public.meal_options (plan_id);

-- --- Reusable recommendations (multilingual) --------------------------------
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references public.profiles (id) on delete cascade,
  category text not null default 'general'
    check (category in ('hydration','behavior','supplementation','restrictions','general')),
  title text not null,
  content jsonb not null default '{}'::jsonb, -- { "pt-PT": "...", "en": "..." }
  created_at timestamptz not null default now()
);
create index if not exists recommendations_nutritionist_idx on public.recommendations (nutritionist_id);

-- --- Internal plan templates ------------------------------------------------
create table if not exists public.plan_templates (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  language text not null default 'pt-PT' check (language in ('pt-PT','en')),
  meals jsonb not null default '[]'::jsonb,
  supplementation text,
  notes text,
  created_at timestamptz not null default now()
);

-- --- Uploaded PDF templates / design references -----------------------------
create table if not exists public.pdf_templates (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- --- Generated PDFs (audit / re-download) -----------------------------------
create table if not exists public.generated_pdfs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.meal_plans (id) on delete cascade,
  language text not null check (language in ('pt-PT','en')),
  storage_path text,
  created_at timestamptz not null default now()
);

-- --- Progress entries (weight / measures over time) -------------------------
create table if not exists public.progress_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  date date not null default current_date,
  weight_kg numeric,
  bmi numeric,
  body_fat_pct numeric,
  muscle_mass_kg numeric,
  created_at timestamptz not null default now()
);
create index if not exists progress_client_idx on public.progress_entries (client_id);

-- --- Appointments -----------------------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  date timestamptz not null,
  duration_min int not null default 45,
  note text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled')),
  reminder_enabled boolean not null default true,
  reminder_channel text not null default 'sms',
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists appointments_client_idx on public.appointments (client_id);

-- --- Sent reminder messages (SMS outbox) ------------------------------------
create table if not exists public.sent_messages (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  "to" text not null,
  channel text not null default 'sms',
  body text not null,
  status text not null check (status in ('sent', 'failed', 'simulated')),
  provider text not null,
  created_at timestamptz not null default now()
);
create index if not exists sent_messages_appointment_idx on public.sent_messages (appointment_id);

-- ===========================================================================
-- Row Level Security: every tenant only sees its own data.
-- ===========================================================================
alter table public.profiles        enable row level security;
alter table public.clients         enable row level security;
alter table public.consultations   enable row level security;
alter table public.meal_plans      enable row level security;
alter table public.meal_options    enable row level security;
alter table public.recommendations enable row level security;
alter table public.plan_templates  enable row level security;
alter table public.pdf_templates   enable row level security;
alter table public.generated_pdfs  enable row level security;
alter table public.progress_entries enable row level security;
alter table public.appointments    enable row level security;
alter table public.sent_messages   enable row level security;

-- profile: owner == auth.uid()
create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- helper predicate: row belongs to a client owned by the current nutritionist
-- (expressed inline per table to keep policies self-contained)

create policy "own clients" on public.clients
  for all using (nutritionist_id = auth.uid())
  with check (nutritionist_id = auth.uid());

create policy "own consultations" on public.consultations
  for all using (exists (
    select 1 from public.clients c
    where c.id = consultations.client_id and c.nutritionist_id = auth.uid()))
  with check (exists (
    select 1 from public.clients c
    where c.id = consultations.client_id and c.nutritionist_id = auth.uid()));

create policy "own meal_plans" on public.meal_plans
  for all using (exists (
    select 1 from public.clients c
    where c.id = meal_plans.client_id and c.nutritionist_id = auth.uid()))
  with check (exists (
    select 1 from public.clients c
    where c.id = meal_plans.client_id and c.nutritionist_id = auth.uid()));

create policy "own meal_options" on public.meal_options
  for all using (exists (
    select 1 from public.meal_plans p join public.clients c on c.id = p.client_id
    where p.id = meal_options.plan_id and c.nutritionist_id = auth.uid()))
  with check (exists (
    select 1 from public.meal_plans p join public.clients c on c.id = p.client_id
    where p.id = meal_options.plan_id and c.nutritionist_id = auth.uid()));

create policy "own recommendations" on public.recommendations
  for all using (nutritionist_id = auth.uid())
  with check (nutritionist_id = auth.uid());

create policy "own plan_templates" on public.plan_templates
  for all using (nutritionist_id = auth.uid())
  with check (nutritionist_id = auth.uid());

create policy "own pdf_templates" on public.pdf_templates
  for all using (nutritionist_id = auth.uid())
  with check (nutritionist_id = auth.uid());

create policy "own generated_pdfs" on public.generated_pdfs
  for all using (exists (
    select 1 from public.meal_plans p join public.clients c on c.id = p.client_id
    where p.id = generated_pdfs.plan_id and c.nutritionist_id = auth.uid()))
  with check (exists (
    select 1 from public.meal_plans p join public.clients c on c.id = p.client_id
    where p.id = generated_pdfs.plan_id and c.nutritionist_id = auth.uid()));

create policy "own progress" on public.progress_entries
  for all using (exists (
    select 1 from public.clients c
    where c.id = progress_entries.client_id and c.nutritionist_id = auth.uid()))
  with check (exists (
    select 1 from public.clients c
    where c.id = progress_entries.client_id and c.nutritionist_id = auth.uid()));

create policy "own appointments" on public.appointments
  for all using (exists (
    select 1 from public.clients c
    where c.id = appointments.client_id and c.nutritionist_id = auth.uid()))
  with check (exists (
    select 1 from public.clients c
    where c.id = appointments.client_id and c.nutritionist_id = auth.uid()));

create policy "own sent_messages" on public.sent_messages
  for all using (exists (
    select 1 from public.clients c
    where c.id = sent_messages.client_id and c.nutritionist_id = auth.uid()))
  with check (exists (
    select 1 from public.clients c
    where c.id = sent_messages.client_id and c.nutritionist_id = auth.uid()));

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The trigger runs as table owner; no one needs to call it directly via RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
