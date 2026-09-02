-- Wave 35: home_bootstrap — one round trip for Home's mount-time reads.
--
-- Home was opening with three separate queries (checks, trait_tracks, and a
-- crisis_flags window), plus the me row and growth from context. On a cold
-- open that is three sequential network waits before the screen settles.
--
-- This returns all three in one call. Deliberately NOT doing the timezone
-- maths here: the client already derives local calendar days from created_at
-- with localYmd(), and passing a tz name into SQL would introduce a second,
-- subtly different implementation. So crisis_since is the raw recent
-- timestamps and the client folds them exactly as before — same behaviour,
-- one round trip.
--
-- Read-only (stable), owner-scoped via auth.uid(). Adds no new reachable data:
-- every row here is already selectable by the caller under RLS.

create or replace function public.home_bootstrap()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_checks jsonb;
  v_tracks jsonb;
  v_crisis jsonb;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Same shape and order as fetchChecks(): every row, oldest first.
  select coalesce(jsonb_agg(to_jsonb(c) order by c.day), '[]'::jsonb)
    into v_checks
  from public.checks c
  where c.user_id = uid;

  select coalesce(
           jsonb_agg(jsonb_build_object(
             'axis', t.axis,
             'track', t.track,
             'value', t.value,
             'stability', t.stability,
             'answer_count', t.answer_count,
             'last_touched', t.last_touched,
             'last_depth_at', t.last_depth_at
           )),
           '[]'::jsonb)
    into v_tracks
  from public.trait_tracks t
  where t.user_id = uid;

  -- Four days back is the window crisisFlagsForWindow already used; the client
  -- decides which of those fall on today / yesterday in its own timezone.
  select coalesce(jsonb_agg(f.created_at), '[]'::jsonb)
    into v_crisis
  from public.crisis_flags f
  where f.user_id = uid
    and f.created_at >= now() - interval '4 days';

  return jsonb_build_object(
    'checks', v_checks,
    'trait_tracks', v_tracks,
    'crisis_since', v_crisis
  );
end;
$$;

revoke all on function public.home_bootstrap() from public, anon;
grant execute on function public.home_bootstrap() to authenticated;

comment on function public.home_bootstrap() is
  'One-round-trip Home mount payload for the signed-in user: checks, trait_tracks, and recent crisis_flags timestamps.';
