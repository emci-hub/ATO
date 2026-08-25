# NOW

**Category:** Hybrid — AI-native + Social + Health/finance/kids
**Gates:** A ✓ (non-goals in ATO_PLAN_v2.md) · B ✓ (iOS/Expo, Supabase, Apple Sign-in+email) · C in progress · D not started
**Modules on:** report/block (Social), crisis static-card + privacy pass (Health/finance/kids) — both required, in progress
**Live AI + model:** Cursor, `deepseek-v4-flash` (default volume) — crisis/safety-critical work always routes to Claude Opus 5 regardless of Home/Away, Expo SDK 54

## On
Kenney pipeline + gesture work (side quest off the Wave 1 stage sequence). Crisis detection being reverted from AI-classifier to keyword-only (Cursor working, Opus 5 — token/latency cost on the classifier no longer justified the catch-rate gain). Two bugs also still open: Circle re-add access issue, hand/body color mismatch. Stage 7 (Chat + Report) is queued behind all of this — not started.

## Done
- Stage 1 (Home shell) — screenshot verified: 3 tabs (Home, Sage, You), no Circle tab, fake card, fake poster
- Stage 2 (Sign-in + ME + Theme) — fully verified: OTP email auth, ME row saves, sign-out, duplicate/reserved handle errors
- Stage 3 (Pixel) — fully verified: composable recipe, measured skeleton anchors, hands correct both sides, 5 looks swap cleanly
- Stage 4 (Dawn + Router) — fully verified: sage.txt + first_cards.md live, bank/model routing proven (Day 1 screenshot live on real account), filters (repeats/vague/cruel/no-cut-after-crisis/no-two-cuts), back button added, AI consent gate enforced at router level (Apple 5.1.2) — null/true/false stored on ME row, asked once, denial = permanent bank-only + Talk off. 16/16 automated checks pass. Only untested-live piece: the actual consent prompt UI (needs check_count>=3, will confirm naturally in a few days of real use).
- docs/ATO_PLAN_v2.md added to repo (byte-verified copy)
- Crisis module (card, logging, dormant detection hook, router short-circuit) built and verified 18/18 checks
- **Stage 5 (Talk) — fully closed.** Crisis classifier + keyword fallback + Talk box built and verified 23/23 offline, plus **7/7 live checks** against the real Gemini API: crisis-flagged message → classifier fires (not fallback) → boolean JSON, temp 0, 1061ms (within 4s timeout) → static crisis card renders, zero `generateTalk` calls (spy-provider proof) → clean message → classifier returns false → Talk proceeds normally. Two talk_style users get visibly different tone on the same prompt (talk-lab). Sage tab rebuilt as chat UI with today/this week/something else chips + More, persistent lifebuoy support button, auto-shown crisis card with one-tap dismiss, no lockout.
  - Fix that unblocked the live path: `gemini-3.7-flash` needs `thinkingConfig: { thinkingLevel: 'low' }` nested under `generationConfig`, or it burns the whole output budget on thinking and returns empty content (silently triggering fallback). `maxOutputTokens` bumped 12 → 100.
  - **Model pinned deliberately to `gemini-3.7-flash` (versioned), not `gemini-flash-latest`.** The unversioned `-latest` alias is Google's experimental tier and can hot-swap with only 2 weeks' notice — not acceptable for a safety-critical classifier whose exact behavior was just verified. Manual quarterly check for new stable Gemini flash releases, re-run `scripts/crisis-live-check.ts` before ever bumping the pin.
  - `scripts/crisis-live-check.ts` added — reusable live harness (spy-provider + redacted request/response logging) for any future model-pin bump.

- **Stage 6 (Share + Circle) — fully closed, on-device verified.** Share: Stories-size poster (real pixel, name, `@handle`, `show_up`, QR) via view-shot → native Share sheet; copy-link; public `/@handle` page (no auth) resolves through a security-definer `public_profile` function that only exposes poster fields. Circle: `connections` table, one gate — a scan or pasted link inserts A→B, a DB trigger mirrors B→A, Realtime pushes the tab to both devices without a manual refresh. Circle screen shows each peer's real pixel + honest card (name, handle, show_up, latest check) straight from `me`/`checks`, nothing synthesized, no chat touched. Added **Unfriend**: deletes the connection both directions (mirror-delete trigger, no orphan rows), tab disappears live on both sides at 0 connections.
  - On-device pass confirmed clean: fresh/never-scanned account shows exactly 3 tabs; unfriend → refriend cycle works both directions; scanned peer's card shows real data, not placeholder; Home-bounce after a successful scan (see below) felt fine in practice, no polish needed.
  - Two bugs found and fixed during on-device testing (code-correctness checks alone hadn't caught either):
    1. **Realtime double-subscription** — `useCircle` was called independently from 3 places (both tab bars + the Circle screen), each opening a channel on the same topic name, causing `cannot add 'postgres_changes' callbacks ... after 'subscribe()'` on login for any account with an existing connection. Fixed by consolidating into a single `CircleProvider` (`src/lib/circle-context.tsx`) wrapping the tab layout; all consumers read from context now, zero duplicate channels.
    2. **Dynamic tab trigger warning** — expo-router's native-tabs explicitly does not support dynamically adding/removing `<Trigger>` children at runtime (confirmed in their docs); toggling the Circle trigger in/out of the JSX tree on `hasCircle` caused `Layout children must be of type Screen...` and would have broken state on the flip. Fixed by keeping the Circle `<Trigger>` **statically present** always, using the documented `hidden={!hasCircle}` prop to gate visibility/navigability instead — "not present, not hidden-in-the-bar" rule still holds, just implemented the way the framework actually supports. **Note for Stage 7+: any future conditional tab (if one ever comes up) should use this same static-trigger + `hidden` pattern from the start, not a conditional JSX child.**
  - Verified: RLS + mirror trigger + unfriend mirror-delete via rollback-transaction tests, `tsc --noEmit` clean, 23/23 voice suite, stage6 scanner/link-parsing checks pass, 0 lint errors, web export resolves `/circle` + `/[handle]`.
  - Known side effect, accepted as fine: per expo-router's `hidden` docs, toggling it remounts the navigator, so the app lands back on Home right after a successful scan. Confirmed on-device this reads as fine, not jarring — no fix needed.
  - Commits: `d6d2d05` (Stage 6 build) → `32d948c` (subscription fix + unfriend + static-trigger fix, squashed from `10aa389`).

## Left
Stages 7–8, Wave 1

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
- Quarterly: re-check for new stable Gemini flash releases, re-run crisis-live-check.ts before bumping the pinned model version

## Crisis detection — final architecture (revised — reverted to keyword-only)
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
- docs/ATO_PLAN_v2.md, docs/ME.md, docs/NOW.md all live in the repo now — Cursor maintains these directly going forward
- EXPO_PUBLIC_GEMINI_API_KEY set and live-verified. Model pinned to `gemini-3.7-flash` (not `-latest`) — see rationale under Stage 5 Done.

## Backlog addition — persistent pixel avatar + growth tiers (queued after current bug fixes)
Two related, not-yet-built ideas, both stemming from the Kenney gesture work:
- **Persistent pixel placement:** small (~26px) circle avatar, header-right, present on every screen — shows current recipe + whatever event gesture is active (thumb/point/peace/hidden). Chosen over a tab-bar-icon placement (too small to read a gesture clearly) and a floating bubble (fixed-position overlay, worse fit for the nav chrome). Not yet built — this is the resting-state placement Home's face already has a version of; this extends it app-wide.
- **Sage tab icon → pixel face, aspirational variant:** replaces the current sparkle icon. Same character as Home's pixel, marked with a subtle glow/shine tell so it reads as "the version you're working toward," not current-you. See ME.md's "Sage/Pixel relationship" note for the full reasoning — this is a real redefinition of what Sage represents (aspirational-you, not a separate coach character), not just an icon swap.
- **Growth tiers (the mechanic behind the glow):** milestone-based, not continuous — reuses `check_count` (already on ME) and the plan's existing 7-Check unlock threshold, no new number invented.
  - Tier 0 (`check_count < 3`): Sage's pixel barely distinguished from Home's — app hasn't learned the person yet.
  - Tier 1 (`check_count ≥ 3`): subtle glow/shine tell begins.
  - Tier 2 (`check_count ≥ 7`, same moment deeper features unlock): shine intensifies.
  - Tier 3 (threshold TBD — likely tied to facts-learned count): most distinct version, decide later.
  - Mechanically: a `growth_tier` modifier layer (glow opacity / small sparkle) on top of the existing Kenney-pipeline pixel render — not a new asset per tier, not a live "distinctiveness" score. Deliberately separate from the daily `look` system (even/tired/set/listen/glow) — different signal, different timescale, don't conflate them.
- Not started. Sequenced after: current Talk/Circle/hand-color bug fixes → on-device gesture pass closes out → then this.

## Next 15 min
Waiting on Cursor: (1) gemini.ts thinkingConfig fix for Talk (truncation bug) + sage.tsx composer padding fix, (2) still open from prior pass — Circle re-add bug (unfriend → re-scan leaves one side without Circle access) and hand/body color mismatch. Once those land, run the full on-device gesture checklist, then decide on persistent-avatar + growth-tier build order.

## Backlog addition — Kenney import pipeline (queued after Stage 6 close)
Plan to build a generalized, family-agnostic Kenney asset pipeline rather than a one-off Pixel fix, since more Kenney packs are coming:
- One-time asset-prep script: re-export any pack's native PNGs to one fixed target resolution (derived from the largest actual render context — e.g. the Share poster — not picked arbitrarily), so the app never touches a pack's raw native size directly.
- Per-family manifest (`assets/kenney/<family>/manifest.ts`): declares part slots, anchor offsets ("skeleton," measured like Stage 3's original anchors), color variants, discrete swap-states (blink/gesture/mouth) — different packs can have different skeletons, just a different manifest.
- One generic renderer component reading `recipe + manifest`, family-agnostic — adding a new pack later means "manifest + prep script run," not new rendering code.
- One generic animation layer: discrete state swaps per the manifest's declared states, plus procedural transforms (breathe/bob/tilt/squash) via Reanimated applied to the composed group — doesn't care which family is active.
- `docs/KENNEY_IMPORT.md` — repeatable checklist capturing the above so future packs don't require re-deriving the approach.
- Also: confirm whether current Pixel rendering is tinting a neutral asset at runtime (likely root cause of the "flat/plain" look) vs. selecting pre-colored files — check this before assuming a resolution-only fix is needed.
- Shape Characters pack (`kenney_shape-characters.zip`) is the first candidate to migrate through this pipeline once it's built.
