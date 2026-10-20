# Under-18 server gate (wave101)

Policy (emci 2026-10-20): ATO is 18+. A person under 18, or an account with **no birthday yet**
(`me.born_on` null), is blocked **without losing anything**: the account and every row stay as they are,
and access comes back by itself on the 18th birthday (worked out from `born_on` on `current_date`, nothing
stored). This file is the server half; the app half (block screen, age confirmation for a missing birthday)
is `docs/under18-access.md` (client agent).

File: `supabase/migrations/wave101_under18_server_gate.sql` — **NOT APPLIED**. Pinned by
`npm run check:under18-server` (`scripts/under18-server-check.ts`, part of `check:ota-gate`: the gate runs
every `check:*` script that is not on its live-only list).

## What stays open, what is refused

| Still allowed (account management) | How |
|---|---|
| Read their own `me` row | `me_select_own` policy, untouched |
| Set / confirm their birthday | direct `update me set born_on` (`src/lib/me.ts` `setBornOn`): `me_adult_guard` lets `born_on` through; `me_born_on_guard` (wave99b) still refuses an under-18 date |
| Sign out | client only |
| Support | email, client only |
| Delete the account | `delete-account` Edge Function (service role, `auth.admin.deleteUser`, ON DELETE CASCADE). Nothing in wave101 touches deletes |
| Apple sign-in link (needed to revoke at deletion) | `apple-link` Edge Function, untouched |
| Consent / legal reads, AI consent switch | `app_config` read, `me.ai_consent` (allowed column) |

Everything else is **app use** and is refused by the server with **errcode `P0005`, message `age_under_18`**
(the code sign-up already uses, so `src/lib/age.ts` can map it): AI library and every `claim_*` / token
earn / spend / refund, daily check-ins and rewards, trait / answer / round writes, Daily Pick, Circle
(connect, visits, gifts, peer reads, chat), Divecore cloud save, invites/referrals, Around/going, dev tools
and root admin.

## How it is enforced (tested patterns only)

1. **`is_adult(uuid)`** — `born_on is not null and is_at_least_age(born_on, 18)` on the `me` row; no row =
   false. `security definer`, `stable`, `search_path = public`, **revoked from public, anon, authenticated**
   (like `_library_crisis`, wave93), so nobody can probe another account's age.
   **A null `born_on` is NOT adult** (the old wave101 draft said the opposite).
2. **`is_adult()`** (no argument, the caller only, like `is_root()`) and **`require_adult()`** (the
   `require_root()` pattern: raise `P0005 age_under_18`, else nothing). Both granted to `authenticated`
   only: RLS policies run as the caller and need EXECUTE; they reveal only the caller's own status.
3. **Guarded copies.** Each of the 110 app-use functions is restated with `create or replace`, its latest
   definition copied **word for word** from the migration named in its comment, plus **one line** as the
   first statement: `perform public.require_adult();` (plpgsql) or `select public.require_adult();` (sql).
   Same signature, language, security mode and search_path; each copy restates its current grants
   (`revoke … from public, anon; grant … to authenticated`), which changes nothing. `check:under18-server`
   re-derives every source and fails on any other difference.
4. **`me_adult_guard`** — BEFORE UPDATE raise-trigger on `me` (the `me_born_on_guard` / `me_timezone_guard`
   pattern). When the person edits **their own** row and the **old** `born_on` is missing or under 18, only
   `born_on`, `timezone`, `ai_consent`, `updated_at` may change; anything else raises `P0005`. Service role,
   cron and the SQL editor are exempt (the `me_timezone_guard` rule), and so are cascades started by someone
   else (`new.id <> auth.uid()`, e.g. `referred_by` set null when a referrer deletes their account).
   Why a trigger and not a restrictive policy: `me` UPDATE is also the birthday path, and a policy cannot
   compare old and new columns.
5. **`connections_adult_guard`** — BEFORE INSERT raise-trigger (from the old draft): a new Circle link needs
   both people adult; the caller gets `P0005`, a minor peer gets the generic `not_allowed` (never says why).
   Existing links are not touched. Removing a link stays allowed (safety).
6. **Restrictive RLS** (`as restrictive … ((select public.is_adult()))`, `to authenticated`) only where the
   client still writes directly, plus `messages` SELECT (peer-written content). Adults see no change.

No row is deleted, updated or inserted; no table, column or existing policy changes; one transaction.

## Endpoint inventory

Totals: **9 Edge Functions**; **129 client-callable functions** (110 gated, 19 open); **63 tables** (59 from
migrations + 4 dashboard-only: `me`, `connections`, `checks`, `crisis_flags`), of which **14 have a direct
client write path** (10 gated here, 4 left open: `blocks`, `mutes`, `reports`, `access_requests`);
**1 storage bucket**; **no push registration endpoint**.

How "client-callable" was worked out: every migration replayed in history order (wave80 excluded: prepared,
never applied), latest definition of each signature, and its EXECUTE for `anon` / `authenticated`
(Supabase's default privileges grant both unless a migration revoked them). Dashboard-only objects
(`me`, `connections`, `public_profile`, `peer_profile`, `checks`, `crisis_flags`) come from
`supabase/baseline/` and the migrations that alter them; the live database may hold more — see
"Before applying" (queries 4–6).

### 1. Edge Functions (highest risk first)

| Function | Auth | Spends AI / tokens, shared data | Class | Under-18 effect |
|---|---|---|---|---|
| `ai-library` | user JWT (`getUser`), service role inside | **model call + AI tokens**, writes shared library cards | APP-USE | Gated by `claim_library_write` (called **as the caller**, before any model call or charge): raises `P0005`, the function answers `{ok:false, reason:'failed'}`. Before the claim it only reads `library_angle_counts` (service role, no cost) and the caller's `ai_consent`. No code change needed. *Optional (not done, needs a deploy):* map `P0005` to `reason:'age'` next to the existing `P0043 → 'quota'` line. |
| `review-access` | user JWT, checks `me.is_root` | none (founder access requests) | ADMIN | Calls `list_pending_access_requests` / `deny_access_request` / `approve_access_request` as the caller: all gated. Root must have an 18+ birthday. |
| `dev-unlock` | user JWT, rate limited | none; returns `{ok}` for the dev password, writes nothing | DEV | Not gated (Edge Function, not my file). Everything a dev unlock opens is a gated RPC, and the client hides dev tools when blocked. *Optional:* refuse when `is_adult()` is false (one RPC call). |
| `delete-account` | user JWT, then service role | deletes the auth user (cascade), `count_user_rows`, audit row | ACCOUNT | **Open, unchanged.** No delete trigger / policy is added; `me_adult_guard` ignores service-role and cascade updates. |
| `apple-link` | user JWT, service role upsert into `apple_credentials` | none | ACCOUNT | Open: the stored Apple token is what deletion revokes (Apple 5.1.1(v)). |
| `password-login` | anon, rate limited | none | PUBLIC | Pre-sign-in. |
| `ai-library-fill` | cron secret (`library_fill_token_ok`) | model calls, shared library | SERVER | No user; not reachable as a person. |
| `refresh-around` | cron secret | writes the public `around` bucket | SERVER | No user. |
| `ai-generate` | — | none (410 stub since wave98) | CLOSED | — |

### 2. Database functions (RPC), highest risk first

"Old wave101" = whether the previous draft of this file gated it. Copies from `wave99*` / `wave100` need
those files applied first (see "Apply order").

**AI library / AI claims / tokens (spends money or tokens, or writes shared AI content)**

| # | Function | Latest source | Old wave101 | Gate |
|---|---|---|---|---|
| 1 | `claim_library_write(text,text,text,text)` | wave95_ai_library_key_regex.sql | gated | guard (plpgsql) |
| 2 | `library_serve(text,text,text)` | wave95_ai_library_key_regex.sql | gated | guard (plpgsql) |
| 3 | `library_want(text,text[],text)` | wave95_ai_library_key_regex.sql | gated | guard (plpgsql) |
| 4 | `library_team_size(text)` | wave94_ai_library_fill.sql | **open** | guard (sql) |
| 5 | `claim_ai_call(text)` | wave17_infinite_questions.sql | **open** | guard (plpgsql) |
| 6 | `claim_category_deep_dive()` | wave92_ai_tokens.sql | **open** | guard (plpgsql) |
| 7 | `claim_story_generate()` | wave92_ai_tokens.sql | **open** | guard (plpgsql) |
| 8 | `claim_legend_figure_story()` | wave92_ai_tokens.sql | **open** | guard (plpgsql) |
| 9 | `claim_legend_story_generation()` | wave58_legend_generations.sql | **open** | guard (plpgsql) |
| 10 | `claim_title_generate()` | wave20_trait_tracks_titles.sql | **open** | guard (plpgsql) |
| 11 | `claim_questions_batch()` | wave17_infinite_questions.sql | **open** | guard (plpgsql) |
| 12 | `claim_roll_generation()` | wave48_roll_generation_quota.sql | **open** | guard (plpgsql) |
| 13 | `claim_roll()` | wave46_trait_rolls.sql | **open** | guard (plpgsql) |
| 14 | `refund_ai_tokens(text)` | wave92_ai_tokens.sql | **open** | guard (plpgsql) |
| 15 | `claim_daily_checkin()` | wave98_server_hardening.sql | **open** | guard (plpgsql) |
| 16 | `claim_full_profile_complete()` | wave92_ai_tokens.sql | **open** | guard (plpgsql) |
| 17 | `claim_intake_complete()` | wave45_trait_redesign_tokens.sql | **open** | guard (plpgsql) |
| 18 | `claim_ongoing_round_complete(uuid)` | wave92_ai_tokens.sql | **open** | guard (plpgsql) |
| 19 | `earn_tokens(text)` | wave45_trait_redesign_tokens.sql | **open** | guard (plpgsql) |
| 20 | `spend_tokens(text)` | wave19_trait_history_tokens.sql | **open** | guard (plpgsql) |
| 21 | `spend_ato_tokens_category_reroll(text)` | wave51_ato_tokens.sql | **open** | guard (plpgsql) |
| 22 | `spend_ato_tokens_legend_reroll()` | wave51_ato_tokens.sql | **open** | guard (plpgsql) |
| 23 | `spend_ato_tokens_question_reroll(uuid)` | wave51_ato_tokens.sql | **open** | guard (plpgsql) |
| 24 | `save_category_deep_dive(text,text,jsonb,date)` | wave91_category_deep_dive_bundle.sql | **open** | guard (plpgsql) |
| 25 | `save_legend_figure_story(text,integer,text,text,jsonb,date)` | wave89_legend_museum.sql | **open** | guard (plpgsql) |
| 26 | `insert_legend_generation(text,text)` | wave58_legend_generations.sql | **open** | guard (plpgsql) |
| 27 | `legend_angle_counts(text)` | wave89_legend_museum.sql | **open** | guard (plpgsql) |

**Circle, peer reads, chat, invites, Around (other people)**

| # | Function | Latest source | Old wave101 | Gate |
|---|---|---|---|---|
| 28 | `circle_visit_allowed(uuid)` | wave97_circle_visits.sql | gated | guard (sql) |
| 29 | `circle_visit_friends()` | wave97_circle_visits.sql | **open** | guard (plpgsql) |
| 30 | `circle_visit_room(uuid)` | wave97_circle_visits.sql | gated | guard (plpgsql) |
| 31 | `circle_send_gift(uuid)` | wave97_circle_visits.sql | gated | guard (plpgsql) |
| 32 | `circle_gift_inbox()` | wave97_circle_visits.sql | gated | guard (plpgsql) |
| 33 | `circle_open_gift(uuid)` | wave97_circle_visits.sql | **open** | guard (plpgsql) |
| 34 | `set_circle_visit_share(uuid,boolean)` | wave97_circle_visits.sql | **open** | guard (plpgsql) |
| 35 | `peer_profile(uuid)` | stage7_chat_report.sql | **open** | guard (sql) |
| 36 | `peer_checks(uuid)` | peer_checks.sql | **open** | guard (sql) |
| 37 | `peer_category_pack(uuid)` | wave21_playfulness_categories.sql | **open** | guard (sql) |
| 38 | `categories_share_allowed(uuid)` | wave21_playfulness_categories.sql | **open** | guard (sql) |
| 39 | `category_share_status(uuid)` | wave21_playfulness_categories.sql | **open** | guard (sql) |
| 40 | `legend_circle_friends(text)` | wave89_legend_museum.sql | **open** | guard (sql) |
| 41 | `get_or_create_thread(uuid)` | stage7_chat_report.sql | **open** | guard (plpgsql) |
| 42 | `delete_message_for_me(uuid)` | stage7_chat_report.sql | **open** | guard (plpgsql) |
| 43 | `my_referrals()` | stage8_invite_referral.sql | **open** | guard (sql) |
| 44 | `set_going(text,boolean,text)` | wave2_going_colors.sql | **open** | guard (plpgsql) |
| 45 | `night_snapshot(text)` | wave2_going_colors.sql | **open** | guard (plpgsql) |

**Traits, answers, question sets, rolls**

| # | Function | Latest source | Old wave101 | Gate |
|---|---|---|---|---|
| 46 | `answer_intake_question(text,integer)` | wave79_trait_checkpoint.sql | **open** | guard (plpgsql) |
| 47 | `answer_round_item(uuid,integer)` | wave85_fixed_question_bank.sql | **open** | guard (plpgsql) |
| 48 | `answer_bank_item(uuid,integer)` | wave85_fixed_question_bank.sql | **open** | guard (plpgsql) |
| 49 | `answer_question_item(uuid,integer)` | wave18_question_skip.sql | **open** | guard (plpgsql) |
| 50 | `set_trait_direct(text,double precision,text)` | wave79_trait_checkpoint.sql | **open** | guard (plpgsql) |
| 51 | `record_game_pick(text,double precision)` | wave79_trait_checkpoint.sql | **open** | guard (plpgsql) |
| 52 | `confirm_trait_sources(text[])` | wave79_trait_checkpoint.sql | **open** | guard (plpgsql) |
| 53 | `stamp_axis_depth(text)` | wave79_trait_checkpoint.sql | **open** | guard (plpgsql) |
| 54 | `set_trait_flag(text,boolean)` | wave85_fixed_question_bank.sql | **open** | guard (plpgsql) |
| 55 | `serve_bank_set()` | wave100_question_retire.sql (not applied yet) | **open** | guard (plpgsql) |
| 56 | `change_bank_answer(uuid,text,integer)` | wave100_question_retire.sql (not applied yet) | **open** | guard (plpgsql) |
| 57 | `undo_change_session(uuid)` | wave86_change_answers_history.sql | **open** | guard (plpgsql) |
| 58 | `start_fresh(boolean)` | wave86_change_answers_history.sql | **open** | guard (plpgsql) |
| 59 | `skip_question_item(uuid)` | wave18_question_skip.sql | **open** | guard (plpgsql) |
| 60 | `skip_rest_question_pack(uuid)` | wave18_question_skip.sql | **open** | guard (plpgsql) |
| 61 | `reroll_question_item(uuid)` | wave74_bank_pool_owner_and_ai_refund.sql | **open** | guard (plpgsql) |
| 62 | `fetch_bank_candidates(text,integer)` | wave74_bank_pool_owner_and_ai_refund.sql | **open** | guard (plpgsql) |
| 63 | `bank_pool_depth()` | wave74_bank_pool_owner_and_ai_refund.sql | **open** | guard (plpgsql) |
| 64 | `insert_question_pack(date,jsonb)` | wave17_infinite_questions.sql | **open** | guard (plpgsql) |
| 65 | `store_roll(uuid,jsonb,jsonb)` | wave46_trait_rolls.sql | **open** | guard (plpgsql) |
| 66 | `reveal_roll_item(uuid)` | wave47_reveal_requires_ready.sql | **open** | guard (plpgsql) |

**Daily surfaces**

| # | Function | Latest source | Old wave101 | Gate |
|---|---|---|---|---|
| 67 | `answer_daily_pick(date,text,integer)` | wave82_daily_pick.sql | **open** | guard (plpgsql) |
| 68 | `daily_pick_split(text,date)` | wave83_daily_pick_split_by_day.sql | **open** | guard (plpgsql) |
| 69 | `record_check(integer,date,text,text,text,text,text,boolean)` | record_check_no_card.sql | **open** | guard (plpgsql) |
| 70 | `record_daily_line(date,text)` | wave77_daily_lines.sql | **open** | guard (plpgsql) |
| 71 | `react_daily_line(date,text)` | wave77_daily_lines.sql | **open** | guard (plpgsql) |
| 72 | `insert_daily_line_pool_items(jsonb)` | wave77_daily_lines.sql | **open** | guard (plpgsql) |
| 73 | `clear_my_daily_lines()` | wave77_daily_lines.sql | **open** | guard (plpgsql) |
| 74 | `insert_daily_insight(integer,date,text,text,text,text,text)` | wave87_insight_title_120.sql | **open** | guard (plpgsql) |
| 75 | `insert_explore_pack(date,text,text,jsonb)` | explore.sql | **open** | guard (plpgsql) |
| 76 | `record_explore_reaction(uuid,boolean)` | explore.sql | **open** | guard (plpgsql) |
| 77 | `insert_category_statements(jsonb)` | wave59_category_statements.sql | **open** | guard (plpgsql) |
| 78 | `log_jargon_guard(text)` | voice_preset_jargon.sql | **open** | guard (plpgsql) |
| 79 | `log_phrase_guard(text)` | explore.sql | **open** | guard (plpgsql) |

**Divecore**

| # | Function | Latest source | Old wave101 | Gate |
|---|---|---|---|---|
| 80 | `save_play_doc(jsonb,integer,timestamptz)` | wave96_play_saves.sql | **open** | guard (plpgsql) |
| 81 | `bump_play_counter(text)` | wave96_play_saves.sql | **open** | guard (plpgsql) |

**Dev tools and root admin**

| # | Function | Latest source | Old wave101 | Gate |
|---|---|---|---|---|
| 82 | `apply_dev_trait_preset(jsonb,jsonb,jsonb,jsonb,jsonb)` | wave79_trait_checkpoint.sql | **open** | guard (plpgsql) |
| 83 | `dev_fill_bank()` | wave100_question_retire.sql (not applied yet) | **open** | guard (plpgsql) |
| 84 | `dev_reset_ai_limits(text)` | wave92_ai_tokens.sql | **open** | guard (plpgsql) |
| 85 | `reset_dev_test_user()` | wave97_circle_visits.sql | **open** | guard (plpgsql) |
| 86 | `reset_my_test_data()` | wave75_reset_my_test_data.sql | **open** | guard (plpgsql) |
| 87 | `start_over_my_test_data()` | wave85_fixed_question_bank.sql | **open** | guard (plpgsql) |
| 88 | `has_dev_trace_capability()` | dev_access.sql | **open** | guard (sql) |
| 89 | `my_dev_access()` | dev_access.sql | **open** | guard (plpgsql) |
| 90 | `my_dev_trace_session()` | dev_access.sql | **open** | guard (plpgsql) |
| 91 | `start_dev_trace()` | dev_access.sql | **open** | guard (plpgsql) |
| 92 | `stop_dev_trace()` | dev_access.sql | **open** | guard (plpgsql) |
| 93 | `record_dev_trace(text,jsonb,jsonb,text,text,text,jsonb)` | dev_trace_steps.sql | **open** | guard (plpgsql) |
| 94 | `list_my_dev_trace_events()` | dev_trace_steps.sql | **open** | guard (plpgsql) |
| 95 | `list_dev_access_grants(text)` | dev_access.sql | **open** | guard (plpgsql) |
| 96 | `set_dev_access_grants(text,text[])` | dev_access.sql | **open** | guard (plpgsql) |
| 97 | `root_search_me(text)` | dev_access.sql | **open** | guard (plpgsql) |
| 98 | `root_pause_profile(text)` | wave34_root_is_column.sql | **open** | guard (plpgsql) |
| 99 | `root_unpause_profile(text)` | wave34_root_is_column.sql | **open** | guard (plpgsql) |
| 100 | `root_delete_profile(text,text)` | wave34_root_is_column.sql | **open** | guard (plpgsql) |
| 101 | `approve_access_request(uuid)` | founder_access_requests.sql | **open** | guard (plpgsql) |
| 102 | `deny_access_request(uuid)` | founder_access_requests.sql | **open** | guard (plpgsql) |
| 103 | `list_pending_access_requests()` | founder_access_requests.sql | **open** | guard (plpgsql) |
| 104 | `library_admin_list(text,integer,boolean)` | wave93_ai_library.sql | **open** | guard (plpgsql) |
| 105 | `library_approve(uuid)` | wave93_ai_library.sql | **open** | guard (plpgsql) |
| 106 | `library_retire(uuid,text)` | wave93_ai_library.sql | **open** | guard (plpgsql) |
| 107 | `library_retire_old_versions(text,text)` | wave93_ai_library.sql | **open** | guard (plpgsql) |
| 108 | `library_stats()` | wave93_ai_library.sql | **open** | guard (plpgsql) |
| 109 | `library_bucket_counts(text,text)` | wave93_ai_library.sql | **open** | guard (plpgsql) |
| 110 | `library_coverage()` | wave94_ai_library_fill.sql | **open** | guard (plpgsql) |

**Left open**

| # | Function | Class | Callable by | Why |
|---|---|---|---|---|
| 111 | `complete_signup(text,text,text,text,text,text,text,text,date,text,text,text,text)` | account | authenticated | Sign-up: runs before a me row exists (no me row = not adult). Its own wave99b check refuses an under-18 birthday; its re-run path (UPDATE of an existing row) is refused for a minor by me_adult_guard. |
| 112 | `handle_taken(text)` | account | authenticated | Sign-up handle check, before a me row exists. Rate limited (wave98). |
| 113 | `auth_has_password()` | account | authenticated | Account settings / sign-in method; reads only the caller. |
| 114 | `reset_my_account()` | account | authenticated | Root-only on the server (require_root): no minor can call it. Wipes the caller own data, keeps the account. |
| 115 | `home_bootstrap()` | own_read | authenticated | Reads only the caller own checks / trait_tracks / crisis rows: same as the table SELECT policies, which stay open (data-access right; the blocked app does not call it). |
| 116 | `bank_answered()` | own_read | authenticated | Own answered question ids. Same as above. |
| 117 | `ai_provider_counts()` | own_read | authenticated | Security invoker; counts the caller own ai_provider_log rows. Same as above. |
| 118 | `library_report(uuid)` | safety | authenticated | Reporting an AI card the person has already seen: safety, kept like blocks / mutes / reports. |
| 119 | `is_message_party(uuid)` | safety | authenticated | Helper inside the reports insert policy; reports stay open. |
| 120 | `is_root()` | helper | authenticated | Caller-only helper, used inside policies and functions. |
| 121 | `require_root()` | helper | authenticated | Caller-only helper, used inside root functions. |
| 122 | `age_years(date)` | helper | authenticated | Pure helper (birthday UI). |
| 123 | `is_at_least_age(date,integer)` | helper | authenticated | Pure helper; is_adult and the guards use it. |
| 124 | `color_hue_from_show_up(text)` | helper | authenticated | Pure helper. |
| 125 | `show_requires_18(text)` | helper | authenticated | Pure helper. |
| 126 | `assert_invite_usable(text)` | public | anon + authenticated | Pre-sign-in invite check; anon can call it, so gating a signed-in minor changes nothing. |
| 127 | `public_profile(text)` | public | anon + authenticated | QR / handle lookup; anon can call it (rate limited, wave98). Adding the person is refused by the connections guard. |
| 128 | `daily_pick_position(date)` | public | anon + authenticated | Pure, anon-callable. |
| 129 | `recipe_from_account_id(uuid)` | public | anon + authenticated | Pure avatar recipe, anon-callable. |

### 3. Tables the client reaches directly (RLS)

| Table | Client paths today | Class | wave101 |
|---|---|---|---|
| `me` | select own; insert own (sign-up); **update own, no with-check** (name, city, traits, nav, story, title, milestones, birthday…) | ACCOUNT + APP | insert: wave99b guard needs 18+; update: **`me_adult_guard`** (only `born_on`, `timezone`, `ai_consent`, `updated_at` for a minor / no birthday); select open |
| `trait_tracks` | select; **insert / update own** (live: wave80 not applied) | APP | restrictive insert + update |
| `trait_history` | select; **insert own** (live: wave80 not applied) | APP | restrictive insert |
| `connections` | select own; **insert own**; delete own | APP (insert) / SAFETY (delete) | `connections_adult_guard` on insert (both people); delete and select open (ids only; names come through gated `peer_profile`) |
| `messages` | **select** (peer-written); **insert** | APP | restrictive select + insert; `delete_message_for_me` gated |
| `threads` | select participant (ids); **insert** | APP | restrictive insert; `get_or_create_thread` gated |
| `category_share` | select; **insert / update own** | APP (Circle sharing) | restrictive insert + update |
| `sage_title_flags` | select; **insert own** | APP | restrictive insert |
| `ai_provider_log` | select; **insert own** | APP | restrictive insert |
| `play_dev_logs` | **insert** (any authenticated) | DEV | restrictive insert |
| `blocks`, `mutes` | select / insert / delete own | SAFETY | open |
| `reports` | insert own | SAFETY | open |
| `access_requests` | insert (anon + authenticated) | PUBLIC (founder access form) | open |
| `app_config` | select all | NEUTRAL (config, legal) | open |
| `checks` (dashboard table) | select own; writes only through `record_check` (check_window_recap dropped the insert/update policies) | APP | `record_check` gated; confirm live policies (query 5) |
| `crisis_flags` (dashboard, legacy) | unknown live | — | confirm live policies (query 5) |
| Own-row / shared SELECT only: `ai_usage`, `ato_token_events`, `category_deep_dives`, `category_defs`, `category_statements`, `circle_visit_share`, `daily_insights`, `daily_line_days`, `daily_line_pool`, `daily_pick_answers`, `daily_pick_pool`, `explore_entries`, `explore_packs`, `explore_reactions`, `going`, `invite_codes`, `legend_generations`, `legend_museum`, `play_saves`, `question_bank_pool`, `question_bank_reroll_exclusions`, `question_items`, `question_packs`, `token_events`, `trait_answers`, `trait_flags`, `trait_profile_snapshots`, `trait_roll_snapshots`, `trait_rolls` | select only | OWN-READ | **left open**: no write, no cost, no other person's data; reading your own data stays possible (and the blocked app does not ask). A restrictive SELECT per table can be added later if emci wants reads closed too. |
| No client access at all: `ai_library_*` (6), `app_secrets`, `apple_credentials`, `account_deletions`, `circle_gifts`, `dev_access_grants`, `dev_trace_events`, `dev_trace_sessions`, `intake_questions`, `play_counters_daily`, `question_bank`, `rate_limit_hits`, `trait_answer_changes` | — | — | nothing to do |

**Storage:** bucket `around`, public read (`around_public_read`, anon too), written only by
`refresh-around` (service role). PUBLIC, open.
**Push:** reminders are local notifications only; there is no push-token table or registration endpoint on
the server, so there is nothing to gate (the client cancels local reminders while blocked).

### 4. What the previous wave101 draft left ungated

It gated 7 functions (`library_serve`, `claim_library_write`, `library_want` through `_library_crisis`;
`circle_visit_allowed` and, through it, `circle_visit_room`, `circle_send_gift`, `circle_gift_inbox`) and new
`connections` rows. It left open **103 of the 110** app-use functions marked "**open**" above — among them
every other AI claim (`claim_ai_call`, `claim_story_generate`, `claim_legend_*`, `claim_category_deep_dive`,
`claim_title_generate`, `claim_questions_batch`, `claim_roll*`), every token earn / spend / refund
(`claim_daily_checkin`, `earn_tokens`, `spend_*`, `refund_ai_tokens`, the round / profile claims), every trait
and answer write, Daily Pick, `record_check`, peer reads (`peer_profile`, `peer_checks`,
`peer_category_pack`, `legend_circle_friends`, category sharing), chat (`get_or_create_thread`, message
insert/select), `my_referrals`, Around (`set_going`, `night_snapshot`), Divecore (`save_play_doc`,
`bump_play_counter`) and all dev / admin RPCs — plus every direct table write (`me` update, `trait_tracks`,
`trait_history`, `category_share`, `sage_title_flags`, `ai_provider_log`, `play_dev_logs`, `threads`,
`messages`). It also counted a missing birthday as adult.

## Accounts with no birthday (dev-test, review, root)

With wave101 applied, `born_on` null = blocked like a minor (only birthday, sign-out, support, delete).
Agents never write to an account; this is set up by the person or by emci:

- **Root (emci's account):** must have an 18+ `born_on` before wave101, or every admin tool and the
  `review-access` function stop working (they are gated). Check with query 2.
- **Dev-test user `@atodev`** (`a70d3e0e-…d3e0`): seeded by wave31 with `born_on = 1995-04-10`, so adult —
  unless it was reset and re-created; re-created accounts go through `complete_signup`, which requires an
  18+ birthday (wave99b). Check with query 2. `@atodev2` (collision account) is seeded the same way.
- **Apple review demo account** (planned in `docs/ato-finish-roadmap.md`) and the existing review account
  `@riley` (used by `check:auth-password`): must hold an 18+ `born_on`. A new one made through sign-up
  always does. If query 2 shows `no_birthday = true`, sign in as that account and use the app's age
  confirmation (client agent's flow), or emci sets it in the SQL editor. Write it in the App Review notes.
- **Any other tester with no birthday:** blocked until they confirm their age in the app (the client asks).
  Query 1 counts them.

## Apply order (versus the OTA and the other migrations)

1. **App OTA first** (client agent): under-18 block screen, age confirmation for a missing birthday, and
   `P0005` / `age_under_18` mapped on every call. Confirm it is running on testers' phones. Applied
   earlier, a blocked person on the old app sees calls fail with no explanation.
2. `wave99b_min_age_18.sql` — needed: it is what refuses an under-18 date on the birthday path that wave101
   leaves open.
3. `wave99c_daily_pick_p65.sql`, `wave99d_library_card_vocab.sql`, `wave99_question_wording.sql` — any
   order. wave101 copies **none** of their functions (`wave99d` replaces `_library_card_ok`, internal).
4. `wave100_question_retire.sql`, then `wave100b_question_retire_rows.sql`. **Overlap:** wave101's copies
   of `serve_bank_set()`, `dev_fill_bank()` and `change_bank_answer(uuid,text,integer)` are **rebased on
   wave100** (they contain the `retired_at` filters and `_bank_trait_progress`). Applying wave101 before
   wave100 would install bodies that read a column and a helper that do not exist yet (plpgsql compiles
   lazily, so the apply succeeds and the calls then fail). `serve_bank_retest` (revoked from clients),
   `_bank_all_done` and `_bank_trait_progress` (internal) are not copied. If wave100 changes again, the
   check fails ("copy differs" / "must cite its latest source"); reprint the copy with
   `npx tsx scripts/under18-server-check.ts --copy 'serve_bank_set()'` and paste it over the old one.
5. Give root, dev-test and review accounts an 18+ birthday (section above). Run "Before applying".
6. **`wave101_under18_server_gate.sql` last**, then "After applying" and the security advisors.

Rollback: re-apply each function's source migration body (the cited file), `drop trigger me_adult_guard on
public.me`, `drop trigger connections_adult_guard on public.connections`, drop the 11 `*_adult_*` policies.

## Before applying (read-only SQL)

```sql
-- 1. How many accounts the gate blocks
select count(*) filter (where born_on is not null and not public.is_at_least_age(born_on, 18)) as under_18,
       count(*) filter (where born_on is null) as no_birthday,
       count(*) as all_accounts
from public.me;
```

```sql
-- 2. Accounts that must keep working
select handle, is_root, born_on is null as no_birthday, public.is_at_least_age(born_on, 18) as adult
from public.me
where is_root or handle in ('atodev', 'atodev2', 'riley')
order by handle;
```

```sql
-- 3. Stale-copy check: every function wave101 replaces, live body vs the repo source it copies.
--    Expect 'ok' everywhere, except the three wave100 rows until wave100 is applied.
with repo(fn, body_md5, source) as (values
  ('claim_library_write(text,text,text,text)', '631769286f44f6813442a39ade9ea515', 'wave95_ai_library_key_regex.sql'),
  ('library_serve(text,text,text)', '590f0103a73dabc1958282bd95f2663a', 'wave95_ai_library_key_regex.sql'),
  ('library_want(text,text[],text)', '0132637e2f659eac3dae3e14c1b6fedf', 'wave95_ai_library_key_regex.sql'),
  ('library_team_size(text)', '9501bd1f210de41e8598583853dfb789', 'wave94_ai_library_fill.sql'),
  ('claim_ai_call(text)', 'b0f570b205fb4ea3fe65bce7e1121ad7', 'wave17_infinite_questions.sql'),
  ('claim_category_deep_dive()', '9661a327cd4efa9f983a7355a1a818e1', 'wave92_ai_tokens.sql'),
  ('claim_story_generate()', '5a0716901bd8cf84ad9f13851d4c2daf', 'wave92_ai_tokens.sql'),
  ('claim_legend_figure_story()', 'e9c0d3ac92d4cea10da07fba9b71f85e', 'wave92_ai_tokens.sql'),
  ('claim_legend_story_generation()', '719e5ed56a02b887a699dda01b1235e4', 'wave58_legend_generations.sql'),
  ('claim_title_generate()', 'a6cdb05d0fde771955abd3fc7b38fc9a', 'wave20_trait_tracks_titles.sql'),
  ('claim_questions_batch()', 'd37de1a662758716342666eadc171aeb', 'wave17_infinite_questions.sql'),
  ('claim_roll_generation()', 'd73d22f34bbf57fb2efef4cefa11e79e', 'wave48_roll_generation_quota.sql'),
  ('claim_roll()', '39a941bbb816b4b7fc438eb610a2b61d', 'wave46_trait_rolls.sql'),
  ('refund_ai_tokens(text)', '3565e227742051691669c55936d5fc65', 'wave92_ai_tokens.sql'),
  ('claim_daily_checkin()', '0b4a534dd584ee1ef2b5bded4efe2acb', 'wave98_server_hardening.sql'),
  ('claim_full_profile_complete()', 'a9508b9ed6a29d119d9ae9795f51ffd5', 'wave92_ai_tokens.sql'),
  ('claim_intake_complete()', '64c492b5bdfdc64e25bc141dc97058fe', 'wave45_trait_redesign_tokens.sql'),
  ('claim_ongoing_round_complete(uuid)', '4fbe4d68b62b1fcb979cd65978ecef93', 'wave92_ai_tokens.sql'),
  ('earn_tokens(text)', '5413ff01b11f821c73bfa01d04f117da', 'wave45_trait_redesign_tokens.sql'),
  ('spend_tokens(text)', 'd863ff5daa1f0ccc51839e75646b8b06', 'wave19_trait_history_tokens.sql'),
  ('spend_ato_tokens_category_reroll(text)', '49a26ac6480ef17874aca292240bac84', 'wave51_ato_tokens.sql'),
  ('spend_ato_tokens_legend_reroll()', '918272a6623259e2afea5a4097ebe56d', 'wave51_ato_tokens.sql'),
  ('spend_ato_tokens_question_reroll(uuid)', '3945a3139fb14f450b84f67f65dd8688', 'wave51_ato_tokens.sql'),
  ('save_category_deep_dive(text,text,jsonb,date)', 'f2b4d66e60db3080ad1df4b8acee3228', 'wave91_category_deep_dive_bundle.sql'),
  ('save_legend_figure_story(text,integer,text,text,jsonb,date)', 'e9a14cf50a6d2a8d3d0833c545422006', 'wave89_legend_museum.sql'),
  ('insert_legend_generation(text,text)', '11a8f780761b6fe66e3496ee835ef660', 'wave58_legend_generations.sql'),
  ('legend_angle_counts(text)', 'aa884e9d830f7cf27358911c924eb70a', 'wave89_legend_museum.sql'),
  ('circle_visit_allowed(uuid)', '4329d82c290e66a7d37e7f0a34788437', 'wave97_circle_visits.sql'),
  ('circle_visit_friends()', '2429815e9b26747744733985000bbf7a', 'wave97_circle_visits.sql'),
  ('circle_visit_room(uuid)', 'c4510c44636ae1a8428d18264a8c1d54', 'wave97_circle_visits.sql'),
  ('circle_send_gift(uuid)', '66fbfa21a588de502ec4d4c9ede7fc15', 'wave97_circle_visits.sql'),
  ('circle_gift_inbox()', '46456754f0f7cb00fa6b9a4c60e4e6b2', 'wave97_circle_visits.sql'),
  ('circle_open_gift(uuid)', 'c9bd311c8fc098d8173fdb88d7fac90f', 'wave97_circle_visits.sql'),
  ('set_circle_visit_share(uuid,boolean)', 'b766797fe9c9852adaca2102c82077b9', 'wave97_circle_visits.sql'),
  ('peer_profile(uuid)', 'c6505fa3d5c8b070c7ec103561e0b179', 'stage7_chat_report.sql'),
  ('peer_checks(uuid)', '391df06fbb003a460415754d975e8c38', 'peer_checks.sql'),
  ('peer_category_pack(uuid)', '2d70cc4ff06237e73f17f81d11936985', 'wave21_playfulness_categories.sql'),
  ('categories_share_allowed(uuid)', '766f304e401da4059ea7fbd912b384a0', 'wave21_playfulness_categories.sql'),
  ('category_share_status(uuid)', 'a7487ac13d3035d8006b54a3a3a338eb', 'wave21_playfulness_categories.sql'),
  ('legend_circle_friends(text)', '08be54a84ec68a3c55e10f95d4c966db', 'wave89_legend_museum.sql'),
  ('get_or_create_thread(uuid)', '5216879033d843604d5c4aad3d1455a0', 'stage7_chat_report.sql'),
  ('delete_message_for_me(uuid)', '19d0c26cc5afaa54e58af8f5df75c9ea', 'stage7_chat_report.sql'),
  ('my_referrals()', 'f96716938b2bf831d21a43e41998db16', 'stage8_invite_referral.sql'),
  ('set_going(text,boolean,text)', 'b19ee644c8c9c598a7392613077351dd', 'wave2_going_colors.sql'),
  ('night_snapshot(text)', '2da55fc6e4f5870501f45fefbc7303dd', 'wave2_going_colors.sql'),
  ('answer_intake_question(text,integer)', '95466641bebdab165fd05b4cd271cd3c', 'wave79_trait_checkpoint.sql'),
  ('answer_round_item(uuid,integer)', 'b18a35fd3475252d706747822ab59d31', 'wave85_fixed_question_bank.sql'),
  ('answer_bank_item(uuid,integer)', 'ab2e077a86957c64a0b5589869880019', 'wave85_fixed_question_bank.sql'),
  ('answer_question_item(uuid,integer)', '4090383aa66795350e3ac3ea3c87f23f', 'wave18_question_skip.sql'),
  ('set_trait_direct(text,double precision,text)', '6e78ce082cba7023288657aa77e34805', 'wave79_trait_checkpoint.sql'),
  ('record_game_pick(text,double precision)', 'e43d716eb4ea922e14ccdc7dad1a984d', 'wave79_trait_checkpoint.sql'),
  ('confirm_trait_sources(text[])', 'f894d3d55dc36ce04f062f3351cc01a3', 'wave79_trait_checkpoint.sql'),
  ('stamp_axis_depth(text)', 'fd336ec4d897bea0821a31429d9954eb', 'wave79_trait_checkpoint.sql'),
  ('set_trait_flag(text,boolean)', '4fda165800ab7f380614eac40657bb32', 'wave85_fixed_question_bank.sql'),
  ('serve_bank_set()', '1b97bdd179af5633f09bbb5e47bf3957', 'wave100_question_retire.sql'),
  ('change_bank_answer(uuid,text,integer)', '6ae823a88023c77b86a00b346d905453', 'wave100_question_retire.sql'),
  ('undo_change_session(uuid)', '2e54a26f5a842b803837e61c635434cc', 'wave86_change_answers_history.sql'),
  ('start_fresh(boolean)', 'd81084189ab8896fbb90b0f8bb5b9311', 'wave86_change_answers_history.sql'),
  ('skip_question_item(uuid)', 'a183a3b2bcce1439bd6aa43905afaed4', 'wave18_question_skip.sql'),
  ('skip_rest_question_pack(uuid)', '6b8d436935cae95753f64d12e80462fe', 'wave18_question_skip.sql'),
  ('reroll_question_item(uuid)', '009ce15d919a4eb16a83da13ed897426', 'wave74_bank_pool_owner_and_ai_refund.sql'),
  ('fetch_bank_candidates(text,integer)', 'ba0580f38236bed1b0627cbd605f0854', 'wave74_bank_pool_owner_and_ai_refund.sql'),
  ('bank_pool_depth()', '0f47f4eb1298ddfe9e5d040896dbbce4', 'wave74_bank_pool_owner_and_ai_refund.sql'),
  ('insert_question_pack(date,jsonb)', 'bebb29c5d15c9ab6f5ae19118b2a613b', 'wave17_infinite_questions.sql'),
  ('store_roll(uuid,jsonb,jsonb)', 'e78c165156e57ce6adbe274a962824fa', 'wave46_trait_rolls.sql'),
  ('reveal_roll_item(uuid)', 'f7f69ef39219d06708655d73d6dbdee2', 'wave47_reveal_requires_ready.sql'),
  ('answer_daily_pick(date,text,integer)', '30d51c7a91199892fcc8ab8e84a2574f', 'wave82_daily_pick.sql'),
  ('daily_pick_split(text,date)', '5e6d667de969417bf40aaba452f216b5', 'wave83_daily_pick_split_by_day.sql'),
  ('record_check(integer,date,text,text,text,text,text,boolean)', 'f5535b24bccea4f7907b6ae58abe5e06', 'record_check_no_card.sql'),
  ('record_daily_line(date,text)', 'f378b73fc62cd16bd7793103fc0c6ccb', 'wave77_daily_lines.sql'),
  ('react_daily_line(date,text)', '73a2fabe25aba0cb11203bb91033dfd8', 'wave77_daily_lines.sql'),
  ('insert_daily_line_pool_items(jsonb)', '1153581b172fff51c697982ba654f187', 'wave77_daily_lines.sql'),
  ('clear_my_daily_lines()', '741aaa26c34048860adb2bafa0f089ca', 'wave77_daily_lines.sql'),
  ('insert_daily_insight(integer,date,text,text,text,text,text)', 'c9c05ced7cc9afdd1a521e4eeea10b63', 'wave87_insight_title_120.sql'),
  ('insert_explore_pack(date,text,text,jsonb)', '23bc6a7086879a717aaa0b1587b11437', 'explore.sql'),
  ('record_explore_reaction(uuid,boolean)', '47fc0e646a86a1e951b26d91d1ee40e2', 'explore.sql'),
  ('insert_category_statements(jsonb)', '597c5c6db2ef44df3e9c6d5cb7b4e305', 'wave59_category_statements.sql'),
  ('log_jargon_guard(text)', 'e7d56dd9c81df2b8132409fcf047deed', 'voice_preset_jargon.sql'),
  ('log_phrase_guard(text)', '68a2098e269139b4ad10f5a99c9beeea', 'explore.sql'),
  ('save_play_doc(jsonb,integer,timestamptz)', '5e45e58ae9b638f9714ae7a15fd64a7e', 'wave96_play_saves.sql'),
  ('bump_play_counter(text)', '5c47d09b4b384f75395fc30e8c5fcb2e', 'wave96_play_saves.sql'),
  ('apply_dev_trait_preset(jsonb,jsonb,jsonb,jsonb,jsonb)', 'c30bb216f5407d978722e8f9997cf7c3', 'wave79_trait_checkpoint.sql'),
  ('dev_fill_bank()', '8ba2ff4f8daaa1cf2b7c9f5babdcaeed', 'wave100_question_retire.sql'),
  ('dev_reset_ai_limits(text)', 'd370cbc7b9d0686b4c42b85a0947f07d', 'wave92_ai_tokens.sql'),
  ('reset_dev_test_user()', 'e768182a39ee933f0ac27d3d77a8aabb', 'wave97_circle_visits.sql'),
  ('reset_my_test_data()', '6ff57caa05362bc6c8356223c6e5a56f', 'wave75_reset_my_test_data.sql'),
  ('start_over_my_test_data()', '724dfed10aad24b8025302ae46201327', 'wave85_fixed_question_bank.sql'),
  ('has_dev_trace_capability()', '85221bb9db6f2dc1530ea7e8e8087989', 'dev_access.sql'),
  ('my_dev_access()', '9ac6812bcf3e6c8026056143719253ba', 'dev_access.sql'),
  ('my_dev_trace_session()', '767fce285c886c9c4373b95631424918', 'dev_access.sql'),
  ('start_dev_trace()', '22ac0735f6c2e7350b506dcbd5e36859', 'dev_access.sql'),
  ('stop_dev_trace()', '9ed3c826b764cd26a0edadcb51346273', 'dev_access.sql'),
  ('record_dev_trace(text,jsonb,jsonb,text,text,text,jsonb)', '3fada5883b433882fa146a9249230a39', 'dev_trace_steps.sql'),
  ('list_my_dev_trace_events()', 'd8f4e910de392e73848d1cdc387900fc', 'dev_trace_steps.sql'),
  ('list_dev_access_grants(text)', 'a5715eda55f00d9ccbfa6210a22ebecd', 'dev_access.sql'),
  ('set_dev_access_grants(text,text[])', '1d98cf43a9b4e49c0d158deb6408e3cf', 'dev_access.sql'),
  ('root_search_me(text)', '44b18937a6ad4386cef485c4e96196c1', 'dev_access.sql'),
  ('root_pause_profile(text)', '5e2f7fcf8f6ff1c61583c1eb1e5ca9d3', 'wave34_root_is_column.sql'),
  ('root_unpause_profile(text)', '392ef9f1d0fff6385746034e02a86efb', 'wave34_root_is_column.sql'),
  ('root_delete_profile(text,text)', '11aa92a24c5b5617f33a2af850bed054', 'wave34_root_is_column.sql'),
  ('approve_access_request(uuid)', 'e25c8e4543f5b6c671420ea2fbf51ec6', 'founder_access_requests.sql'),
  ('deny_access_request(uuid)', '8cecb87e80fe778027521646278b67f6', 'founder_access_requests.sql'),
  ('list_pending_access_requests()', '7d21fbc688ac7739eb1b45ca0af816bf', 'founder_access_requests.sql'),
  ('library_admin_list(text,integer,boolean)', '9fe041e729f1a7854f17d955753f8dc9', 'wave93_ai_library.sql'),
  ('library_approve(uuid)', '58fe9d1c491769ac95dd0302d2188b98', 'wave93_ai_library.sql'),
  ('library_retire(uuid,text)', '506454100d8661d56456e1e3c246a52e', 'wave93_ai_library.sql'),
  ('library_retire_old_versions(text,text)', '6547e42f591a774bcf117cfbd9d276d0', 'wave93_ai_library.sql'),
  ('library_stats()', '39258177e300eaabe114b080430da321', 'wave93_ai_library.sql'),
  ('library_bucket_counts(text,text)', '8a780028d2dcb61f84491e2c02174122', 'wave93_ai_library.sql'),
  ('library_coverage()', 'd9c1216dce261be07ff7ef9abd47f7dd', 'wave94_ai_library_fill.sql')
)
select r.fn, r.source,
       case when to_regprocedure('public.' || r.fn) is null then 'MISSING'
            when md5(replace(p.prosrc, chr(13), '')) = r.body_md5 then 'ok'
            else 'DIFFERENT' end as status
from repo r
left join pg_proc p on p.oid = to_regprocedure('public.' || r.fn)
order by status desc, r.fn;
```

```sql
-- 4. Every function a signed-in client can execute (compare with section 2: 129 rows + anything
--    created in the dashboard; classify any extra before applying)
select p.oid::regprocedure
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')
order by 1;
```

```sql
-- 5. Every non-SELECT policy (any permissive write path not in section 3 needs a decision)
select tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public' and cmd <> 'SELECT'
order by 1, 2;
```

```sql
-- 6. Tables without RLS (should be none) and storage policies
select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
select policyname, cmd, roles from pg_policies where schemaname = 'storage';
```

## After applying (read-only SQL)

```sql
-- Client-callable functions WITHOUT the guard: expect the 19 "left open" rows, is_adult(),
-- require_adult(), and nothing else.
select p.oid::regprocedure
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')
  and p.prosrc not like '%public.require_adult()%'
order by 1;
-- is_adult(uuid) must NOT be executable by a client role:
select has_function_privilege('authenticated', 'public.is_adult(uuid)', 'execute') as auth_can,
       has_function_privilege('anon', 'public.is_adult(uuid)', 'execute') as anon_can;
```

Then run the Supabase security advisors. Phone check (emci): an adult account works as before; an
under-18 test account sees the block screen, can set its birthday (an under-18 date is refused), sign out
and delete the account.

## Option B (not built): one PostgREST pre-request hook

Instead of 110 guarded copies, one function set as PostgREST's `db_pre_request`
(`alter role authenticator set pgrst.db_pre_request = 'public.age_gate'`) would run before **every** REST
call, read `request.path` / `request.method`, and for a non-adult caller allow only an allowlist
(`me` GET/PATCH, `rpc/complete_signup`, `rpc/handle_taken`, `rpc/auth_has_password`, safety tables …) and
raise `P0005` for everything else.

- Pros: about 40 lines instead of ~5,600; **default-deny**, so a new RPC or table added later is closed for
  minors without anyone remembering; covers table reads too; no function bodies copied, so no stale-copy
  risk and no rebasing on wave100.
- Cons: a **new kind of pattern** here (needs emci's ok): a role-level config change; runs on every request
  (one extra `me` lookup per call, for everyone); does not cover calls that do not go through PostgREST as
  the person (Edge Functions using the service role, Realtime, Storage) or functions called from inside
  other functions; path matching is easier to get subtly wrong (`/rpc/x` vs `/rpc/X`, HEAD, embedded
  resources); a mistake locks out every account at once; harder to test offline.

Recommendation stays the per-function guards (tested patterns, reviewable, pinned by a check); Option B is
worth considering if the RPC count keeps growing.

## Notes for the client agent

- Any call can now fail with `P0005` / `age_under_18` (functions, `me` update of a non-birthday column,
  `connections` insert, `messages` / `threads` / other restrictive tables return an RLS error). Blocked
  people should never reach these screens; map the code to the block screen anyway.
- `ai-library` returns `{ok:false, reason:'failed'}` for a minor (see Edge Functions).
- `scripts/age-check.ts` lines 391–400 pin the **old** wave101 draft (`born_on is null or …`,
  `_library_crisis`, the `circle_visit_allowed` body, and "no `delete from` / `update public.`" over the
  whole file, which the verbatim copies now contain). That block fails now and must move to the new rules
  (null = not adult) or simply defer to `check:under18-server`. `docs/under18-access.md` "Server" section
  and "A missing (null) born_on never blocks" are stale for the server side.

## Risks

- **Stale copies.** A function changed by hand in the dashboard after its last migration would be
  overwritten by the repo copy. Query 3 catches it before applying.
- **wave100 order** (above). The check pins the rebase but cannot see what is applied.
- **Root / dev / review with no birthday** lose admin tools or the app until a birthday is set (query 2).
- **Dashboard-only objects** (more RPCs or write policies than the repo shows) stay ungated until
  classified (queries 4–5).
- **Own-row reads stay open** by design (section 3); peer reads are closed.
- **Self-reported age**: a minor can claim an older birthday (server accepts any 18+ date); same trust as
  sign-up.
- **UTC vs local date** on the birthday itself: the server opens on the UTC date.
- **Errors look generic** in `ai-library` and in RLS refusals until the client maps them.
- **Performance**: each guarded call adds one primary-key read of `me`; restrictive policies use
  `(select public.is_adult())` so it runs once per statement, not per row.

## Not verifiable from the repo

Live function bodies (query 3), dashboard-only functions and policies (queries 4–5), the real `born_on` of
root / dev / review accounts (query 2), whether wave99b–wave100 are applied, and behaviour on a device.
Nothing here was applied, deployed or run against a database.

## Checks

- `npm run check:under18-server`: every client-callable function classified; every gated copy word for word
  + one guard + its grants; nothing open touched; `is_adult(uuid)` internal; null = not adult; the
  restrictive policies and both triggers; no row change, no delete trigger/policy, account deletion
  untouched; `ai-library` claims before the model call.
