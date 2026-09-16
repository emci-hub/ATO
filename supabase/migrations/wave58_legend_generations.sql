-- wave58_legend_generations.sql
-- New Legends 64-archetype storage + generation quota (core loop redesign §4),
-- mirroring wave48's claim_roll_generation exactly: a per-feature quota layered
-- in front of the shared ai-generate dispatch, not a change to ai-generate itself.

create table public.legend_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  archetype_code text not null check (archetype_code ~ '^[HL]{3}-[HL]{3}$'),
  story text not null check (char_length(story) > 0 and char_length(story) <= 2000),
  generated_at timestamptz not null default now()
);

create index legend_generations_user_generated_idx
  on public.legend_generations (user_id, generated_at desc);

comment on table public.legend_generations is
  'One row per Legends story generation (manual trigger or paid reroll), core loop redesign §4. archetype_code is classify.ts''s 64-code output. Latest row per user is "current"; full history read via generated_at desc for the archive fold.';

alter table public.legend_generations enable row level security;

create policy legend_generations_select_own on public.legend_generations
  for select using (auth.uid() = user_id);

alter table public.app_config
  add column if not exists legend_story_generations_daily_cap int not null default 5
    check (legend_story_generations_daily_cap >= 0);

comment on column public.app_config.legend_story_generations_daily_cap is
  'Per-user daily cap on Legends story-content generations (one AI call each — manual taps and paid rerolls both count), claimed once per generation attempt before the vendor call. Mirrors wave48''s roll_generations_daily_cap. Separate from the 10-token/1-day reroll PRICE (spend_ato_tokens_legend_reroll, wave51), which bounds only paid rerolls — this cap also bounds the free first-time/re-trigger path.';

create or replace function public.claim_legend_story_generation()
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

  select legend_story_generations_daily_cap into strict cap from public.app_config where id = 1;

  perform pg_advisory_xact_lock(hashtext(uid::text || ':legend_story_gen'));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;

  select coalesce((by_type->>'legend_story_gen')::int, 0) into used
    from public.ai_usage
    where user_id = uid and day = today;

  if used >= cap then
    return jsonb_build_object(
      'ok', false, 'reason', 'quota',
      'daily', used, 'daily_cap', cap, 'call_type', 'legend_story_gen'
    );
  end if;

  update public.ai_usage
    set by_type = jsonb_set(coalesce(by_type, '{}'::jsonb), '{legend_story_gen}', to_jsonb(used + 1))
    where user_id = uid and day = today
    returning coalesce((by_type->>'legend_story_gen')::int, 0) into used;

  return jsonb_build_object(
    'ok', true, 'daily', used, 'daily_cap', cap, 'call_type', 'legend_story_gen'
  );
end;
$$;

revoke all on function public.claim_legend_story_generation() from public, anon;
grant execute on function public.claim_legend_story_generation() to authenticated;

comment on function public.claim_legend_story_generation() is
  'Claim one Legends story generation (legend_story_generations_daily_cap/day, default 5). Called once per generation attempt, BEFORE generateText/ai-generate — does not itself touch the shared Sage/Explore quota.';

-- Caller must already hold a successful claim_legend_story_generation() for today —
-- this RPC does not re-check quota, same separation already used elsewhere in this repo.
create or replace function public.insert_legend_generation(
  p_archetype_code text,
  p_story text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_archetype_code is null or p_archetype_code !~ '^[HL]{3}-[HL]{3}$' then
    raise exception 'invalid archetype_code' using errcode = '22023';
  end if;
  if p_story is null or btrim(p_story) = '' then
    raise exception 'story required' using errcode = '22023';
  end if;

  insert into public.legend_generations (user_id, archetype_code, story)
  values (uid, p_archetype_code, left(trim(p_story), 2000))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.insert_legend_generation(text, text) from public, anon;
grant execute on function public.insert_legend_generation(text, text) to authenticated;
