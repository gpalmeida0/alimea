-- ===========================================================================
-- RLS performance (Supabase advisor 0003_auth_rls_initplan):
-- wrap auth.uid() in a sub-select so Postgres evaluates it once per query
-- instead of once per row. Rewrites every public policy in place.
-- Plus covering indexes for foreign keys (advisor 0001).
-- Idempotent.
-- ===========================================================================
do $$
declare
  p record;
  new_qual text;
  new_check text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
  loop
    new_qual := p.qual;
    new_check := p.with_check;
    if new_qual is not null and new_qual not ilike '%select auth.uid()%' then
      new_qual := replace(new_qual, 'auth.uid()', '(select auth.uid())');
    end if;
    if new_check is not null and new_check not ilike '%select auth.uid()%' then
      new_check := replace(new_check, 'auth.uid()', '(select auth.uid())');
    end if;
    if new_qual is distinct from p.qual then
      execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, new_qual);
    end if;
    if new_check is distinct from p.with_check then
      execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, new_check);
    end if;
  end loop;
end
$$;

create index if not exists billing_entries_client_idx on public.billing_entries (client_id);
create index if not exists consultations_type_idx on public.consultations (consultation_type_id);
create index if not exists generated_pdfs_plan_idx on public.generated_pdfs (plan_id);
create index if not exists recipe_items_food_idx on public.recipe_items (food_id);
