# NOW

**Category:** Hybrid — AI-native + Social + Health/finance/kids
**Gates:** A ✓ (non-goals in ATO_PLAN_v2.md) · B ✓ (iOS/Expo, Supabase, Apple Sign-in+email) · C in progress · D not started
**Modules on:** report/block (Social), crisis static-card + privacy pass (Health/finance/kids) — both required, in progress
**Live AI + model:** Cursor, `deepseek-v4-flash` (Home) — Sage router live on `gemini-3.7-flash`, real key confirmed working

## On
Wave 1, Stage 6 — first box from ATO_PLAN_v2.md. Not yet scoped this session; confirm scope before Builder starts.

## Done
- Stage 1 (Home shell) — screenshot verified: 3 tabs (Home, Sage, You), no Circle tab, fake card, fake poster
- Stage 2 (Sign-in + ME + Theme) — fully verified: OTP email auth, ME row saves, sign-out, duplicate/reserved handle errors
- Stage 3 (Pixel) — fully verified: composable recipe, measured skeleton anchors, hands correct both sides, 5 looks swap cleanly
- Stage 4 (Dawn + Router) — fully verified: sage.txt + first_cards.md live, bank/model routing proven (Day 1 screenshot live on real account), filters (repeats/vague/cruel/no-cut-after-crisis/no-two-cuts), back button added, AI consent gate enforced at router level (Apple 5.1.2) — null/true/false stored on ME row, asked once, denial = permanent bank-only + Talk off. 16/16 automated checks pass. Only untested-live piece: the actual consent prompt UI (needs check_count>=3, will confirm naturally in a few days of real use).
- **Stage 5 (Talk + crisis) — FULLY CLOSED, live classifier confirmed.** Built and verified 28/28 offline checks, then confirmed live: `EXPO_PUBLIC_GEMINI_API_KEY` set with a real key, model pinned to `gemini-3.7-flash` (explicit version, not a `-latest` alias — deprecation risk), `thinkingLevel` fixed from `minimal` (rejected by 3.7 with a 400) to `low` (accepted across all 3.x text models). Live run: crisis message correctly flagged via real Gemini call (`method: "classifier"`, 1274ms, 2726ms headroom against the 4s deadline), benign message correctly cleared (not a flag-everything stub), timeout/HTTP-failure paths still correctly drop to keyword-fallback, and a flagged message confirmed 0 `generateTalk` calls / exactly 1 total Gemini request (the classifier, nothing else). All 10 live-check assertions passed.
- docs/ATO_PLAN_v2.md added to repo (byte-verified copy)
- Crisis module (card, logging, dormant detection hook, router short-circuit) built and verified 18/18 checks
- Crisis classifier + keyword fallback + Talk box — 28/28 offline + 10/10 live checks. Separate narrow Gemini classifier call (boolean JSON, 4s timeout) that MUST complete before the main router call; on classifier failure/timeout → keyword list + regex net (never silently skips); flagged message → static crisis card, crisis_flags logged (user+timestamp only), zero main-router `generateTalk` calls on flagged messages (now proven live, not just with a spy provider); Talk router consent gate (denied → off, pending → prompt); two talk_style users get visibly different tone on the same prompt (verified in talk-lab); Sage tab rebuilt as chat UI with today/this week/something else chips + More (I need support), persistent lifebuoy support button opening the crisis card, and auto-shown card with one-tap dismiss — no confirmation gate, no lockout.

## Left
Stages 6–8, Wave 1

## Backlog (Stage 8 — polish pass, before TestFlight)
- Fantasy UI Borders pack (Kenney) — UI chrome/panels/buttons, separate visual system from character art
- Universal font/spacing consistency pass — cross-cutting, do once near the end
- Kenney credits/disclaimer page — bundle into You tab settings area
- Monster Builder Pack — parked, needs eyes/mouth slots added to recipe before usable
- Delete/reset account — explicit "are you sure, this can't be undone" confirmation before wiping data
- Make show_up / knocks_you_off / morning_cue editable in Settings, not just talk_style (already spec'd editable)
- Revisit onboarding question wording if it still feels off after a fresh look
- Crisis card: region-detection (currently hardcoded to Canada/988) — needs a real approach, timezone alone isn't reliable enough
- Crisis: relational-safety/abuse category (separate from self-harm) — needs its own resource number, parked separately
- SecureStore warning: "Value being stored is larger than 2048 bytes" — minor, not urgent, but could throw in a future SDK version
- **Gemini free-tier request ceiling:** rough estimate ~500 daily active users before hitting the free-tier daily request cap (~1,500 req/day ÷ ~2-4 Gemini requests/user/day for a Check+occasional-Sage usage pattern, not a chat feed). Non-issue through TestFlight/early use; revisit before any real growth push.
- **Graceful degradation if the main Talk router hits the daily cap mid-day** — the crisis classifier already has a safe fallback (keyword net); the main Sage reply path does not yet have a defined behavior if Gemini starts rejecting requests due to quota.
- **Usage visibility check** — AI Studio shows live RPM/TPM/RPD against the key; worth a quick glance periodically once there are real users, so a quota wall is seen coming rather than discovered via a support message.
- Revisit free-tier data-use terms (Google may use free-tier request data to improve their products) before real user messages flow through it at TestFlight/production, not just dev testing.

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
- docs/ATO_PLAN_v2.md, docs/ME.md, docs/NOW.md all live in the repo now — Cursor maintains these directly going forward
- EXPO_PUBLIC_GEMINI_API_KEY is set with a real key in .env.local (Home); confirm it's also present wherever the app actually runs before Stage 6 work assumes live Gemini is available by default
- Repo (emci-hub/ATO) is public — be deliberate about what goes into it; Cursor's cloud-agent secret injection is restricted for public repos by default (this is why check:crisis-live had to be run with the key passed inline/locally rather than via dashboard secrets)

## Next 15 min
Scope Stage 6 (first box from ATO_PLAN_v2.md) and confirm the model pick for it — home/away lane, likely rotating off Opus 5 now that the safety-critical Stage 5 work is done.
