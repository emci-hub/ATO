-- Infinite Questions: persist skip so Skip this one / Skip the rest do not
-- rewrite traits, and so skipped items do not block the cached batch.

alter table public.question_items
  add column if not exists skipped_at timestamptz;

comment on column public.question_items.skipped_at is
  'Set when the person skips this item. Never a trait write.';

create or replace function public.answer_question_item(
  p_item_id uuid,
  p_option_index int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_option_index is null or p_option_index < 0 then
    raise exception 'invalid option' using errcode = '22023';
  end if;

  select jsonb_array_length(options) into n
    from public.question_items
    where id = p_item_id and user_id = uid;
  if n is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if p_option_index >= n then
    raise exception 'invalid option' using errcode = '22023';
  end if;

  update public.question_items
    set answered_option = p_option_index,
        answered_at = timezone('utc', now())
    where id = p_item_id
      and user_id = uid
      and answered_at is null
      and skipped_at is null;

  if not found then
    raise exception 'already answered' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.answer_question_item(uuid, int) from public, anon;
grant execute on function public.answer_question_item(uuid, int) to authenticated;

create or replace function public.skip_question_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.question_items
    set skipped_at = timezone('utc', now())
    where id = p_item_id
      and user_id = uid
      and answered_at is null
      and skipped_at is null;

  if not found then
    raise exception 'already closed' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.skip_question_item(uuid) from public, anon;
grant execute on function public.skip_question_item(uuid) to authenticated;

create or replace function public.skip_rest_question_pack(p_pack_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.question_items
    set skipped_at = timezone('utc', now())
    where pack_id = p_pack_id
      and user_id = uid
      and answered_at is null
      and skipped_at is null;
end;
$$;

revoke all on function public.skip_rest_question_pack(uuid) from public, anon;
grant execute on function public.skip_rest_question_pack(uuid) to authenticated;
