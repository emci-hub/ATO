# NOW

**Category:** Hybrid — AI-native + Social + Health/finance/kids
**Gates:** A ✓ (non-goals in ATO_PLAN_v2.md) · B ✓ (iOS/Expo, Supabase, Apple Sign-in+email) · C in progress · D not started
**Modules on:** report/block (Social), crisis static-card + privacy pass (Health/finance/kids) — both required, in progress
**Live AI + model:** Cursor, `deepseek-v4-flash`, Expo SDK 54

## On
Wave 1, Stage 5 — Talk (crisis architecture decided, build in progress)

## Done
- Stage 1 (Home shell) — screenshot verified: 3 tabs (Home, Sage, You), no Circle tab, fake card, fake poster
- Stage 2 (Sign-in + ME + Theme) — fully verified: OTP email auth, ME row saves, sign-out, duplicate/reserved handle errors
- Stage 3 (Pixel) — fully verified: composable recipe, measured skeleton anchors, hands correct both sides, 5 looks swap cleanly
- Stage 4 (Dawn + Router) — fully verified: sage.txt + first_cards.md live, bank/model routing proven (Day 1 screenshot live on real account), filters (repeats/vague/cruel/no-cut-after-crisis/no-two-cuts), back button added, AI consent gate enforced at router level (Apple 5.1.2) — null/true/false stored on ME row, asked once, denial = permanent bank-only + Talk off. 16/16 automated checks pass. Only untested-live piece: the actual consent prompt UI (needs check_count>=3, will confirm naturally in a few days of real use).
- docs/ATO_PLAN_v2.md added to repo (byte-verified copy)
- Crisis module (card, logging, dormant detection hook, router short-circuit) built and verified 18/18 checks
- Crisis classifier + keyword fallback + Talk box — in progress, this is the current active task

## Left
Stages 5–8, Wave 1

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
- Set EXPO_PUBLIC_GEMINI_API_KEY in .env.local when ready for real model generation (currently on local fallback)

## Next 15 min
Finish the crisis classifier + fallback + Talk box build (architecture decided above). Bring back: crisis-lab confirmation of classifier + fallback paths, two-tone-style Talk screenshots.
