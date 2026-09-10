-- wave63_fix_insert_bank_pool_items_ambiguous_prompt.sql
--
-- Fixes Sentry-reported Postgres error 42702 ("column reference \"prompt\" is
-- ambiguous") in insert_bank_pool_items (wave50), hit whenever the
-- AI-fallback path runs (question_bank_pool comes up short for an axis).
--
-- Root cause: `returns table(id uuid, prompt text)` implicitly declares a
-- plpgsql OUT variable named `prompt`. The bare `prompt` in the arbiter list
-- of `on conflict (prompt)` is parsed as a column reference and resolved via
-- plpgsql's column-ref hook, where it collides with the real
-- question_bank_pool.prompt column (42702, `variable_conflict = error` by
-- default). Same bug class as stage8_invite_pause_qualify_columns.sql /
-- stage8_invite_referral.sql (RETURNS TABLE column shadowing a real column)
-- — those fixed it by qualifying read references with a table alias, but an
-- ON CONFLICT arbiter column can't be alias-qualified (bare column name
-- only, per Postgres syntax), so the fix here renames the output column
-- instead, removing the collision entirely.
--
-- Isolated fix: every other RETURNS TABLE function in supabase/migrations
-- was grepped and has no equivalent collision. Client
-- (src/lib/questions/bank-pool.ts addToBankPool) only reads `.id` off the
-- response by array position — no client change needed.

drop function if exists public.insert_bank_pool_items(jsonb);

create function public.insert_bank_pool_items(p_items jsonb)
returns table(id uuid, out_prompt text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  item jsonb;
  v_prompt text;
  opt_count int;
  entry_count int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select count(*)::int into entry_count
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb));
  if entry_count > 25 then
    raise exception 'too many items (max 25)' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_prompt := left(trim(coalesce(item->>'prompt', '')), 400);
    if v_prompt = '' then
      raise exception 'prompt required' using errcode = '22023';
    end if;

    select count(*)::int into opt_count
    from jsonb_array_elements(coalesce(item->'options', '[]'::jsonb));
    if opt_count < 2 or opt_count > 3 then
      raise exception 'question needs 2-3 options' using errcode = '22023';
    end if;

    return query
      insert into public.question_bank_pool (axis, category, prompt, options, source)
      values (item->>'axis', item->>'category', v_prompt, item->'options', 'ai')
      on conflict (prompt) do update set prompt = excluded.prompt
      returning question_bank_pool.id, question_bank_pool.prompt;
  end loop;
end;
$$;

revoke all on function public.insert_bank_pool_items(jsonb) from public, anon;
grant execute on function public.insert_bank_pool_items(jsonb) to authenticated;

comment on function public.insert_bank_pool_items(jsonb) is
  'Writes freshly AI-generated drafts into question_bank_pool (source=ai) before they are shown to a user (T-02 bank-pool.ts addToBankPool), so every ongoing-round question always has a bank row to reference. on conflict (prompt) do update ... returning guarantees a row (new or pre-existing) always comes back, unlike do nothing. Output column renamed prompt -> out_prompt (wave63): RETURNS TABLE implicitly declared a plpgsql variable named prompt that collided (42702, Sentry-reported) with the on conflict (prompt) / set prompt = ... references above.';
