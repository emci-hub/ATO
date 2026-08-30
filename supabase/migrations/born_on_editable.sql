-- Birthday is now editable on You. Re-run the same 16+ / plausible-date
-- checks as complete_signup. Clearing a set date is still rejected. A
-- still-null legacy row may update other columns without filling born_on.

create or replace function public.me_born_on_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.born_on is null then
      raise exception 'age_required' using errcode = 'P0003';
    end if;
    if new.born_on > current_date or new.born_on < date '1900-01-01' then
      raise exception 'age_invalid' using errcode = 'P0004';
    end if;
    if not public.is_at_least_age(new.born_on, 16) then
      raise exception 'age_under_16' using errcode = 'P0005';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.born_on is distinct from old.born_on then
    if new.born_on is null then
      raise exception 'age_required' using errcode = 'P0003';
    end if;
    if new.born_on > current_date or new.born_on < date '1900-01-01' then
      raise exception 'age_invalid' using errcode = 'P0004';
    end if;
    if not public.is_at_least_age(new.born_on, 16) then
      raise exception 'age_under_16' using errcode = 'P0005';
    end if;
  end if;

  return new;
end;
$$;
