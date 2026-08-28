-- Wave 1.5 Stage 11 — optional fast-entry trait backbone.
-- Additive. Does not touch Stage 9 chip columns or complete_signup.
-- 0–1 self-report coaching scores, never a clinical inventory, never a raw
-- type/category enum. complete_signup must not start requiring these.
-- Parked: Settings re-tap, traits_updated_at, privacy.md field names.

alter table public.me
  add column if not exists openness numeric,
  add column if not exists conscientiousness numeric,
  add column if not exists extraversion numeric,
  add column if not exists agreeableness numeric,
  add column if not exists steadiness numeric,
  add column if not exists attachment_anxiety numeric,
  add column if not exists attachment_avoidance numeric,
  add column if not exists conflict_assertiveness numeric,
  add column if not exists conflict_cooperativeness numeric,
  add column if not exists trait_sources jsonb not null default '{}'::jsonb;

alter table public.me drop constraint if exists me_openness_unit;
alter table public.me
  add constraint me_openness_unit
  check (openness is null or (openness >= 0 and openness <= 1));

alter table public.me drop constraint if exists me_conscientiousness_unit;
alter table public.me
  add constraint me_conscientiousness_unit
  check (conscientiousness is null or (conscientiousness >= 0 and conscientiousness <= 1));

alter table public.me drop constraint if exists me_extraversion_unit;
alter table public.me
  add constraint me_extraversion_unit
  check (extraversion is null or (extraversion >= 0 and extraversion <= 1));

alter table public.me drop constraint if exists me_agreeableness_unit;
alter table public.me
  add constraint me_agreeableness_unit
  check (agreeableness is null or (agreeableness >= 0 and agreeableness <= 1));

alter table public.me drop constraint if exists me_steadiness_unit;
alter table public.me
  add constraint me_steadiness_unit
  check (steadiness is null or (steadiness >= 0 and steadiness <= 1));

alter table public.me drop constraint if exists me_attachment_anxiety_unit;
alter table public.me
  add constraint me_attachment_anxiety_unit
  check (attachment_anxiety is null or (attachment_anxiety >= 0 and attachment_anxiety <= 1));

alter table public.me drop constraint if exists me_attachment_avoidance_unit;
alter table public.me
  add constraint me_attachment_avoidance_unit
  check (attachment_avoidance is null or (attachment_avoidance >= 0 and attachment_avoidance <= 1));

alter table public.me drop constraint if exists me_conflict_assertiveness_unit;
alter table public.me
  add constraint me_conflict_assertiveness_unit
  check (conflict_assertiveness is null or (conflict_assertiveness >= 0 and conflict_assertiveness <= 1));

alter table public.me drop constraint if exists me_conflict_cooperativeness_unit;
alter table public.me
  add constraint me_conflict_cooperativeness_unit
  check (conflict_cooperativeness is null or (conflict_cooperativeness >= 0 and conflict_cooperativeness <= 1));

alter table public.me drop constraint if exists me_trait_sources_object;
alter table public.me
  add constraint me_trait_sources_object
  check (jsonb_typeof(trait_sources) = 'object');

comment on column public.me.openness is
  'Optional self-report 0–1. Coaching tone only. Not a clinical inventory. Null when skipped.';
comment on column public.me.conscientiousness is
  'Optional self-report 0–1. Coaching tone only. Not a clinical inventory. Null when skipped.';
comment on column public.me.extraversion is
  'Optional self-report 0–1. Coaching tone only. Not a clinical inventory. Null when skipped.';
comment on column public.me.agreeableness is
  'Optional self-report 0–1. Coaching tone only. Not a clinical inventory. Null when skipped.';
comment on column public.me.steadiness is
  'Optional self-report 0–1 (even-keel). Coaching tone only. Not a clinical inventory. Null when skipped. 16-grid never writes this.';
comment on column public.me.attachment_anxiety is
  'Optional self-report 0–1 from a close-pattern tap. Coaching tone only. Null when skipped.';
comment on column public.me.attachment_avoidance is
  'Optional self-report 0–1 from a close-pattern tap. Coaching tone only. Null when skipped.';
comment on column public.me.conflict_assertiveness is
  'Optional self-report 0–1 from a disagreement tap. Coaching tone only. Null when skipped.';
comment on column public.me.conflict_cooperativeness is
  'Optional self-report 0–1 from a disagreement tap. Coaching tone only. Null when skipped.';
comment on column public.me.trait_sources is
  'Per-axis write source: self_grid / self_slider / self_situation. Sliders are sticky over a later grid inference.';
