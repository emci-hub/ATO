-- Element swords — NOT APPLIED. Play progress is a local save (playStore v29),
-- not a Supabase player table. Copy this into supabase/migrations only when
-- that economy moves server-side. Do not run it against a live database from
-- this change.
--
-- The rules mirror src/play/swords.ts: 3-merge and 5-merge stop at Epic,
-- Legendary is a mixed element plus one Relic, Divine is a Legendary plus
-- three Relics, undo only while the created swords are still unused, and a
-- claim key can pay a reward once.

create table if not exists public.play_sword_bags (
  user_id uuid primary key references auth.users (id) on delete cascade,
  bag jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.play_sword_bags enable row level security;

create policy play_sword_bags_select on public.play_sword_bags
  for select to authenticated
  using (auth.uid() = user_id);

create policy play_sword_bags_insert on public.play_sword_bags
  for insert to authenticated
  with check (auth.uid() = user_id);

-- No direct update or delete. Merges and claims go through the functions
-- below so a client cannot write an arbitrary bag.

create or replace function public.play_sword_claim(p_key text, p_bag jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing jsonb;
  claimed jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_key is null or length(p_key) = 0 or length(p_key) > 160 then
    raise exception 'bad claim key';
  end if;
  select bag into existing from public.play_sword_bags where user_id = auth.uid();
  if existing is null then
    existing := '{}'::jsonb;
  end if;
  claimed := coalesce(existing -> 'claimed', '[]'::jsonb);
  if claimed @> to_jsonb(p_key) then
    return existing;
  end if;
  -- One drop: the sword pile or the relic pile may grow by one, never both.
  if jsonb_array_length(coalesce(p_bag -> 'swords', '[]'::jsonb))
       - jsonb_array_length(coalesce(existing -> 'swords', '[]'::jsonb)) > 1
     or jsonb_array_length(coalesce(p_bag -> 'swords', '[]'::jsonb))
       < jsonb_array_length(coalesce(existing -> 'swords', '[]'::jsonb)) then
    raise exception 'claim changed the sword pile by more than one';
  end if;
  if jsonb_array_length(coalesce(p_bag -> 'relics', '[]'::jsonb))
       - jsonb_array_length(coalesce(existing -> 'relics', '[]'::jsonb)) > 1
     or jsonb_array_length(coalesce(p_bag -> 'relics', '[]'::jsonb))
       < jsonb_array_length(coalesce(existing -> 'relics', '[]'::jsonb)) then
    raise exception 'claim changed the relic pile by more than one';
  end if;
  if jsonb_array_length(coalesce(p_bag -> 'swords', '[]'::jsonb))
       > jsonb_array_length(coalesce(existing -> 'swords', '[]'::jsonb))
     and jsonb_array_length(coalesce(p_bag -> 'relics', '[]'::jsonb))
       > jsonb_array_length(coalesce(existing -> 'relics', '[]'::jsonb)) then
    raise exception 'claim granted a sword and a relic';
  end if;
  -- Remember the key on the server even after the client's ring drops it.
  claimed := claimed || jsonb_build_array(to_jsonb(p_key));
  while jsonb_array_length(claimed) > 256 loop
    claimed := claimed - 0;
  end loop;
  p_bag := jsonb_set(p_bag, '{claimed}', claimed);
  insert into public.play_sword_bags (user_id, bag)
  values (auth.uid(), p_bag)
  on conflict (user_id) do update
    set bag = excluded.bag, updated_at = now();
  return p_bag;
end;
$$;

create or replace function public.play_sword_merge(p_bag jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing jsonb;
  swords_before int;
  swords_after int;
  relics_before int;
  relics_after int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select bag into existing from public.play_sword_bags where user_id = auth.uid();
  if existing is null then
    raise exception 'no bag';
  end if;
  swords_before := jsonb_array_length(coalesce(existing -> 'swords', '[]'::jsonb));
  swords_after := jsonb_array_length(coalesce(p_bag -> 'swords', '[]'::jsonb));
  relics_before := jsonb_array_length(coalesce(existing -> 'relics', '[]'::jsonb));
  relics_after := jsonb_array_length(coalesce(p_bag -> 'relics', '[]'::jsonb));
  -- Undo puts the spent copies back (5-merge is +3 swords, Divine is +3
  -- relics) and clears `undo`. A fresh merge never grows either pile, and
  -- never removes more swords than a 5-merge.
  if existing -> 'undo' is not null and jsonb_typeof(existing -> 'undo') = 'object'
     and (not (p_bag ? 'undo') or p_bag -> 'undo' is null or jsonb_typeof(p_bag -> 'undo') = 'null') then
    if swords_after > swords_before + 3 or relics_after > relics_before + 3 then
      raise exception 'undo restored more than the last merge spent';
    end if;
    if swords_after < swords_before - 4 or relics_after < relics_before then
      raise exception 'undo removed copies';
    end if;
  else
    if swords_after > swords_before then
      raise exception 'merge grew the sword pile';
    end if;
    if relics_after > relics_before then
      raise exception 'merge grew the relic pile';
    end if;
    if swords_before - swords_after > 4 then
      raise exception 'merge removed more swords than a 5-merge';
    end if;
  end if;
  insert into public.play_sword_bags (user_id, bag)
  values (auth.uid(), p_bag)
  on conflict (user_id) do update
    set bag = excluded.bag, updated_at = now();
  return p_bag;
end;
$$;

revoke all on function public.play_sword_claim(text, jsonb) from public;
revoke all on function public.play_sword_merge(jsonb) from public;
grant execute on function public.play_sword_claim(text, jsonb) to authenticated;
grant execute on function public.play_sword_merge(jsonb) to authenticated;
