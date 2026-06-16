-- ===========================================================================
-- Alimea — nutrition module (BOO-50)
-- Adapts the nutritionist's Excel into a multi-tenant schema. Every new row is
-- still owned (directly or transitively) by the nutritionist == auth.uid().
-- History is kept per consultation everywhere so evolution can be compared.
-- ===========================================================================

-- --- Clients: anamnese / personal questionnaire (BOO-51) -------------------
alter table public.clients
  add column if not exists sex text check (sex in ('female', 'male')),
  add column if not exists ethnicity text check (ethnicity in ('white', 'black', 'other')),
  add column if not exists profession text,
  -- ANAMNESE questionnaire (reason, allergies, sport, isAthlete, observations…)
  add column if not exists anamnesis jsonb not null default '{}'::jsonb;

-- --- Consultations: number + per-consultation nutrition blocks --------------
alter table public.consultations
  add column if not exists consultation_number int,
  -- ANAMNESE food history (BOO-52): detailed (1st) or single note (≥2)
  add column if not exists food_history jsonb not null default '{}'::jsonb,
  -- NECESSIDADES ENERGÉTICAS (BOO-55): formula choice, PAL, target
  add column if not exists energy jsonb not null default '{}'::jsonb,
  -- DISTRIBUIÇÃO MACROS (BOO-56): % split
  add column if not exists macros jsonb not null default '{}'::jsonb;
-- measurements jsonb already exists and now carries the extended antropometria.

-- --- Foods database (BOO-57) -----------------------------------------------
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  base_unit text not null default 'g' check (base_unit in ('g', 'mL')),
  ref_qty numeric not null default 100,
  kcal numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  brand text,
  category text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists foods_nutritionist_idx on public.foods (nutritionist_id);
create index if not exists foods_name_idx on public.foods (nutritionist_id, name);

-- --- Recipes (BOO-58) ------------------------------------------------------
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  servings int not null default 1,
  preparation text,
  created_at timestamptz not null default now()
);
create index if not exists recipes_nutritionist_idx on public.recipes (nutritionist_id);

create table if not exists public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete restrict,
  name text not null default '',
  qty numeric not null default 0,
  position int not null default 0
);
create index if not exists recipe_items_recipe_idx on public.recipe_items (recipe_id);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.foods         enable row level security;
alter table public.recipes       enable row level security;
alter table public.recipe_items  enable row level security;

create policy "own foods" on public.foods
  for all using (nutritionist_id = auth.uid())
  with check (nutritionist_id = auth.uid());

create policy "own recipes" on public.recipes
  for all using (nutritionist_id = auth.uid())
  with check (nutritionist_id = auth.uid());

create policy "own recipe_items" on public.recipe_items
  for all using (exists (
    select 1 from public.recipes r
    where r.id = recipe_items.recipe_id and r.nutritionist_id = auth.uid()))
  with check (exists (
    select 1 from public.recipes r
    where r.id = recipe_items.recipe_id and r.nutritionist_id = auth.uid()));
