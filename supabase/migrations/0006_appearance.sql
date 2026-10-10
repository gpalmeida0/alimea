-- ===========================================================================
-- Per-account appearance: theme mode, brand colour, corner style, heading font.
-- Stored as JSON so new options need no further migration; the app validates
-- it on every read and write (normalizeAppearance in src/lib/theme.ts).
-- ===========================================================================

alter table public.profiles
  add column if not exists appearance jsonb not null default '{}'::jsonb;
