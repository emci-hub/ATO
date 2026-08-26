# NOW

**Category:** Hybrid — AI-native + Social + Health/finance/kids
**Gates:** A ✓ (non-goals in ATO_PLAN_v2.md) · B ✓ (iOS/Expo, Supabase, Apple Sign-in+email) · C in progress · D not started
**Modules on:** report/block (Social), crisis static-card + privacy pass (Health/finance/kids) — both required, in progress
**Live AI + model:** Cursor, `deepseek-v4-flash`, Expo SDK 54

## On
Stage 8 (TestFlight) — sequencing as tight handoffs rather than one big box:
1. ✅ **Apple Sign-In + delete-account/token revoke — DONE, verified on real device.** Real Sign in with Apple confirmed working end-to-end (App ID `com.emgens.ato`, Services ID `com.emgens.ato.signin`, EAS dev-client build on real iPhone). Delete-account confirmed both ways: ME row genuinely gone from Supabase, and `confirmRevoked()` returned true (real Apple token revocation, not just a 200 response) after the four Edge Function secrets were correctly set. Session-validation bug found and fixed along the way (stale local session after server-side delete → now force-signs-out locally with a "Wrong account? Sign out" escape hatch on onboarding).
2. Invite/referral gate (Auth + ME) — see ATO_PLAN_v2.md → Referral spec. Required before public App Store submission, NOT before TestFlight (TestFlight already gates via Apple's own tester invites) — next up
3. Push notifications + widget (Read/Do/Check/Sunday recap, deep links)
4. Floor requirements sweep — Sentry, privacy labels, PrivacyInfo.xcprivacy, "coach" labeling, rate limiting
5. Legal + landing copy — drafted here directly, not a Cursor job
6. EAS build → TestFlight submission

**Also designed this session, not yet started, own future box after Stage 8 wraps:** Understanding spec (see ATO_PLAN_v2.md) — full onboarding/personalization redesign, backlog item added below.

## Done
- Stage 1 (Home shell) — screenshot verified: 3 tabs (Home, Sage, You), no Circle tab, fake card, fake poster
- Stage 2 (Sign-in + ME + Theme) — fully verified: OTP email auth, ME row saves, sign-out, duplicate/reserved handle errors
- Stage 3 (Pixel) — fully verified: composable recipe, measured skeleton anchors, hands correct both sides, 5 looks swap cleanly
- Stage 4 (Dawn + Router) — fully verified: sage.txt + first_cards.md live, bank/model routing proven (Day 1 screenshot live on real account), filters (repeats/vague/cruel/no-cut-after-crisis/no-two-cuts), back button added, AI consent gate enforced at router level (Apple 5.1.2) — null/true/false stored on ME row, asked once, denial = permanent bank-only + Talk off. 16/16 automated checks pass. Only untested-live piece: the actual consent prompt UI (needs check_count>=3, will confirm naturally in a few days of real use).
- docs/ATO_PLAN_v2.md added to repo (byte-verified copy), later updated with Referral spec
- Crisis module (card, logging, dormant detection hook, router short-circuit) built and verified 18/18 checks
- Crisis classifier + keyword fallback + Talk box — built and verified 23/23: separate narrow Gemini classifier call (boolean JSON, 4s timeout, zero temperature) that MUST complete before the main router call; on classifier failure/timeout → user-approved keyword list + regex net (never silently skips); flagged message → static crisis card, crisis_flags logged (user+timestamp only), zero main-router `generateTalk` calls (proven with spy provider); Talk router consent gate (denied → off, pending → prompt); two talk_style users get visibly different tone on the same prompt (verified in talk-lab); Sage tab rebuilt as chat UI with today/this week/something else chips + More (I need support), persistent lifebuoy support button opening the crisis card, and auto-shown card with one-tap dismiss — no confirmation gate, no lockout. Only untested-live pieces: Talk UI clicks behind the OTP auth guard, and the live classifier path (no EXPO_PUBLIC_GEMINI_API_KEY set yet → keyword fallback is active, which is the intended safety net)
- Stage 5 (Talk) — built + verified 23/23 (see crisis classifier entry above)
- Stage 6 (Share + Circle) — built + verified per plan done-bar
- Stage 7 (Chat + Report) — built + verified per plan done-bar; `master` in sync, both commits pushed

## Left
Stage 8 (TestFlight) — see sequenced list under On

## Backlog (Stage 8 — polish pass, before TestFlight)
- Fantasy UI Borders pack (Kenney) — UI chrome/panels/buttons, separate visual system from character art
- Universal font/spacing consistency pass — cross-cutting, do once near the end
- Kenney credits/disclaimer page — bundle into You tab settings area
- Monster Builder Pack — parked, needs eyes/mouth slots added to recipe before usable
- Delete/reset account — ~~explicit confirmation + Apple revoke~~ — done in Stage 8 handoff #1 (device-verified, `confirmRevoked()` true)
- Make show_up / knocks_you_off / morning_cue editable in Settings, not just talk_style (already spec'd editable)
- Revisit onboarding question wording if it still feels off after a fresh look
- Crisis card: region-detection (currently hardcoded to Canada/988) — needs a real approach, timezone alone isn't reliable enough
- Crisis: relational-safety/abuse category (separate from self-harm) — needs its own resource number, parked separately
- SecureStore warning: "Value being stored is larger than 2048 bytes" — minor, not urgent, but could throw in a future SDK version
- **Referral/invite-gate system** (see ATO_PLAN_v2.md → Referral spec) — own box (`invite`), touching Auth + ME only. Sequence right after Apple Sign-In/delete-account handoff. Required before public App Store submission, not before TestFlight.
- **Understanding spec** (see ATO_PLAN_v2.md → Understanding spec) — replaces the 3 vague free-text onboarding fields with a 9-question tappable core + optional MBTI/Big-Five/attachment/conflict-style fast-entry, backed by free/public-domain instruments (IPIP, TIPI, ECR). Includes red-teamed delight mechanics (honest reveal card, milestone badges, 4 game types), AI multi-provider fallback + per-user quota design, and honest-feedback delivery refinement. Explicitly rejected: randomized-value/slot-machine mechanics — reasoning on record in the plan doc. Own future box (`intake`), touching ME schema + onboarding UI + Sage prompting + Stage 8's floor-requirements sweep (AI quota piece only). Sequenced after Stage 8 wraps — not started, needs the same extra-care review discipline as the Crisis spec before shipping given it touches real psychological categories.
- Slack — parked as future ops tooling (Sentry/Reports/infra alerts) for if/when the app scales up. Bring up again as a bounce-off suggestion at that point, not before.

## Crisis detection — final architecture (decided after extended discussion)
AI-judged (separate lightweight Gemini classification call, not the main Sage reply) with keyword-list fallback if the classifier call fails/times out. No confirmation gate before showing the card — shows automatically, one-tap dismiss, no lockout. Persistent subtle support button in Talk UI regardless of detection. Explicitly considered and rejected: confirm-before-showing popup (real risk of people minimizing when asked directly, which delays access exactly when it matters); button-only with no passive detection (misses the person who isn't self-navigating to look for help, which is the core case this exists for). Legal disclaimer draft in crisis-disclaimer.md — still needs a lawyer's pass before real users.

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
- docs/ATO_PLAN_v2.md, docs/ME.md, docs/NOW.md, docs/BUSINESS.md — Cursor maintains these directly. **When updating any of them, keep all four in sync, commit them together, and `git push` immediately. Never leave a docs commit sitting local-only.**
- EXPO_PUBLIC_GEMINI_API_KEY set and live-verified. Model pinned to `gemini-3.7-flash` (not `-latest`).
- ATO_PLAN_v2.md updated with Referral spec + Understanding spec (future `understand` box) + Public App Store readiness checklist — treat locked additions as locked, not deviations to flag.
- **Open decision (emci's, not technical):** Apple Developer account type — Individual vs Organization. Revisit before public submission.
- **Confirmed:** Bundle ID `com.emgens.ato` (App ID) / `com.emgens.ato.signin` (Services ID). Edge Function secret `APPLE_CLIENT_ID` must be the **bundle ID** for native authorization-code exchange. Supabase Auth Apple provider Client IDs can still include the Services ID for web.
- **Apple client_secret JWT minted Aug 25, 2026** via `createClientSecret` (ES256, Apple's 180-day max). **Expires Feb 24, 2027 07:24 UTC.** Identifiers: Team ID `Q2UF7F6N36`, Key ID `3JKLGRJ586`. **Regenerate and update in Supabase around late Jan 2027.** Not automated.
- Email sending currently on `noreply@asstrollogs.com` (Resend-verified). **Later:** `mail.emgens.com` as verified Resend domain + Apple Email Sources list.
- **Gap surfaced during age-rating research:** plan says age is self-reported at onboarding, but Stage 2 has no literal age question — close in Stage 8 floor-requirements sweep (item 4).

## Next 15 min
Stage 8 handoff #2: invite/referral gate (Auth + ME) — see ATO_PLAN_v2.md → Referral spec. On device after the last delete: Reload (or **Wrong account? Sign out**) so any stale local session is cleared before the next Apple sign-in.
