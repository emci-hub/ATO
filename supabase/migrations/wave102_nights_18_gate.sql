-- wave102: 18+ nights gate that does not trust the caller (Step 2 of docs/master-plan.md, 2026-10-20)
-- NOT APPLIED. Apply AFTER wave101_under18_server_gate.sql (docs/under18-server.md "Apply order").
--
-- Why: set_going only checked the person's age when the caller-supplied p_ages text looked like
-- "18+" (show_requires_18(p_ages)). A call with p_ages null, '' or "All Ages" skipped the check,
-- even for an account with no birthday or an under-18 birthday. ATO is 18+ (emci 2026-10-20) and
-- no server show table exists to look a show's ages up from, so joining a night now needs an 18+
-- birthday always, whatever p_ages says. A null born_on is NOT adult (is_at_least_age(null) = false);
-- born_on is a `date` column, so a blank or malformed value can never be stored.
--
-- Same signature, language, security mode, search_path and grants as wave2 / wave101. Changes:
--   * require_adult() first (as in wave101), so the refusal for a minor stays P0005 age_under_18.
--   * the age test no longer depends on show_requires_18(p_ages); p_ages is kept so the client
--     call and the old signature do not change.
-- Leaving a night (p_going = false) stays allowed for any adult as before. No row is touched here.

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
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_show_id is null or btrim(p_show_id) = '' then
    raise exception 'show_required' using errcode = 'P0007';
  end if;

  if p_going then
    select born_on into v_born from public.me where id = v_uid;
    -- wave102: never skipped. p_ages is caller-supplied text and is not trusted for the age test.
    if not public.is_at_least_age(v_born, 18) then
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
revoke all on function public.set_going(text,boolean,text) from public, anon;
grant execute on function public.set_going(text,boolean,text) to authenticated;
