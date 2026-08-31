-- Wave 22: Levity category + Story quota lane.
-- Story is its own generation claim. Does not increment Talk calls or title.

insert into public.category_defs (id, name, shape, axis_weights, min_axes_required_stable, texture_axes) values
  ('cat_levity', 'Levity', 'bar',
    '{"playfulness":1,"conflict_assertiveness":1,"conflict_cooperativeness":1}'::jsonb, 2, '{}')
on conflict (id) do update set
  name = excluded.name,
  shape = excluded.shape,
  axis_weights = excluded.axis_weights,
  min_axes_required_stable = excluded.min_axes_required_stable,
  texture_axes = excluded.texture_axes;

comment on table public.category_defs is
  'Catalog of profile categories. Math lives in the app; this is the named definition. Report-track only. Love/closeness is the only map from conflict-adjacent axes; Levity is a bar.';

alter table public.me
  add column if not exists sage_story jsonb not null default '{}'::jsonb;

comment on column public.me.sage_story is
  'Cached Sage Story from settled categories. Fingerprint-gated. Empty object when none. Never a fallback paragraph.';

alter table public.app_config
  add column if not exists story_daily_cap int not null default 1
    check (story_daily_cap >= 0);

comment on column public.app_config.story_daily_cap is
  'Per-user daily cap on Sage Story generations. Does not increment Talk calls or title.';

create or replace function public.claim_story_generate()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cap int;
  today date := (timezone('utc', now()))::date;
  used int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select story_daily_cap into strict cap from public.app_config where id = 1;

  perform pg_advisory_xact_lock(hashtext(uid::text || ':story'));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;

  select coalesce((by_type->>'story')::int, 0) into used
    from public.ai_usage
    where user_id = uid and day = today;

  if used >= cap then
    return jsonb_build_object(
      'ok', false,
      'reason', 'quota',
      'daily', used,
      'daily_cap', cap,
      'call_type', 'story'
    );
  end if;

  update public.ai_usage
    set by_type = jsonb_set(
      coalesce(by_type, '{}'::jsonb),
      '{story}',
      to_jsonb(used + 1)
    )
    where user_id = uid and day = today
    returning coalesce((by_type->>'story')::int, 0) into used;

  return jsonb_build_object(
    'ok', true,
    'daily', used,
    'daily_cap', cap,
    'call_type', 'story'
  );
end;
$$;

revoke all on function public.claim_story_generate() from public, anon;
grant execute on function public.claim_story_generate() to authenticated;

comment on function public.claim_story_generate() is
  'Claim one Sage Story generate. Tags by_type.story only — does not increment Talk calls or title.';
