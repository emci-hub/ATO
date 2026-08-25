-- Stage 7 — Chat + Report (block/mute included).
-- One thread per Circle connection. History stays; delete is delete-for-me.
-- Applied to the `ato` Supabase project (aijzsmupaaaxjctfgwpl).
--
-- Design notes:
--  * `messages` INSERT is rejected when a block exists in EITHER direction
--    (blocking stops sending both ways) and when no live connection exists
--    (unfriending closes the thread to new messages; history stays readable).
--  * `messages` SELECT hides (a) lines the reader deleted-for-themselves and
--    (b) lines from a user the reader has blocked — enforced server-side so
--    realtime events are filtered too, not just the UI.
--  * `reports.message_id` intentionally has no foreign key: it references
--    either `messages.id` (chat) or `sage_messages.id` (Sage response). RLS
--    enforces the reporter is a party to the message they report. Reports are
--    insert-only from the app; admin reads happen in the Supabase dashboard.
--  * `mutes` is local to the muter (select/insert/delete all require
--    auth.uid() = muter) — the muted user is never notified.

-- 1. blocks -----------------------------------------------------------------
create table public.blocks (
  blocked_by uuid not null references auth.users(id) on delete cascade,
  blocked_user uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocked_by, blocked_user),
  constraint blocks_distinct check (blocked_by <> blocked_user)
);

alter table public.blocks enable row level security;

-- Both parties can read: the blocker renders "you blocked X / messages hidden",
-- the blocked party renders the send-disabled state (block stops sending both ways).
create policy blocks_select_parties on public.blocks
  for select using (auth.uid() = blocked_by or auth.uid() = blocked_user);

create policy blocks_insert_owner on public.blocks
  for insert with check (auth.uid() = blocked_by);

create policy blocks_delete_owner on public.blocks
  for delete using (auth.uid() = blocked_by);

-- 2. mutes ------------------------------------------------------------------
create table public.mutes (
  muter uuid not null references auth.users(id) on delete cascade,
  muted_user uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter, muted_user),
  constraint mutes_distinct check (muter <> muted_user)
);

alter table public.mutes enable row level security;

create policy mutes_select_owner on public.mutes
  for select using (auth.uid() = muter);

create policy mutes_insert_owner on public.mutes
  for insert with check (auth.uid() = muter);

create policy mutes_delete_owner on public.mutes
  for delete using (auth.uid() = muter);

-- 3. threads -----------------------------------------------------------------
create table public.threads (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint threads_canonical_order check (user_a < user_b),
  constraint threads_distinct check (user_a <> user_b),
  constraint threads_pair_unique unique (user_a, user_b)
);

alter table public.threads enable row level security;

create policy threads_select_participant on public.threads
  for select using (auth.uid() = user_a or auth.uid() = user_b);

create policy threads_insert_participant on public.threads
  for insert with check (auth.uid() = user_a or auth.uid() = user_b);

-- Resolve-or-create the canonical thread for a connected peer.
create function public.get_or_create_thread(p_peer uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_a uuid;
  v_b uuid;
  v_id uuid;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if p_peer is null or p_peer = v_me then raise exception 'invalid peer'; end if;

  if not exists (
    select 1 from public.connections
    where (user_id = v_me and peer_id = p_peer)
       or (user_id = p_peer and peer_id = v_me)
  ) then
    raise exception 'not connected';
  end if;

  v_a := least(v_me, p_peer);
  v_b := greatest(v_me, p_peer);

  select t.id into v_id from public.threads t where t.user_a = v_a and t.user_b = v_b;
  if v_id is not null then return v_id; end if;

  insert into public.threads (user_a, user_b) values (v_a, v_b)
  on conflict (user_a, user_b) do nothing
  returning id into v_id;

  if v_id is null then
    select t.id into v_id from public.threads t where t.user_a = v_a and t.user_b = v_b;
  end if;

  return v_id;
end;
$$;

-- 4. messages ----------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (btrim(text) <> ''),
  deleted_for uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index messages_thread_created_idx on public.messages(thread_id, created_at);

alter table public.messages enable row level security;

-- Participant can read. Delete-for-me rows and blocked users' rows are hidden.
create policy messages_select_participant on public.messages
  for select using (
    exists (
      select 1 from public.threads t
      where t.id = messages.thread_id
        and (t.user_a = auth.uid() or t.user_b = auth.uid())
    )
    and not (messages.deleted_for @> array[auth.uid()])
    and not exists (
      select 1 from public.threads t
      join public.blocks b on (b.blocked_by = auth.uid() and b.blocked_user in (t.user_a, t.user_b))
      where t.id = messages.thread_id and messages.sender_id = b.blocked_user
    )
  );

-- Send requires: sender is a participant, an active connection still exists,
-- and neither party has blocked the other (blocking stops sending in BOTH
-- directions). The connection check matches either row direction because the
-- connections table is mirrored and each side only sees its own row under RLS.
create policy messages_insert_participant on public.messages
  for insert with check (
    messages.sender_id = auth.uid()
    and exists (
      select 1 from public.threads t
      where t.id = messages.thread_id
        and (t.user_a = auth.uid() or t.user_b = auth.uid())
    )
    and exists (
      select 1 from public.threads t
      join public.connections c on (
        (c.user_id = t.user_a and c.peer_id = t.user_b)
        or (c.user_id = t.user_b and c.peer_id = t.user_a)
      )
      where t.id = messages.thread_id
    )
    and not exists (
      select 1 from public.threads t
      join public.blocks b on (
        (b.blocked_by = auth.uid() and b.blocked_user in (t.user_a, t.user_b))
        or (b.blocked_user = auth.uid() and b.blocked_by in (t.user_a, t.user_b))
      )
      where t.id = messages.thread_id
    )
  );

-- Delete-a-line (Wave 1 = local delete-for-me): only the sender may mark a
-- message deleted-for-themselves. The row stays (history keeps).
create function public.delete_message_for_me(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.messages
  set deleted_for = case
    when deleted_for @> array[auth.uid()] then deleted_for
    else array_append(coalesce(deleted_for, '{}'), auth.uid())
  end
  where id = p_message_id and sender_id = auth.uid();
end;
$$;

-- 5. peer_profile + moderation helpers ---------------------------------------
-- Poster fields only, for connected peers. Replaces the full-row
-- me_select_connected read (which exposed facts/ai_consent/milestones and the
-- knocks/morning cues to every connected peer) — drop that policy here.
create function public.peer_profile(p_user_id uuid)
returns table (id uuid, name text, handle text, show_up text, talk_style text, recipe jsonb)
language sql
security definer
set search_path = public
as $$
  select m.id, m.name, m.handle, m.show_up, m.talk_style, m.recipe
  from public.me m
  where m.id = p_user_id
    and exists (
      select 1 from public.connections c
      where (c.user_id = auth.uid() and c.peer_id = m.id)
         or (c.user_id = m.id and c.peer_id = auth.uid())
    )
$$;

drop policy me_select_connected on public.me;

-- Party check for reports that ignores block-hiding on messages (you must be
-- able to report someone right after blocking them) and forbids reporting your
-- own chat line. Security definer so the messages SELECT block filter does not
-- reject the report; auth.uid() still resolves to the calling user.
create function public.is_message_party(p_message_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.messages m
    join public.threads t on t.id = m.thread_id
    where m.id = p_message_id
      and (t.user_a = auth.uid() or t.user_b = auth.uid())
      and m.sender_id <> auth.uid()
  )
$$;

-- 6. sage_messages -----------------------------------------------------------
-- Persists Sage exchanges so a Sage response is a reportable target (floor
-- requirement: a user can report a Sage response too).
create table public.sage_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'sage')),
  text text not null check (btrim(text) <> ''),
  created_at timestamptz not null default now()
);

create index sage_messages_user_created_idx on public.sage_messages(user_id, created_at);

alter table public.sage_messages enable row level security;

create policy sage_messages_select_own on public.sage_messages
  for select using (auth.uid() = user_id);

create policy sage_messages_insert_own on public.sage_messages
  for insert with check (auth.uid() = user_id);

-- 7. reports -----------------------------------------------------------------
-- from / target / reason / at. target is either a message_id or a user_id.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  "from" uuid not null references auth.users(id) on delete cascade,
  message_id uuid,
  user_id uuid references auth.users(id) on delete cascade,
  reason text not null check (btrim(reason) <> ''),
  at timestamptz not null default now(),
  constraint reports_exactly_one_target check (num_nonnulls(message_id, user_id) = 1)
);

create index reports_at_idx on public.reports(at);

alter table public.reports enable row level security;

-- No SELECT policy: reports are admin-visible only (queried in the dashboard).
create policy reports_insert_owner on public.reports
  for insert with check (
    auth.uid() = reports."from"
    and num_nonnulls(message_id, user_id) = 1
    and (
      (message_id is not null and (
        public.is_message_party(reports.message_id)
        or exists (
          select 1 from public.sage_messages s
          where s.id = reports.message_id and s.user_id = auth.uid()
        )
      ))
      or (user_id is not null and user_id <> auth.uid())
    )
  );

-- 8. Realtime -----------------------------------------------------------------
-- Stream new chat messages (RLS-scoped to thread participants).
alter publication supabase_realtime add table public.messages;
