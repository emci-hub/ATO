-- Wave 2 Stage 2 — I'm going + friend colors.
-- Going is opt-in, per user per show. Colors (≥3 of a hue) are aggregated;
-- raw counts never leave the RPC. Faces only when me.visible is true.
-- 18+ nights call is_at_least_age(born_on, 18). Calgary weekend.json is
-- unchanged (honest empty until Edmtrain).

-- 1. Visibility (plan field `show`; named visible — SHOW is reserved) --------
alter table public.me
  add column if not exists visible boolean not null default true;

comment on column public.me.visible is
  'Around face visibility. Default true. Going still counts toward color blobs when false. Plan name: show.';

-- 2. Hash parity with src/lib/color.ts colorHueFromShowUp --------------------
create or replace function public.color_hue_from_show_up(p_show_up text)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  s text;
  h bigint := 0;
  i int;
  c int;
  wrap bigint := 4294967296;
  half bigint := 2147483648;
begin
  s := lower(btrim(coalesce(p_show_up, '')));
  if s = '' then
    return null;
  end if;
  for i in 1..char_length(s) loop
    c := ascii(substr(s, i, 1));
    h := h * 31 + c;
    h := ((h % wrap) + wrap) % wrap;
    if h >= half then
      h := h - wrap;
    end if;
  end loop;
  return (abs(h) % 360)::int;
end;
$$;

revoke execute on function public.color_hue_from_show_up(text) from public, anon;
grant execute on function public.color_hue_from_show_up(text) to authenticated;

-- 3. 18+ ages parser (parity with src/lib/around/ages.ts) -------------------
create or replace function public.show_requires_18(p_ages text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_ages is not null
     and btrim(p_ages) <> ''
     and (
       lower(btrim(p_ages)) ~ '\m(18|19)\s*\+'
       or lower(btrim(p_ages)) ~ '\m(18|19)\s*(and|&)\s*(over|older)'
     );
$$;

revoke execute on function public.show_requires_18(text) from public, anon;
grant execute on function public.show_requires_18(text) to authenticated;

-- 4. going ------------------------------------------------------------------
create table if not exists public.going (
  user_id uuid not null references auth.users(id) on delete cascade,
  show_id text not null check (btrim(show_id) <> '' and char_length(show_id) <= 200),
  created_at timestamptz not null default now(),
  primary key (user_id, show_id)
);

create index if not exists going_show_id_idx on public.going (show_id);

comment on table public.going is
  'Opt-in I''m going. One row per user per show. Insert/delete only via set_going.';

alter table public.going enable row level security;

drop policy if exists going_select_own on public.going;
create policy going_select_own on public.going
  for select using (auth.uid() = user_id);

-- No insert/update/delete policies: clients cannot write going rows directly.
revoke all on table public.going from public, anon, authenticated;
grant select on table public.going to authenticated;

-- 5. Snapshot: colors at ≥3, visible faces, no counts -----------------------
create or replace function public.night_snapshot(p_show_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_going boolean := false;
  v_colors jsonb;
  v_faces jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select exists (
    select 1 from public.going g
    where g.user_id = v_uid and g.show_id = p_show_id
  ) into v_going;

  select coalesce(jsonb_agg(hue order by hue), '[]'::jsonb)
  into v_colors
  from (
    select public.color_hue_from_show_up(m.show_up) as hue
    from public.going g
    join public.me m on m.id = g.user_id
    where g.show_id = p_show_id
      and public.color_hue_from_show_up(m.show_up) is not null
    group by public.color_hue_from_show_up(m.show_up)
    having count(*) >= 3
  ) hues;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'name', m.name,
        'handle', m.handle,
        'show_up', m.show_up,
        'recipe', m.recipe
      )
      order by g.created_at
    ),
    '[]'::jsonb
  )
  into v_faces
  from public.going g
  join public.me m on m.id = g.user_id
  where g.show_id = p_show_id
    and m.visible is true
    and not exists (
      select 1 from public.blocks b
      where (b.blocked_by = v_uid and b.blocked_user = m.id)
         or (b.blocked_by = m.id and b.blocked_user = v_uid)
    );

  return jsonb_build_object(
    'going', v_going,
    'colors', v_colors,
    'faces', v_faces
  );
end;
$$;

revoke execute on function public.night_snapshot(text) from public, anon;
grant execute on function public.night_snapshot(text) to authenticated;

create or replace function public.set_going(p_show_id text, p_going boolean, p_ages text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_born date;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_show_id is null or btrim(p_show_id) = '' then
    raise exception 'show_required' using errcode = 'P0007';
  end if;

  if p_going then
    select born_on into v_born from public.me where id = v_uid;
    if public.show_requires_18(p_ages) and not public.is_at_least_age(v_born, 18) then
      raise exception 'going_under_18' using errcode = 'P0008';
    end if;

    insert into public.going (user_id, show_id)
    values (v_uid, btrim(p_show_id))
    on conflict (user_id, show_id) do nothing;
  else
    delete from public.going
    where user_id = v_uid and show_id = btrim(p_show_id);
  end if;

  return public.night_snapshot(btrim(p_show_id));
end;
$$;

revoke execute on function public.set_going(text, boolean, text) from public, anon;
grant execute on function public.set_going(text, boolean, text) to authenticated;
