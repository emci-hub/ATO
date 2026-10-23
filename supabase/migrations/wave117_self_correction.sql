-- wave117_self_correction.sql
--
-- NOT APPLIED. A "Not me" correction is one weighted answer in trait_answers.
-- It does not set a direct source (self_confirm, self_slider, self_tap,
-- self_settings), so it is not an override lock. Later answers can outvote it.
-- If the trait was only confirmed ("still fits"), that confirm is cleared so
-- the average, including this answer, is what shows. A slider, tap or settings
-- value the person set themselves is left as it is.
--
-- Weight is stored on the row (default 1 for every older answer). The phone
-- reads it into the equal-weight score. Kind 'correction' is not a bank item,
-- so item stats skip it.

alter table public.trait_answers drop constraint if exists trait_answers_kind_check;
alter table public.trait_answers add constraint trait_answers_kind_check
  check (kind in ('intake', 'round', 'bank', 'correction'));

alter table public.trait_answers
  add column if not exists weight numeric not null default 1;

alter table public.trait_answers drop constraint if exists trait_answers_weight_check;
alter table public.trait_answers add constraint trait_answers_weight_check
  check (weight > 0 and weight <= 2);

comment on column public.trait_answers.weight is
  'wave117: how many answers this row counts as. Bank, intake and round rows stay 1. A self-correction is also 1: one vote, not a lock.';

create or replace function public.record_self_correction(
  p_axis text,
  p_value numeric,
  p_weight numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_axes text[] := array[
    'openness', 'conscientiousness', 'extraversion', 'agreeableness', 'steadiness',
    'attachment_anxiety', 'attachment_avoidance', 'conflict_assertiveness',
    'conflict_cooperativeness', 'autonomy', 'competence', 'relatedness',
    'growth_mindset', 'locus_of_control', 'self_efficacy', 'playfulness'];
  v_weight numeric := coalesce(p_weight, 1);
begin
  perform public.require_adult();
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_axis is null or not (p_axis = any (v_axes)) then
    raise exception 'invalid axis' using errcode = '22023';
  end if;
  if p_value is null or p_value < 0 or p_value > 1 then
    raise exception 'invalid value' using errcode = '22023';
  end if;
  if v_weight <= 0 or v_weight > 2 then
    raise exception 'invalid weight' using errcode = '22023';
  end if;

  insert into public.trait_answers (user_id, kind, question_key, axis, option_index, value, weight)
  values (uid, 'correction', 'correction', p_axis, -1, p_value, v_weight);

  -- A confirm lock would hide this answer. Drop only that lock.
  update public.me
     set trait_sources = coalesce(trait_sources, '{}'::jsonb) - p_axis,
         updated_at = now()
   where id = uid
     and trait_sources ->> p_axis = 'self_confirm';

  update public.me
     set updated_at = now()
   where id = uid;

  return (select to_jsonb(m) from public.me m where m.id = uid);
end;
$$;

revoke all on function public.record_self_correction(text, numeric, numeric) from public, anon;
grant execute on function public.record_self_correction(text, numeric, numeric) to authenticated;

comment on function public.record_self_correction(text, numeric, numeric) is
  'wave117: one weighted self-correction answer. Not a direct-source lock. Does not collect a legend.';
