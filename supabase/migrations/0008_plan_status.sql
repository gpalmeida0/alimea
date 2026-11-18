-- ===========================================================================
-- Plan status: lets the nutritionist save a consultation now and finish the
-- meal plan later. New plans start as 'draft'; plans created before this
-- column existed stay NULL and are shown as finished.
-- ===========================================================================

alter table public.meal_plans
  add column if not exists status text check (status in ('draft', 'done'));
