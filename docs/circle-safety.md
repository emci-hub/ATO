# Circle safety (master plan Step 7, wave104 + wave104b)

wave104 APPLIED 2026-10-20 (emci, SQL editor; 9 functions present). wave104b = reviewer fixes, apply after it.

Design and options: `docs/circle-design.md` (option A at launch). Pinned by `check:circle-safety`.

## What a person can do (Circle tab)

These tools moved from the Divecore Circle sheet into the Circle tab (emci 2026-10-21); same server functions, no schema
change. The Divecore sheet keeps visits and gifts only. UI: `src/app/(tabs)/circle.tsx`, `src/components/circle-panels.tsx`.

- **Add by handle** sends a request. Nothing is shared until the other person taps Accept. Asking someone who
  already asked you accepts. Cap: 20 friends, 20 pending requests, 20 requests an hour.
- **⋯ on any friend row** (and on an incoming request) → **Report** (6 fixed reasons, no free text) or **Block**
  (confirm with a second tap). Both are reached in 2 taps (⋯, then Report / Block). Block is silent: it removes the friendship and pending requests; the other person is never told and
  their request to you looks like "No one with that handle." **Blocked (n)** at the bottom → Unblock.
- **Support line** at the bottom of the Circle tab: support@emgens.com (since 2026-10-22; same address as You → Send feedback).
- Names and handles with slurs or staff-impersonation ("atoteam", "…support") are refused at sign-up and on the
  server (`me_name_guard`). Swearing is allowed (content policy).

Known gap (reviewer, accepted): someone calling the API by hand can still tell a block exists (the blocked
person can read the `blocks` row; `handle_taken` and signed-out `public_profile` still find the handle). The
`blocks` read stays two-sided because chat's message rules read it as the sender; revisit in Step 14 (chat).

## Report triage (one line: open the Supabase SQL editor once a day and run the query below)

```sql
select id, at, reason, reported_handle, user_id is null as account_gone, status
from public.reports where status = 'open' order by at;
```

Then, per report: look at the handle's profile (Table editor → `me`), decide, and mark it:

```sql
update public.reports set status = 'actioned', handled_at = now(), admin_note = 'paused profile' where id = '<id>';
```

Actions available today: pause the profile (Dev Hub → Admin, root), delete it (`root_delete_profile`), or dismiss
(`status = 'dismissed'`). Reports stay after either account is deleted (ids go null, handle + reason stay).

## Chat reports (Step 14, wave108, app 1.1+): emci owns this, daily, 24 h target

Chat reports land in the same `reports` table with `context->>'kind' = 'chat'`. The same daily query shows them; to read
what was reported (decrypted by the reporter's phone, the reported message + up to 5 before it, oldest first):

```sql
select id, at, reason, reported_handle,
       jsonb_path_query_array(context, '$.messages[*].text') as lines,
       context->>'reported_message_id' as reported_message
from public.reports where status = 'open' and context->>'kind' = 'chat' order by at;
```

The text comes from the reporter's phone; the server only checks that the message ids are real messages between the two.
Judge it by meaning (content policy): swearing and dark jokes between friends are fine; harassment, hate, unwanted sexual
content, spam and impersonation are not. Ladder (emci, 2026-10-21): **warn → chat off → ban**. In the SQL editor (levels:
`warned`, `chat_off`, `banned`):

```sql
insert into public.chat_restrictions (user_id, level)
select id, 'warned' from public.me where handle = '<handle>'
on conflict (user_id) do update set level = excluded.level, seen_at = null, updated_at = now();
```

To lift it: `delete from public.chat_restrictions where user_id = (select id from public.me where handle = '<handle>');`
(`admin_chat_restrict(handle, level)` does the same for a signed-in root, ready for a future Dev Hub button; the SQL editor
has no signed-in user, so it refuses there.)

`warned` shows the person a one-time banner in chat; `chat_off` and `banned` stop sending. For `banned`, also ban the
account in Supabase → Authentication → Users → the user → Ban (so they can't sign in). Then mark the report actioned
(query above). Ciphertext deletes itself after 30 days; reports stay.

## Before applying wave104: names that the new filter would refuse (read-only)

Existing rows are NOT changed or blocked; this only shows who would be refused if they edited their name/handle.

```sql
select id, handle, name from public.me
where public._name_not_allowed(name, 'name') or public._name_not_allowed(handle, 'handle');
```

(Run after wave104, since it defines `_name_not_allowed`.)

## Blocked-pair test (after wave104; dev-test accounts only; everything rolls back)

Replace `A` with the dev-test user id (`a70d3e0e-4c00-4a1e-8c0d-00000000d3e0`) and `B` with `atodev2`'s id
(`select id from me where handle = 'atodev2'`). Never use a real person's account.

```sql
begin;
-- make them friends, then A blocks B (as the service role, like a test seed)
insert into public.connections (user_id, peer_id) values ('A', 'B') on conflict do nothing;
insert into public.blocks (blocked_by, blocked_user) values ('A', 'B') on conflict do nothing;
-- act as B
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"B","role":"authenticated"}', true);
select public.circle_visit_allowed('A') as visit_allowed,          -- expect false
       public.categories_share_allowed('A') as categories_allowed, -- expect false
       public.category_share_status('A') as share_status,          -- expect null
       (select count(*) from public.peer_profile('A')) as profile_rows, -- expect 0
       (select count(*) from public.peer_checks('A')) as check_rows,    -- expect 0
       public.circle_request('atodev') as request;                 -- expect {"ok":false,"reason":"not_found"}
rollback;
```

`check_rows` and `profile_rows` are 0 for everyone now (closed until Step 7b).

## Compare test (after wave105; dev-test accounts only; everything rolls back)

Same `A` / `B` as above. Compare needs a friendship in BOTH directions and both switches on.

```sql
begin;
insert into public.connections (user_id, peer_id) values ('A', 'B'), ('B', 'A') on conflict do nothing;
insert into public.circle_compare_share (user_id, peer_id, enabled, updated_at)
  values ('A', 'B', true, now() + interval '1 second'), ('B', 'A', true, now() + interval '1 second')
  on conflict (user_id, peer_id) do update set enabled = true, updated_at = excluded.updated_at;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"B","role":"authenticated"}', true);
select public.circle_compare('A') as card;   -- expect {"ok":true,"shared":[...],"theirs":[...]}: keys only, no numbers,
                                              -- never attachment_* and never a low steadiness/competence/self_efficacy/
                                              -- growth_mindset/locus_of_control/conflict_* key
reset role;
update public.circle_compare_share set enabled = false where user_id = 'A' and peer_id = 'B';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"B","role":"authenticated"}', true);
select public.circle_compare('A') as after_switch_off;   -- expect {"ok":false,"reason":"not_allowed"}
reset role;
update public.circle_compare_share set enabled = true where user_id = 'A' and peer_id = 'B';
insert into public.blocks (blocked_by, blocked_user) values ('A', 'B') on conflict do nothing;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"B","role":"authenticated"}', true);
select public.circle_compare('A') as after_block;        -- expect {"ok":false,"reason":"not_allowed"}
rollback;
```
