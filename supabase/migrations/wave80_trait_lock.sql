-- wave80_trait_lock.sql
--
-- NOT APPLIED. Trait checkpoint, step 2 of 2 (emci, 2026-10-03: "ok + b").
-- Apply ONLY when emci says "lock", after the OTA that moved every trait
-- write onto the wave79 checkpoint has reached phones. Applying it earlier
-- breaks answer saving on every phone still running an older bundle (they
-- write trait_tracks / trait_history / me trait columns directly).
--
-- What it does: phones can no longer write trait scores at all. Only the
-- wave79 security-definer functions (owned by postgres) can.
--
--   1. trait_tracks: client INSERT/UPDATE revoked, own-row write policies dropped.
--   2. trait_history: client INSERT revoked, own-row insert policy dropped.
--      (Reads stay: select grants and policies are untouched.)
--   3. me: a guard refuses any client change to the 16 trait columns,
--      trait_sources or trait_touched_at. It checks current_user, which is
--      'authenticated' for a direct client write and the function owner inside
--      a security-definer function — so the checkpoint, Start over and the
--      resets keep working unchanged. (The wave34 is_root guard checks the JWT
--      role instead, which would also block the checkpoint; not reused here.)
--   4. answer_question_item (wave18): revoked from clients. It marked a round
--      item answered without scoring it; answer_round_item does both.
--
-- No row is altered or deleted.

-- 1. trait_tracks ---------------------------------------------------------------
drop policy if exists trait_tracks_insert_own on public.trait_tracks;
drop policy if exists trait_tracks_update_own on public.trait_tracks;
revoke insert, update, delete on table public.trait_tracks from anon, authenticated;

-- 2. trait_history --------------------------------------------------------------
drop policy if exists trait_history_insert_own on public.trait_history;
revoke insert, update, delete on table public.trait_history from anon, authenticated;

-- 3. me trait columns -----------------------------------------------------------
create or replace function public.me_trait_columns_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.openness is not null or new.conscientiousness is not null or new.extraversion is not null
       or new.agreeableness is not null or new.steadiness is not null or new.attachment_anxiety is not null
       or new.attachment_avoidance is not null or new.conflict_assertiveness is not null
       or new.conflict_cooperativeness is not null or new.autonomy is not null or new.competence is not null
       or new.relatedness is not null or new.growth_mindset is not null or new.locus_of_control is not null
       or new.self_efficacy is not null or new.playfulness is not null
       or coalesce(new.trait_sources, '{}'::jsonb) <> '{}'::jsonb
       or coalesce(new.trait_touched_at, '{}'::jsonb) <> '{}'::jsonb then
      raise exception 'trait scores are written by the server' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.openness is distinct from old.openness
     or new.conscientiousness is distinct from old.conscientiousness
     or new.extraversion is distinct from old.extraversion
     or new.agreeableness is distinct from old.agreeableness
     or new.steadiness is distinct from old.steadiness
     or new.attachment_anxiety is distinct from old.attachment_anxiety
     or new.attachment_avoidance is distinct from old.attachment_avoidance
     or new.conflict_assertiveness is distinct from old.conflict_assertiveness
     or new.conflict_cooperativeness is distinct from old.conflict_cooperativeness
     or new.autonomy is distinct from old.autonomy
     or new.competence is distinct from old.competence
     or new.relatedness is distinct from old.relatedness
     or new.growth_mindset is distinct from old.growth_mindset
     or new.locus_of_control is distinct from old.locus_of_control
     or new.self_efficacy is distinct from old.self_efficacy
     or new.playfulness is distinct from old.playfulness
     or new.trait_sources is distinct from old.trait_sources
     or new.trait_touched_at is distinct from old.trait_touched_at then
    raise exception 'trait scores are written by the server' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.me_trait_columns_guard() from public, anon, authenticated;

drop trigger if exists me_trait_columns_guard on public.me;
create trigger me_trait_columns_guard
  before insert or update on public.me
  for each row execute function public.me_trait_columns_guard();

-- 4. the old round-answer path --------------------------------------------------
revoke execute on function public.answer_question_item(uuid, int) from authenticated;
