-- ===========================================================================
-- Client administrative details + per-plan PDF option.
--   clients: tax number, health insurance, government nutrition voucher
--            ("cheque-nutricionista": consultations are not charged) and the
--            date the data-processing notice was given.
--   meal_plans.hide_food_items: print only the written text of each option.
-- ===========================================================================

alter table public.clients
  add column if not exists nif text,
  add column if not exists health_insurer text,
  add column if not exists insurance_number text,
  add column if not exists nutrition_voucher boolean not null default false,
  add column if not exists data_consent_at date;

alter table public.meal_plans
  add column if not exists hide_food_items boolean not null default false;
