-- wave110: only the app's own chips can be saved in me.show_up / me.talk_style (roadmap v2 S3, 2026-10-22).
--
-- NOT APPLIED. emci applies it in the SQL editor after reading it (master-plan rule: ask before any apply).
--
-- Why: both fields are shown to anyone who looks up a handle (public_profile, wave104), and the phone writes
-- them straight to the row (src/lib/me.ts updateIntake → .from('me').update). The app only offers chips
-- (src/lib/intake.ts SHOW_UP_CHIPS / TALK_STYLE_CHIPS), but nothing on the server stopped a hand-made request
-- from putting any text on a public card.
--
-- Pattern copied from the live me_name_guard trigger (wave104): BEFORE INSERT OR UPDATE OF the columns,
-- people using the app only (service role, cron and the SQL editor pass), raise P0001.
-- Existing data is NOT changed: the check runs only when a value changes, so a stored older chip
-- (one account holds "getting through it", read-only count 2026-10-22) stays readable and keeps working
-- until that person picks a new chip. NULL and '' (the form's empty state, intake.ts:387) are allowed.
-- The lists below must equal the chip values in src/lib/intake.ts (pinned by check:circle-safety).

create or replace function public.me_card_fields_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'authenticated' then
    return new;
  end if;
  if (tg_op = 'INSERT' or new.show_up is distinct from old.show_up)
     and nullif(btrim(coalesce(new.show_up, '')), '') is not null
     and new.show_up not in ('push through it', 'stay steady', 'go quiet', 'push back', 'reach out to someone') then
    raise exception 'show_up_not_allowed' using errcode = 'P0001';
  end if;
  if (tg_op = 'INSERT' or new.talk_style is distinct from old.talk_style)
     and nullif(btrim(coalesce(new.talk_style, '')), '') is not null
     and new.talk_style not in ('loud', 'even', 'quiet') then
    raise exception 'talk_style_not_allowed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.me_card_fields_guard() from public, anon, authenticated;
drop trigger if exists me_card_fields_guard on public.me;
create trigger me_card_fields_guard
  before insert or update of show_up, talk_style on public.me
  for each row execute function public.me_card_fields_guard();
