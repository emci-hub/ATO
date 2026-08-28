-- Wave 1.5 — six extra optional 0–1 axes + per-axis last_touched.
-- Additive. Does not touch Stage 9 chips, Stage 11 axes, or complete_signup.
-- Same rules as Stage 11: nullable coaching self-report, never a clinical
-- inventory, never a stored framework label. complete_signup must not start
-- requiring these.

alter table public.me
  add column if not exists autonomy numeric,
  add column if not exists competence numeric,
  add column if not exists relatedness numeric,
  add column if not exists growth_mindset numeric,
  add column if not exists locus_of_control numeric,
  add column if not exists self_efficacy numeric,
  add column if not exists trait_touched_at jsonb not null default '{}'::jsonb;

alter table public.me drop constraint if exists me_autonomy_unit;
alter table public.me
  add constraint me_autonomy_unit
  check (autonomy is null or (autonomy >= 0 and autonomy <= 1));

alter table public.me drop constraint if exists me_competence_unit;
alter table public.me
  add constraint me_competence_unit
  check (competence is null or (competence >= 0 and competence <= 1));

alter table public.me drop constraint if exists me_relatedness_unit;
alter table public.me
  add constraint me_relatedness_unit
  check (relatedness is null or (relatedness >= 0 and relatedness <= 1));

alter table public.me drop constraint if exists me_growth_mindset_unit;
alter table public.me
  add constraint me_growth_mindset_unit
  check (growth_mindset is null or (growth_mindset >= 0 and growth_mindset <= 1));

alter table public.me drop constraint if exists me_locus_of_control_unit;
alter table public.me
  add constraint me_locus_of_control_unit
  check (locus_of_control is null or (locus_of_control >= 0 and locus_of_control <= 1));

alter table public.me drop constraint if exists me_self_efficacy_unit;
alter table public.me
  add constraint me_self_efficacy_unit
  check (self_efficacy is null or (self_efficacy >= 0 and self_efficacy <= 1));

alter table public.me drop constraint if exists me_trait_touched_at_object;
alter table public.me
  add constraint me_trait_touched_at_object
  check (jsonb_typeof(trait_touched_at) = 'object');

comment on column public.me.autonomy is
  'Optional self-report 0–1. Coaching tone only. Not a clinical inventory. Null when skipped. Framework name never stored.';
comment on column public.me.competence is
  'Optional self-report 0–1. Coaching tone only. Not a clinical inventory. Null when skipped. Framework name never stored.';
comment on column public.me.relatedness is
  'Optional self-report 0–1. Coaching tone only. Not a clinical inventory. Null when skipped. Framework name never stored.';
comment on column public.me.growth_mindset is
  'Optional self-report 0–1. Coaching tone only. Not a clinical inventory. Null when skipped. Framework name never stored.';
comment on column public.me.locus_of_control is
  'Optional self-report 0–1. Coaching tone only. Not a clinical inventory. Null when skipped. Framework name never stored.';
comment on column public.me.self_efficacy is
  'Optional self-report 0–1. Coaching tone only. Not a clinical inventory. Null when skipped. Framework name never stored.';
comment on column public.me.trait_touched_at is
  'Per-axis ISO timestamp of the last successful write. Null axes have no key. Clock for the 3-month re-ask.';
comment on column public.me.trait_sources is
  'Per-axis write source. Direct (self_slider / self_tap / self_confirm / self_settings) is sticky over inferred (self_grid / self_situation / self_game). Null axes have no key.';
