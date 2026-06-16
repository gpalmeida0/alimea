-- ===========================================================================
-- Billing / faturação
-- consultation_types: per-nutritionist consultation types, each with a price.
-- billing_entries: one row per billable item (auto from a consultation, or
-- added manually). Type name + amount are snapshotted so editing a type later
-- never rewrites historical invoices.
-- ===========================================================================

create table if not exists public.consultation_types (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  price numeric not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists consultation_types_nutritionist_idx
  on public.consultation_types (nutritionist_id);

alter table public.consultations
  add column if not exists consultation_type_id uuid
  references public.consultation_types (id) on delete set null;

create table if not exists public.billing_entries (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  consultation_id uuid references public.consultations (id) on delete set null,
  client_name text not null default '',
  type_name text not null default '',
  amount numeric not null default 0,
  date date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  notes text,
  source text not null default 'manual' check (source in ('auto', 'manual')),
  created_at timestamptz not null default now()
);
create index if not exists billing_entries_nutritionist_idx
  on public.billing_entries (nutritionist_id);
-- At most one auto-generated entry per consultation (idempotent billing).
create unique index if not exists billing_entries_consultation_uniq
  on public.billing_entries (consultation_id) where consultation_id is not null;

alter table public.consultation_types enable row level security;
alter table public.billing_entries    enable row level security;

create policy "own consultation_types" on public.consultation_types
  for all using (nutritionist_id = auth.uid())
  with check (nutritionist_id = auth.uid());

create policy "own billing_entries" on public.billing_entries
  for all using (nutritionist_id = auth.uid())
  with check (nutritionist_id = auth.uid());
