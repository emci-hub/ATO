# NOW

**Category:** Hybrid — AI-native + Social + Health/finance/kids
**Gates:** A ✓ (non-goals in ATO_PLAN_v2.md) · B ✓ (iOS/Expo, Supabase, Apple Sign-in+email) · C in progress · D not started
**Modules on:** report/block (Social), crisis static-card + privacy pass (Health/finance/kids) — both required, in progress
**Live AI + model:** Cursor, `deepseek-v4-flash` (default volume) — crisis/safety-critical work always routes to Claude Opus 5 regardless of Home/Away, Expo SDK 54

## On
Stage 8 (TestFlight) — sequencing as tight handoffs rather than one big box:
1. Apple Sign-In + delete-account/token revoke (Opus 5, fixed lane — safety/compliance-critical) — next up
2. Invite/referral gate (Auth + ME) — see ATO_PLAN_v2.md → Referral spec. Required before public App Store submission, NOT before TestFlight (TestFlight already gates via Apple's own tester invites)
3. Push notifications + widget (Read/Do/Check/Sunday recap, deep links)
4. Floor requirements sweep — Sentry, privacy labels, PrivacyInfo.xcprivacy, "coach" labeling, rate limiting
5. Legal + landing copy — drafted here directly, not a Cursor job
6. EAS build → TestFlight submission

## Done
- **Stage 7 (Chat + Report/Block/Mute) — fully closed, on-device verified.** Chat opens only from a Circle card (tap the card) — no standalone inbox, one thread per Circle connection (`threads` canonical user_a<user_b pair, created via `get_or_create_thread` RPC which requires a live connection). Messages persist in `messages` (TLS + RLS, no homemade crypto, history stays). Delete-a-line = delete-for-me via `delete_message_for_me` RPC (sender-only, appends to `deleted_for`; server hides the line for that reader). "Teach Sage this" on a long-pressed chat line stores exactly one editable fact onto `me.facts` (the growth-tier depth axis now populates for real) — the only ambient-access path, zero Sage access otherwise. Block (`blocks` blocked_by/blocked_user): sending disabled in BOTH directions at the messages INSERT policy, blocked user's lines stop rendering for the blocker at the SELECT policy (server-side, so Realtime is filtered too). Mute (`mutes`): local to the muter only, silent, no notification. Report (`reports`: `from, message_id|user_id, reason, at`): insert-only from the app, no SELECT policy → admin reads in the Supabase dashboard; party-to-message enforced (chat thread participant or own Sage row), self-report rejected. Sage responses are now persisted (`sage_messages`) so a Sage reply is a reportable target (long-press a Sage bubble) and Sage history survives restarts. On-device pass as both test accounts confirmed: Circle-card-initiated exchange both directions, Teach Sage this lands a fact, delete-for-me hides for the sender only, block freezes sending both ways and hides the blocked lines, mute hides locally with zero notification to the muted side, message + user + Sage reports all visible in the dashboard.
  - Done-bar verification at the DB/RLS layer: two connected accounts exchanged messages (thread create → both send → both read), delete-for-me verified (deleter loses the line, other side keeps it), block verified in both directions (blocker's send rejected, blocked user's send rejected, blocker's view hides the blocked lines, blocked side still sees old lines), report verified (message-target + user-target + Sage-target rows all land, admin-visible; reporting a non-party message / self is rejected), mute verified local-only (muted side sees zero rows). PostgREST probe confirmed the `from` column maps and the reports INSERT policy fires (anon → 42501 as expected).
  - Second-opinion review (composer-2.5-fast, since GPT-5.6 Sol wasn't available in that environment) on the block/report logic: verdict "safe to commit for Apple 1.2, no critical findings". Fixes applied from the review: (1) block-then-report-a-message now works — reports insert uses a security-definer `is_message_party` helper so the messages block-hiding filter no longer rejects reports about a user you just blocked; (2) `me.facts` privacy leak closed — connected peers previously read the FULL me row (facts, ai_consent, milestones, knocks/morning cues); replaced with `peer_profile` (poster fields only, connection-gated) and dropped `me_select_connected`; (3) send/realtime duplicate-bubble race fixed by id-dedupe; (4) moderation state refetches on focus so a peer's mid-session block reflects without a server reject.
  - Deferred from the review (documented, not half-built): a *visible* per-message Report affordance (message-level reporting is long-press-only today; user-level Report + Block are visible in the Chat header and Circle overflow menus) — flagged as the top pre-TestFlight polish item, not a correctness gap. Also noted: mute is client-side filtered (fine — mute is non-destructive and silent).
  - Housekeeping: Stage 7 schema versioned in-repo at `supabase/migrations/stage7_chat_report.sql` (applied live to the `ato` project). `dist/` refreshed by a web export smoke test; `/chat` route builds. Commits `5f19aec` + `466547f` pushed, `master` in sync with `origin/master`.

- **Stage 6 (Share + Circle) — fully closed, on-device verified.** Share: Stories-size poster (real pixel, name, `@handle`, `show_up`, QR) via view-shot → native Share sheet; copy-link; public `/@handle` page (no auth) resolves through a security-definer `public_profile` function that only exposes poster fields. Circle: `connections` table, one gate — a scan or pasted link inserts A→B, a DB trigger mirrors B→A, Realtime pushes the tab to both devices without a manual refresh. Circle screen shows each peer's real pixel + honest card (name, handle, show_up, latest check) straight from `me`/`checks`, nothing synthesized, no chat touched. Added **Unfriend**: deletes the connection both directions (mirror-delete trigger, no orphan rows), tab disappears live on both sides at 0 connections.
  - On-device pass confirmed clean: fresh/never-scanned account shows exactly 3 tabs; unfriend → refriend cycle works both directions; scanned peer's card shows real data, not placeholder; Home-bounce after a successful scan felt fine in practice, no polish needed.
  - Two bugs found and fixed during on-device testing: (1) **Realtime double-subscription** — fixed by consolidating into a single `CircleProvider` (zero duplicate channels); (2) **Dynamic tab trigger warning** — fixed by keeping the Circle `<Trigger>` statically present with the documented `hidden={!hasCircle}` prop. **Note for future: any conditional tab should use this same static-trigger + `hidden` pattern, not a conditional JSX child.**
  - Verified: RLS + mirror trigger + unfriend mirror-delete via rollback-transaction tests, `tsc --noEmit` clean, 23/23 voice suite, stage6 checks pass, 0 lint errors, web export resolves `/circle` + `/[handle]`.
  - Known side effect, accepted as fine: toggling `hidden` remounts the navigator, so the app lands back on Home right after a successful scan. Confirmed on-device this reads as fine.

- **Kenney pipeline + gesture + crisis-revert side-quest — fully closed, on-device verified.** Generalized family-agnostic Kenney asset pipeline (prep script, per-family manifest, generic renderer, generic animation layer, `docs/KENNEY_IMPORT.md`); Shape Characters migrated as the first pack, replacing the old Pixel family entirely; hands hidden at rest, event-driven gestures (thumb/point/peace) wired to real app moments with a hard crisis-silence rule; SecureStore oversized-session bug fixed (split adapter); Talk reply truncation fixed (thinkingConfig on the main Gemini provider); Sage composer tab-bar clearance fixed; crisis detection reverted from AI-classifier back to keyword-only (487–561 invisible thinking tokens per message on the classifier wasn't worth the catch-rate gain — see architecture section below); hand/body color mismatch fixed; Circle re-add stale-state bug fixed (foreground refetch + post-scan refresh). On-device pass confirmed all of it clean.

- **Persistent header avatar + Sage tab icon + two real navigation bugs — fully closed, on-device confirmed.** `header-avatar.tsx`: the app's single always-mounted, gesture-registering pixel instance, top-right over every tab screen. Sage tab icon: web uses a small live `SageTabIcon`; native uses a purpose-made alpha-only character-silhouette mask (`sage-mask.png`) so it template-tints correctly. **Login REPLACE race** fixed by removing the imperative `router.replace` (login now routes purely through the declarative auth guard). **Circle dead-tap** fixed via a `key`-based forced navigator remount on `hasCircle` change.

- **Growth-tier system — fully closed, on-device confirmed.** Dual-axis, derived live from real ME data, no caching: presence axis (`me.checks` count → tier 0-3, layered neon glow in the character's own color) and depth axis (`me.facts` jsonb array — now populated for real by Stage 7's "Teach Sage this" → tier 0-2, small sharp white 4-point sparkle). Tiers monotonic by construction, no demotion logic. Milestone celebrations (7/21 checks) via `me.milestones_celebrated`. **Color system documented for the record:** the plan's named Ink/Paper/Steel/Bloom palette was never implemented — what shipped is a hash-of-`show_up`-to-hue accent (`hsl(hash%360, 65%, 50%)`), recorded as the real intentional design, not a gap. Glow hue and body sprite color are two intentionally separate systems. Dev tooling: `/pixel-lab` extended with tier-override controls + celebration preview, added to Home's open-box card.

- **Stage 5 (Talk) — fully closed.** Crisis classifier + keyword fallback + Talk box built and verified 23/23 offline, plus **7/7 live checks** against the real Gemini API (crisis → static card, zero `generateTalk` calls; clean message → normal reply). Two talk_style users get visibly different tone on the same prompt. Sage tab rebuilt as chat UI with today/this week/something else chips + More, persistent lifebuoy support button, auto-shown crisis card with one-tap dismiss, no lockout. **Model pinned deliberately to `gemini-3.7-flash` (versioned), not `gemini-flash-latest`** — the unversioned alias is Google's experimental tier and can hot-swap with only 2 weeks' notice; manual quarterly check before any bump, re-run `scripts/crisis-live-check.ts`.

- Crisis module (card, logging, dormant detection hook, router short-circuit) built and verified 18/18 checks
- Stage 4 (Dawn + Router) — fully verified: sage.txt + first_cards.md live, bank/model routing proven, filters (repeats/vague/cruel/no-cut-after-crisis/no-two-cuts), back button, AI consent gate enforced at router level (Apple 5.1.2) — null/true/false stored on ME row, asked once, denial = permanent bank-only + Talk off. 16/16 automated checks pass. Only untested-live piece: the actual consent prompt UI (needs check_count>=3).
- Stage 3 (Pixel) — fully verified: composable recipe, measured skeleton anchors, hands correct both sides, 5 looks swap cleanly
- Stage 2 (Sign-in + ME + Theme) — fully verified: OTP email auth, ME row saves, sign-out, duplicate/reserved handle errors
- Stage 1 (Home shell) — screenshot verified: 3 tabs (Home, Sage, You), no Circle tab, fake card, fake poster
- docs/ATO_PLAN_v2.md added to repo (byte-verified copy), later updated with Referral spec + Public App Store readiness checklist

## Left
Stage 8 (TestFlight) — see sequenced list under On

## Backlog (Stage 8 — polish pass, before TestFlight)
- Fantasy UI Borders pack (Kenney) — UI chrome/panels/buttons, separate visual system from character art
- Universal font/spacing consistency pass — cross-cutting, do once near the end
- Kenney credits/disclaimer page — bundle into You tab settings area
- Monster Builder Pack — parked, needs eyes/mouth slots added to recipe before usable
- Delete/reset account — explicit "are you sure, this can't be undone" confirmation before wiping data (folded into Stage 8 handoff #1)
- Make show_up / knocks_you_off / morning_cue editable in Settings, not just talk_style (already spec'd editable)
- Revisit onboarding question wording if it still feels off after a fresh look
- Crisis card: region-detection (currently hardcoded to Canada/988) — needs a real approach, timezone alone isn't reliable enough
- Crisis: relational-safety/abuse category (separate from self-harm) — needs its own resource number, parked separately
- SecureStore warning: "Value being stored is larger than 2048 bytes" — minor, not urgent, but could throw in a future SDK version
- Quarterly: re-check for new stable Gemini flash releases, re-run crisis-live-check.ts before bumping the pinned model version
- **Referral/invite-gate system** (see ATO_PLAN_v2.md → Referral spec) — own box (`invite`), touching Auth + ME only. Sequence right after Apple Sign-In/delete-account handoff. Required before public App Store submission, not before TestFlight.
- **Visible per-message Report affordance** (Stage 7 review deferred item) — message-level reporting is long-press-only today; add a visible entry before TestFlight
- **Gentle re-engagement nudge (researched, not yet designed):** a one-off warm nudge after ~2-3 days of no opens, not a scheduled recurring push. Tone: "we noticed, we're here" — never "you're falling behind" or streak-loss framing.
- Slack — parked as future ops tooling (Sentry/Reports/infra alerts) for if/when the app scales up

## Crisis detection — final architecture (revised — reverted to keyword-only)
Switched from AI-classifier to keyword-only, Aug 25 2026: decided together, token cost of the separate classifier call wasn't worth it for the accuracy gain.

**Current:** static keyword/phrase-list detection only, checked against the user's message before it reaches the router — matching the plan's original spec. No AI classifier call.
**Prior approach (superseded):** AI-judged (separate lightweight Gemini classification call) with keyword-list fallback if the classifier failed/timed out. Live-verified working (7/7 checks) as of Stage 5, but reverted after measuring real cost: the classifier call burned 487–561 invisible thinking tokens on **every single Talk message**, before the main reply even generated — real recurring token cost and latency for a catch-rate benefit judged not worth it once the actual numbers were known. Reverting returns to the plan's original design ("static keyword/phrase list... No sentiment model in v1 — keyword match is auditable and fails safe"), not a new invention.
**Unchanged by this reversal:** no confirmation gate before showing the card — shows automatically, one-tap dismiss, no lockout. Persistent subtle support button in Talk UI regardless of detection. Static resource card, logging (flag + timestamp only), router short-circuit (no model call on a flagged message) — all identical to before, only the trigger mechanism changed. Legal disclaimer draft in crisis-disclaimer.md — still needs a lawyer's pass before real users.

## Idea parking lot — Wave 3 expansion (gated: only after Wave 2 has real nights happening)
Plan already specs items 1/2/5 below ("weekly Read, 30-day trail, more Talk" after 7 Checks). These extend that:
1. Weekly Read — Sunday depth, title + one true line free, body locked (matches existing spec)
2. Last 30 days of cards (matches existing spec)
3. Weekly archive (past Sunday reads)
4. Deeper Circle — model grid + "how you two talked this week," unlocks when both hit 7 Checks. Free tier keeps the honest card.
5. More Talk — higher cap + can ask Sage about this week's Read (matches existing spec)
6. Mid-week note — one optional ping from the weekly
7. Shareable weekly card (pretty, accurate, not a lie — Wrapped-style)
8. Interest news, second voice, extra pixel looks, custom pixel
Guardrail already respected by all of these: never paywall Home, More, Check, crisis response, or the widget.

## Idea parking lot — games/tokens/accuracy (single-player first, multiplayer parked further out)
Early on there's not much data on someone yet. Games give tokens; tokens unlock "refresh about themselves" (re-visiting/updating profile questions). Accuracy meter on profile shows how well-known their profile is. Multiplayer games = 2x tokens, explicitly parked (depends on Circle/Around existing first). Needs scoping later: which games, how "accuracy" is actually measured, keeping it feeling like a fun mechanic not manipulative data-extraction.

## Housekeeping
- docs/ATO_PLAN_v2.md, docs/ME.md, docs/NOW.md all live in the repo now — Cursor maintains these directly going forward. BUSINESS.md added alongside (legal/brand/cost roadmap, runs parallel to the stages)
- ATO_PLAN_v2.md updated with the Referral spec (post-Wave-1, pre-public-launch) — treat it as a locked addition, not a deviation to flag
- ATO_PLAN_v2.md updated with the "Public App Store readiness" checklist (account type, trademark, referral flip, legal, App Store Connect tax/banking) — applies before public listing, not before TestFlight. Not a Cursor task, this is on emci.
- **Open decision (emci's, not technical):** Apple Developer account type — Individual (personal legal name as seller, no entity needed) vs Organization (requires registered LLC/Corp + D-U-N-S, can't convert from Individual later). Not legally required to be Organization for ATO's current scope. Revisit before public submission — cheaper to decide before enrolling than after.
- EXPO_PUBLIC_GEMINI_API_KEY set and live-verified. Model pinned to `gemini-3.7-flash` (not `-latest`) — see rationale under Stage 5 Done.
- Commit-scoping note: when asked to commit only a specific fix in isolation, Cursor has twice now bundled it with other uncommitted work instead. Worth explicitly re-stating "commit only X, leave everything else uncommitted" each time rather than assuming it'll narrow scope on its own.

## Next 15 min
Confirm workspace (local or cloud) for the Stage 8 handoff #1 (Apple Sign-In + delete-account/token revoke, Opus 5). If local: `git pull` first. Paste the handoff prompt to Cursor, have it report its available models before writing code.
