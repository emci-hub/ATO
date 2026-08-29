-- Generic ordered-step capture on existing own-account Trace events.
-- One generation is still one event (30 min / 20 remaining / 7-day expire).
-- Surfaces register a step sequence into this shape; the viewer is not per-section.

alter table public.dev_trace_events
  drop constraint if exists dev_trace_events_surface_check;

alter table public.dev_trace_events
  add constraint dev_trace_events_surface_check
  check (surface in ('sage', 'explore', 'dawn', 'talk'));

alter table public.dev_trace_events
  add column if not exists steps jsonb not null default '[]'::jsonb;

alter table public.dev_trace_events
  drop constraint if exists dev_trace_events_steps_array;

alter table public.dev_trace_events
  add constraint dev_trace_events_steps_array
  check (jsonb_typeof(steps) = 'array');

comment on column public.dev_trace_events.steps is
  'Ordered pipeline steps: step_order, step_type (context_gather|model_call|guard_check|output), label, input_summary, output_summary, status (ok|flagged|failed), timestamp. Generic — any generating surface can log this shape.';

drop function if exists public.list_my_dev_trace_events();

create function public.list_my_dev_trace_events()
returns table (
  id uuid,
  created_at timestamptz,
  surface text,
  library_lines jsonb,
  trait_signals jsonb,
  raw_before text,
  raw_after text,
  guard_fired text,
  steps jsonb
)
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
  perform public.purge_expired_dev_trace();
  return query
    select e.id, e.created_at, e.surface, e.library_lines, e.trait_signals,
           e.raw_before, e.raw_after, e.guard_fired, e.steps
    from public.dev_trace_events e
    where e.user_id = uid
    order by e.created_at desc
    limit 40;
end;
$$;

revoke execute on function public.list_my_dev_trace_events() from public, anon;
grant execute on function public.list_my_dev_trace_events() to authenticated;

drop function if exists public.record_dev_trace(text, jsonb, jsonb, text, text, text);

create function public.record_dev_trace(
  p_surface text,
  p_library_lines jsonb,
  p_trait_signals jsonb,
  p_raw_before text,
  p_raw_after text,
  p_guard_fired text,
  p_steps jsonb default '[]'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_remaining int;
  v_steps jsonb := coalesce(p_steps, '[]'::jsonb);
  v_el jsonb;
begin
  if uid is null then
    return false;
  end if;
  if p_surface not in ('sage', 'explore', 'dawn', 'talk') then
    return false;
  end if;
  if jsonb_typeof(v_steps) <> 'array' then
    return false;
  end if;
  for v_el in select value from jsonb_array_elements(v_steps)
  loop
    if jsonb_typeof(v_el) <> 'object'
       or coalesce(v_el->>'step_type', '') not in ('context_gather', 'model_call', 'guard_check', 'output')
       or coalesce(v_el->>'status', '') not in ('ok', 'flagged', 'failed')
    then
      return false;
    end if;
  end loop;

  perform public.purge_expired_dev_trace();

  update public.dev_trace_sessions
    set remaining = remaining - 1
  where user_id = uid
    and expires_at > timezone('utc', now())
    and remaining > 0
  returning remaining into v_remaining;

  if v_remaining is null then
    return false;
  end if;

  insert into public.dev_trace_events (
    user_id, surface, library_lines, trait_signals, raw_before, raw_after, guard_fired, steps
  ) values (
    uid,
    p_surface,
    coalesce(p_library_lines, '[]'::jsonb),
    coalesce(p_trait_signals, '{}'::jsonb),
    p_raw_before,
    p_raw_after,
    nullif(btrim(coalesce(p_guard_fired, '')), ''),
    v_steps
  );

  if v_remaining <= 0 then
    delete from public.dev_trace_sessions where user_id = uid;
  end if;
  return true;
end;
$$;

revoke execute on function public.record_dev_trace(text, jsonb, jsonb, text, text, text, jsonb) from public, anon;
grant execute on function public.record_dev_trace(text, jsonb, jsonb, text, text, text, jsonb) to authenticated;

comment on function public.record_dev_trace(text, jsonb, jsonb, text, text, text, jsonb) is
  'Inserts a trace row for auth.uid() only when that user has an active capture session. Never accepts a target user_id. Optional p_steps is the generic ordered pipeline.';
