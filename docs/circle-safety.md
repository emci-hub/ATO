# Circle safety (master plan Step 7, wave104 + wave104b)

wave104 APPLIED 2026-10-20 (emci, SQL editor; 9 functions present). wave104b = reviewer fixes, apply after it.

Design and options: `docs/circle-design.md` (option A at launch). Pinned by `check:circle-safety`.

## What a person can do (Divecore → Hideout → Circle sheet)

- **Add by handle** sends a request. Nothing is shared until the other person taps Accept. Asking someone who
  already asked you accepts. Cap: 20 friends, 20 pending requests, 20 requests an hour.
- **⋯ on any friend row** (and on an incoming request) → **Report** (6 fixed reasons, no free text) or **Block**
  (confirm with a second tap). Both are reached in 2 taps (⋯, then Report / Block). Block is silent: it removes the friendship and pending requests; the other person is never told and
  their request to you looks like "No one with that handle." **Blocked (n)** at the bottom → Unblock.
- **Support line** in the sheet: support@asstrollogs.com (same address as You → Send feedback).
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
