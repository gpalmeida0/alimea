-- ===========================================================================
-- Alimea — production hardening
--   • Private Storage bucket for logos and uploaded PDF templates
--     (files previously went to /public/uploads, which does not work on
--     serverless hosts and made every upload world-readable).
--   • Indexes for the queries the app actually runs.
--   • Integrity: consultation numbers, cross-tenant references.
-- Safe to re-run.
-- ===========================================================================

-- --- Storage ----------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'alimea-files',
  'alimea-files',
  false,
  10485760, -- 10 MB
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Objects live under "<auth.uid()>/…": each nutritionist only sees their folder.
drop policy if exists "alimea files: own folder read" on storage.objects;
create policy "alimea files: own folder read" on storage.objects
  for select to authenticated
  using (bucket_id = 'alimea-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "alimea files: own folder insert" on storage.objects;
create policy "alimea files: own folder insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'alimea-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "alimea files: own folder delete" on storage.objects;
create policy "alimea files: own folder delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'alimea-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- --- Indexes ----------------------------------------------------------------
create index if not exists consultations_client_date_idx on public.consultations (client_id, date desc);
create index if not exists appointments_date_idx on public.appointments (date);
create index if not exists appointments_pending_reminders_idx on public.appointments (date)
  where status = 'scheduled' and reminder_enabled and reminder_sent_at is null;
create index if not exists billing_entries_date_idx on public.billing_entries (nutritionist_id, date desc);
create index if not exists plan_templates_nutritionist_idx on public.plan_templates (nutritionist_id);
create index if not exists pdf_templates_nutritionist_idx on public.pdf_templates (nutritionist_id);
create index if not exists sent_messages_client_idx on public.sent_messages (client_id, created_at desc);
create index if not exists meal_plans_consultation_idx on public.meal_plans (consultation_id);

-- --- Integrity ----------------------------------------------------------------
-- A plan's consultation must belong to the same client.
create or replace function public.check_plan_consultation()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.consultation_id is not null and not exists (
    select 1 from public.consultations c
    where c.id = new.consultation_id and c.client_id = new.client_id
  ) then
    raise exception 'consultation % does not belong to client %', new.consultation_id, new.client_id;
  end if;
  return new;
end;
$$;

drop trigger if exists meal_plans_consultation_check on public.meal_plans;
create trigger meal_plans_consultation_check
  before insert or update of consultation_id, client_id on public.meal_plans
  for each row execute function public.check_plan_consultation();

-- Billing rows may only point at the owner's own clients.
drop policy if exists "own billing_entries" on public.billing_entries;
create policy "own billing_entries" on public.billing_entries
  for all using (nutritionist_id = auth.uid())
  with check (
    nutritionist_id = auth.uid()
    and (client_id is null or exists (
      select 1 from public.clients c where c.id = client_id and c.nutritionist_id = auth.uid()))
  );

-- Consultation types referenced by a consultation must be the owner's.
drop policy if exists "own consultations" on public.consultations;
create policy "own consultations" on public.consultations
  for all using (exists (
    select 1 from public.clients c
    where c.id = consultations.client_id and c.nutritionist_id = auth.uid()))
  with check (
    exists (
      select 1 from public.clients c
      where c.id = consultations.client_id and c.nutritionist_id = auth.uid())
    and (consultation_type_id is null or exists (
      select 1 from public.consultation_types t
      where t.id = consultation_type_id and t.nutritionist_id = auth.uid()))
  );

-- Recipe items may only reference the owner's foods.
drop policy if exists "own recipe_items" on public.recipe_items;
create policy "own recipe_items" on public.recipe_items
  for all using (exists (
    select 1 from public.recipes r
    where r.id = recipe_items.recipe_id and r.nutritionist_id = auth.uid()))
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_items.recipe_id and r.nutritionist_id = auth.uid())
    and exists (
      select 1 from public.foods f
      where f.id = recipe_items.food_id and f.nutritionist_id = auth.uid())
  );
