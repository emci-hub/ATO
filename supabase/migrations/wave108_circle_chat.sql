-- wave108_circle_chat.sql
-- Circle option C: end-to-end encrypted 1:1 chat (master plan Step 14, emci approved 2026-10-21).
--
--   * Each phone makes an X25519 key pair (libsodium). Only the PUBLIC key reaches the server
--     (`chat_keys`). The secret key never leaves the phone's secure store.
--   * Messages are libsodium crypto_box ciphertext (`chat_messages`): the server stores ciphertext,
--     nonce and the two public keys used; it can never read the text.
--   * Only accepted friends who have not blocked each other can send or read (copies the
--     get_or_create_thread / _circle_blocked path from wave104).
--   * Ciphertext lives 30 days, then a daily cron job deletes it (emci: 30-day retention).
--   * Reports: the REPORTER's phone decrypts the reported message + the 5 before it and sends that
--     text in `reports.context` (emci: reported message + last 5). Reports survive account deletion
--     (wave104 SET NULL). The reported text comes from the reporter's phone; the server checks the
--     message ids are real messages between the two people, not the text itself.
--   * Moderation ladder (emci owns daily triage, 24 h target): warn -> chat off -> ban
--     (`chat_restrictions`, set by root with admin_chat_restrict). A ban also needs the Supabase
--     Auth ban in the dashboard (docs/circle-safety.md).
--   * The old plaintext stage7 `messages` table is left untouched (never used by the app).
--
-- Apply after wave107. Needs emci's OK (master plan rule 8).

begin;

-- 1. Public keys --------------------------------------------------------------------------------------

create table if not exists public.chat_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  public_key text not null check (public_key ~ '^[A-Za-z0-9_+/=-]{43,44}$'),
  updated_at timestamptz not null default now()
);
alter table public.chat_keys enable row level security;
-- No client policies: read and write only through the functions below.

-- 2. Encrypted messages -------------------------------------------------------------------------------

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  ciphertext text not null check (char_length(ciphertext) between 1 and 8000),
  nonce text not null check (nonce ~ '^[A-Za-z0-9_+/=-]{32}$'),
  sender_key text not null check (sender_key ~ '^[A-Za-z0-9_+/=-]{43,44}$'),
  recipient_key text not null check (recipient_key ~ '^[A-Za-z0-9_+/=-]{43,44}$'),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index if not exists chat_messages_thread_created on public.chat_messages (thread_id, created_at desc);
create index if not exists chat_messages_created on public.chat_messages (created_at);

alter table public.chat_messages enable row level security;
-- The two people may see their own rows (Realtime needs a select policy to deliver the insert ping).
-- The app reads history through chat_thread(), which also checks friendship and blocks.
drop policy if exists chat_messages_select_parties on public.chat_messages;
create policy chat_messages_select_parties on public.chat_messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

do $pub$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end;
$pub$;

-- 3. Moderation state ---------------------------------------------------------------------------------

create table if not exists public.chat_restrictions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  level text not null check (level in ('warned', 'chat_off', 'banned')),
  seen_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.chat_restrictions enable row level security;

-- Reports carry the reporter-decrypted messages.
alter table public.reports add column if not exists context jsonb;
-- Only chat_report (definer) may write `context`: the stage7 owner-insert policy stays for old clients, but a
-- direct insert with a context (invented ids/text, no rate limit) is refused. Restrictive = ANDed with it.
drop policy if exists reports_insert_no_context on public.reports;
create policy reports_insert_no_context on public.reports
  as restrictive for insert to authenticated
  with check (context is null);

-- 4. Helpers ------------------------------------------------------------------------------------------

-- Accepted friends (mirrored connection rows) and not blocked either way.
create or replace function public._chat_allowed(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_a is not null and p_b is not null and p_a <> p_b
    and exists (
      select 1 from public.connections
      where (user_id = p_a and peer_id = p_b)
         or (user_id = p_b and peer_id = p_a)
    )
    and not public._circle_blocked(p_a, p_b);
$$;
revoke all on function public._chat_allowed(uuid, uuid) from public, anon, authenticated;

create or replace function public._chat_level(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select level from public.chat_restrictions where user_id = p_uid), 'none');
$$;
revoke all on function public._chat_level(uuid) from public, anon, authenticated;

-- 5. Client functions ---------------------------------------------------------------------------------

create or replace function public.chat_set_key(p_public_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_public_key is null or p_public_key !~ '^[A-Za-z0-9_+/=-]{43,44}$' then
    return jsonb_build_object('ok', false, 'reason', 'bad_key');
  end if;
  if exists (select 1 from public.chat_keys where user_id = uid and public_key = p_public_key) then
    return jsonb_build_object('ok', true);
  end if;
  if not public._rate_limit_caller('chat_key', 10, 86400) then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;
  insert into public.chat_keys (user_id, public_key, updated_at)
  values (uid, p_public_key, now())
  on conflict (user_id) do update set public_key = excluded.public_key, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.chat_set_key(text) from public, anon;
grant execute on function public.chat_set_key(text) to authenticated;

-- The friend's current public key (null until their phone has opened chat once).
create or replace function public.chat_peer_key(p_peer uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_key text;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public._chat_allowed(uid, p_peer) then
    return jsonb_build_object('ok', false, 'reason', 'not_friends');
  end if;
  select public_key into v_key from public.chat_keys where user_id = p_peer;
  return jsonb_build_object('ok', true, 'key', v_key, 'level', public._chat_level(uid));
end;
$$;
revoke all on function public.chat_peer_key(uuid) from public, anon;
grant execute on function public.chat_peer_key(uuid) to authenticated;

create or replace function public.chat_send(
  p_peer uuid,
  p_ciphertext text,
  p_nonce text,
  p_sender_key text,
  p_recipient_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_thread uuid;
  v_id uuid;
  v_at timestamptz;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public._chat_allowed(uid, p_peer) then
    return jsonb_build_object('ok', false, 'reason', 'not_friends');
  end if;
  if public._chat_level(uid) in ('chat_off', 'banned') then
    return jsonb_build_object('ok', false, 'reason', 'chat_off');
  end if;
  if p_ciphertext is null or char_length(p_ciphertext) not between 1 and 8000 then
    return jsonb_build_object('ok', false, 'reason', 'too_long');
  end if;
  -- Both keys must be the current ones, so a stale phone re-fetches instead of writing
  -- a message nobody can open.
  if not exists (select 1 from public.chat_keys where user_id = uid and public_key = p_sender_key)
     or not exists (select 1 from public.chat_keys where user_id = p_peer and public_key = p_recipient_key) then
    return jsonb_build_object('ok', false, 'reason', 'key_changed');
  end if;
  if not public._rate_limit_caller('chat_send', 200, 3600) then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  v_thread := public.get_or_create_thread(p_peer);
  insert into public.chat_messages (thread_id, sender_id, recipient_id, ciphertext, nonce, sender_key, recipient_key)
  values (v_thread, uid, p_peer, p_ciphertext, p_nonce, p_sender_key, p_recipient_key)
  returning id, created_at into v_id, v_at;
  return jsonb_build_object('ok', true, 'id', v_id, 'at', v_at);
end;
$$;
revoke all on function public.chat_send(uuid, text, text, text, text) from public, anon;
grant execute on function public.chat_send(uuid, text, text, text, text) to authenticated;

-- Newest first, 50 at a time. Empty once unfriended or blocked either way.
create or replace function public.chat_thread(p_peer uuid, p_before timestamptz default null, p_limit int default 50)
returns table (
  id uuid,
  mine boolean,
  ciphertext text,
  nonce text,
  sender_key text,
  recipient_key text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public._chat_allowed(uid, p_peer) then
    return;
  end if;
  return query
    select m.id, m.sender_id = uid, m.ciphertext, m.nonce, m.sender_key, m.recipient_key, m.created_at
    from public.chat_messages m
    where ((m.sender_id = uid and m.recipient_id = p_peer) or (m.sender_id = p_peer and m.recipient_id = uid))
      and (p_before is null or m.created_at < p_before)
    order by m.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;
revoke all on function public.chat_thread(uuid, timestamptz, int) from public, anon;
grant execute on function public.chat_thread(uuid, timestamptz, int) to authenticated;

-- Report a message the friend sent. p_messages = the reporter's decrypted copy of that message and
-- up to 5 before it: [{"id": uuid, "mine": bool, "text": text, "at": timestamptz}, ...].
create or replace function public.chat_report(p_peer uuid, p_reason text, p_message_id uuid, p_messages jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_handle text;
  v_item jsonb;
  v_ids uuid[] := '{}';
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_reason is null or p_reason not in ('harassment', 'hate', 'sexual', 'spam', 'impersonation', 'other') then
    return jsonb_build_object('ok', false, 'reason', 'bad_reason');
  end if;
  if p_peer is null or p_peer = uid then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  -- The reported message must be one the friend sent to the reporter.
  if not exists (
    select 1 from public.chat_messages m
    where m.id = p_message_id and m.sender_id = p_peer and m.recipient_id = uid
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if p_messages is null or jsonb_typeof(p_messages) <> 'array'
     or jsonb_array_length(p_messages) not between 1 and 6 then
    return jsonb_build_object('ok', false, 'reason', 'bad_context');
  end if;
  for v_item in select * from jsonb_array_elements(p_messages) loop
    if jsonb_typeof(v_item -> 'text') is distinct from 'string' or char_length(v_item ->> 'text') > 2000
       or coalesce(v_item ->> 'id', '') !~ '^[0-9a-f-]{36}$' then
      return jsonb_build_object('ok', false, 'reason', 'bad_context');
    end if;
    v_ids := v_ids || (v_item ->> 'id')::uuid;
  end loop;
  -- Every id is a real message between these two people, and the reported one is included.
  if not (p_message_id = any (v_ids))
     or (select count(*) from public.chat_messages m
         where m.id = any (v_ids)
           and ((m.sender_id = uid and m.recipient_id = p_peer) or (m.sender_id = p_peer and m.recipient_id = uid)))
        <> cardinality(v_ids) then
    return jsonb_build_object('ok', false, 'reason', 'bad_context');
  end if;
  select m.handle into v_handle from public.me m where m.id = p_peer;
  if v_handle is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if not public._rate_limit_caller('chat_report', 10, 86400) then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;
  insert into public.reports ("from", user_id, reason, reported_handle, context)
  values (uid, p_peer, p_reason, v_handle,
          jsonb_build_object('kind', 'chat', 'reported_message_id', p_message_id, 'messages', p_messages));
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.chat_report(uuid, text, uuid, jsonb) from public, anon;
grant execute on function public.chat_report(uuid, text, uuid, jsonb) to authenticated;

-- The caller's own moderation level; a warning shows once, then chat_ack_warning() marks it seen.
create or replace function public.chat_my_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.chat_restrictions;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into r from public.chat_restrictions where user_id = uid;
  return jsonb_build_object(
    'level', coalesce(r.level, 'none'),
    'unseen_warning', coalesce(r.level = 'warned' and r.seen_at is null, false)
  );
end;
$$;
revoke all on function public.chat_my_status() from public, anon;
grant execute on function public.chat_my_status() to authenticated;

create or replace function public.chat_ack_warning()
returns void
language sql
security definer
set search_path = public
as $$
  update public.chat_restrictions set seen_at = now() where user_id = auth.uid() and seen_at is null;
$$;
revoke all on function public.chat_ack_warning() from public, anon;
grant execute on function public.chat_ack_warning() to authenticated;

-- 6. Root: the warn -> chat off -> ban ladder (copies dev_reset_ai_limits' root + handle lookup) -----

create or replace function public.admin_chat_restrict(p_handle text, p_level text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  root_id uuid;
  target uuid;
  target_handle text;
begin
  root_id := public.require_root();
  if p_level is null or p_level not in ('none', 'warned', 'chat_off', 'banned') then
    raise exception 'level must be none, warned, chat_off or banned' using errcode = '22023';
  end if;
  select id, handle into target, target_handle from public.me
    where lower(handle) in (lower(btrim(p_handle)), lower(ltrim(btrim(p_handle), '@')))
    limit 1;
  if target is null then
    raise exception 'no account with that handle' using errcode = 'P0002';
  end if;
  if p_level = 'none' then
    delete from public.chat_restrictions where user_id = target;
  else
    insert into public.chat_restrictions (user_id, level, seen_at, updated_at)
    values (target, p_level, null, now())
    on conflict (user_id) do update set level = excluded.level, seen_at = null, updated_at = now();
  end if;
  return jsonb_build_object('ok', true, 'handle', target_handle, 'level', p_level);
end;
$$;
revoke all on function public.admin_chat_restrict(text, text) from public, anon;
grant execute on function public.admin_chat_restrict(text, text) to authenticated;

-- 7. 30-day retention (daily) -------------------------------------------------------------------------

create or replace function public.purge_old_chat_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  delete from public.chat_messages where created_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.purge_old_chat_messages() from public, anon, authenticated;

do $cron$
begin
  begin
    perform cron.unschedule('chat-retention-30d');
  exception when others then
    null;
  end;
  perform cron.schedule(
    'chat-retention-30d',
    '23 4 * * *',
    $job$select public.purge_old_chat_messages();$job$
  );
exception when others then
  raise notice 'chat retention cron not scheduled: %', sqlerrm;
end;
$cron$;

-- 8. count_user_rows(uuid) · source: wave106_delete_proof.sql + the three chat tables -----------------
create or replace function public.count_user_rows(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.me where id = p_user_id)
  + (select count(*) from public.checks where user_id = p_user_id)
  + (select count(*) from public.connections where user_id = p_user_id or peer_id = p_user_id)
  + (select count(*) from public.messages where sender_id = p_user_id)
  + (select count(*) from public.threads where user_a = p_user_id or user_b = p_user_id)
  + (select count(*) from public.blocks where blocked_by = p_user_id or blocked_user = p_user_id)
  + (select count(*) from public.mutes where muter = p_user_id or muted_user = p_user_id)
  + (select count(*) from public.reports where "from" = p_user_id or user_id = p_user_id)
  + (select count(*) from public.apple_credentials where user_id = p_user_id)
  + (select count(*) from public.explore_packs where user_id = p_user_id)
  + (select count(*) from public.explore_entries where user_id = p_user_id)
  + (select count(*) from public.explore_reactions where user_id = p_user_id)
  + (select count(*) from public.ai_provider_log where user_id = p_user_id)
  + (select count(*) from public.ai_usage where user_id = p_user_id)
  + (select count(*) from public.question_packs where user_id = p_user_id)
  + (select count(*) from public.question_items where user_id = p_user_id)
  + (select count(*) from public.trait_history where user_id = p_user_id)
  + (select count(*) from public.token_events where user_id = p_user_id)
  + (select count(*) from public.trait_tracks where user_id = p_user_id)
  + (select count(*) from public.sage_title_flags where user_id = p_user_id)
  + (select count(*) from public.category_share where user_id = p_user_id or peer_id = p_user_id)
  + (select count(*) from public.going where user_id = p_user_id)
  + (select count(*) from public.trait_rolls where user_id = p_user_id)
  + (select count(*) from public.trait_roll_snapshots where user_id = p_user_id)
  + (select count(*) from public.question_bank_reroll_exclusions where user_id = p_user_id)
  + (select count(*) from public.ato_token_events where user_id = p_user_id)
  + (select count(*) from public.legend_generations where user_id = p_user_id)
  + (select count(*) from public.category_statements where user_id = p_user_id)
  + (select count(*) from public.daily_insights where user_id = p_user_id)
  + (select count(*) from public.invite_codes where owner_id = p_user_id)
  + (select count(*) from public.dev_access_grants where user_id = p_user_id or granted_by = p_user_id)
  + (select count(*) from public.dev_trace_sessions where user_id = p_user_id)
  + (select count(*) from public.dev_trace_events where user_id = p_user_id)
  + (select count(*) from public.trait_answers where user_id = p_user_id)
  + (select count(*) from public.trait_flags where user_id = p_user_id)
  + (select count(*) from public.trait_profile_snapshots where user_id = p_user_id)
  + (select count(*) from public.trait_answer_changes where user_id = p_user_id)
  + (select count(*) from public.daily_pick_answers where user_id = p_user_id)
  + (select count(*) from public.daily_line_days where user_id = p_user_id)
  + (select count(*) from public.legend_museum where user_id = p_user_id)
  + (select count(*) from public.category_deep_dives where user_id = p_user_id)
  + (select count(*) from public.play_saves where user_id = p_user_id)
  + (select count(*) from public.circle_gifts where user_id = p_user_id or peer_id = p_user_id)
  + (select count(*) from public.circle_visit_share where user_id = p_user_id or peer_id = p_user_id)
  + (select count(*) from public.circle_requests where from_user = p_user_id or to_user = p_user_id)
  + (select count(*) from public.circle_compare_share where user_id = p_user_id or peer_id = p_user_id)
  + (select count(*) from public.ai_library_seen where user_id = p_user_id)
  + (select count(*) from public.ai_library_reports where user_id = p_user_id)
  + (select count(*) from public.ai_library_wanted where user_id = p_user_id)
  + (select count(*) from public.ai_library_cards where created_by = p_user_id)
  + (select count(*) from public.daily_line_pool where created_by = p_user_id)
  + (select count(*) from public.question_bank_pool where created_by = p_user_id)
  + (select count(*) from public.me where referred_by = p_user_id)
  + (select count(*) from public.chat_keys where user_id = p_user_id)
  + (select count(*) from public.chat_messages where sender_id = p_user_id or recipient_id = p_user_id)
  + (select count(*) from public.chat_restrictions where user_id = p_user_id)
  + (select count(*) from auth.users where id = p_user_id);
$$;

revoke execute on function public.count_user_rows(uuid) from public, anon, authenticated;
grant execute on function public.count_user_rows(uuid) to service_role;

commit;
