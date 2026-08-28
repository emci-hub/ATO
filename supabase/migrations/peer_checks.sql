-- Circle Check surface. Same pattern as peer_profile: a column-limited RPC
-- plus drop the row-level peer SELECT so a connected client cannot
-- from('checks').select('*') and read nudge_text.
-- Do not revoke SELECT (nudge_text) from authenticated — the owner's Home
-- path still uses select('*') on their own rows (checks_select_own).

drop function if exists public.peer_checks(uuid);

create function public.peer_checks(p_user_id uuid)
returns table (
  day integer,
  status text,
  read_text text,
  do_text text
)
language sql
security definer
set search_path = public
as $$
  select c.day, c.status, c.read_text, c.do_text
  from public.checks c
  where c.user_id = p_user_id
    and exists (
      select 1 from public.connections x
      where (x.user_id = auth.uid() and x.peer_id = c.user_id)
         or (x.user_id = c.user_id and x.peer_id = auth.uid())
    )
  order by c.day asc;
$$;

comment on function public.peer_checks(uuid) is
  'Connected-peer Check surface for Circle. day/status/read_text/do_text only. Never nudge_text.';

revoke all on function public.peer_checks(uuid) from public, anon;
grant execute on function public.peer_checks(uuid) to authenticated;

drop policy if exists checks_select_connected on public.checks;
