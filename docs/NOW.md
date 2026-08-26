# NOW

**Category:** Hybrid — AI-native + Social + Health/finance/kids
**Gates:** A ✓ (non-goals in ATO_PLAN_v2.md) · B ✓ (iOS/Expo, Supabase, Apple Sign-in+email) · C in progress · D not started
**Modules on:** report/block (Social), crisis static-card + privacy pass (Health/finance/kids) — both required, in progress
**Live AI + model:** Cursor, `deepseek-v4-flash` (default), Grok 4.6 confirmed reachable again as of handoff #4 — Expo SDK 54

## On
Stage 8 (TestFlight) — sequencing as tight handoffs rather than one big box:
1. ✅ Apple Sign-In + delete-account/token revoke — DONE, verified on real device.
2. ✅ Invite/referral gate (Auth + ME) — DONE, pushed.
3. ✅ Push notifications + widget — DONE, verified on real device.
4. ✅ Floor-requirements sweep — DONE, pushed `f244a03`. One manual loose end (below).
5. Legal + landing copy — drafted here directly, not a Cursor job — **next up**
6. EAS build → TestFlight submission

**Handoff #4 loose end (yours, not Cursor's):** Sentry is wired (`floor-check` 8/8 on init/plugin/wrap assertions) but not DSN-connected — no `EXPO_PUBLIC_SENTRY_DSN` in `.env.local` or EAS env yet, so nothing has landed in a dashboard. Create a free Sentry project, add the DSN in both places, reload, tap **Test crash reporting → JS error** on the You tab, confirm it shows up in Sentry Issues. Native crash test needs the *next* EAS build (current dev client predates the native module) — hold that check until the Stage 8 EAS build in handoff #6.

**Also designed this session, not yet started, own future box after Stage 8 wraps:** Understanding spec (see ATO_PLAN_v2.md) — full onboarding/personalization redesign, backlog item below.

## Done
- Stage 1 (Home shell) — screenshot verified: 3 tabs (Home, Sage, You), no Circle tab, fake card, fake poster
- Stage 2 (Sign-in + ME + Theme) — fully verified: OTP email auth, ME row saves, sign-out, duplicate/reserved handle errors
- Stage 3 (Pixel) — fully verified: composable recipe, measured skeleton anchors, hands correct both sides, 5 looks swap cleanly
- Stage 4 (Dawn + Router) — fully verified: sage.txt + first_cards.md live, bank/model routing proven, filters, AI consent gate enforced at router level. 16/16 automated checks pass.
- Crisis module + classifier + keyword fallback + Talk box — built and verified 23/23 (see prior NOW.md detail); Sage tab rebuilt as chat UI, persistent lifebuoy support button, auto-shown card, one-tap dismiss
- Stage 5 (Talk) — built + verified 23/23
- Stage 6 (Share + Circle) — built + verified per plan done-bar
- Stage 7 (Chat + Report) — built + verified per plan done-bar
- Stage 8, handoff #1 (Apple Sign-In + delete/revoke) — device-verified, `confirmRevoked()` true
- Stage 8, handoff #2 (invite/referral gate) — `signup_mode: invite_only`, auto-issued invite codes, `referred_by`, recursive moderation functions; 7/7 automated + seeded tree pause test passed; committed `33aec7f`, pushed
- Stage 8, handoff #3 (push notifications + widget) — `expo-notifications`, WidgetKit native SwiftUI; all four device-test steps verified on real iPhone; committed `252960d` → `9826610`, pushed
- Stage 8, handoff #4 (floor-requirements sweep) — committed and pushed `f244a03`:
  - Sentry wired (native crash handling on, Expo plugin, Metro Debug IDs, Test crash reporting card on You) — **DSN not yet connected, see loose end above**
  - App Privacy nutrition labels drafted in `src/app/legal/app-privacy-labels.md`, cross-checked against `PrivacyInfo.xcprivacy` and `app.json` (10 collected types, no tracking) — ready to paste into App Store Connect at submission, not yet typed there
  - `PrivacyInfo.xcprivacy` present for app + widget target, `NSPrivacyTracking = false`, required-reason API codes filled (UserDefaults, file timestamp, system boot time incl. Sentry + widget App Group)
  - "Coach" labeling audited across Talk tab, Home card, morning push, widget, consent cards — "Sage is a coach... not a person" language live in UI copy itself, not just policy doc. Chat and evening/Sunday pushes untouched (not Sage-speaking surfaces).
  - Rate limiting: server-side `claim_ai_call()` (SECURITY DEFINER, advisory-locked, keyed on `auth.uid()`), `app_config.ai_daily_cap`/`ai_monthly_cap` (20/200) configurable without rebuild, `ai_usage` client-readable/not-writable, deny path shows "Sage's out of things to say for today, back tomorrow" not a raw error. Verified live on `ato` with a temporarily-lowered cap; `quota-check` 5/5, `voice-router-check` 24/24 (spy `generateTalk` not called on deny).

## Left
Stage 8 (TestFlight) — legal + landing copy, then EAS build → TestFlight submission

## Backlog (Stage 8 — polish pass, before TestFlight)
- Fantasy UI Borders pack (Kenney) — UI chrome/panels/buttons, separate visual system from character art
- Universal font/spacing consistency pass — cross-cutting, do once near the end
- Kenney credits/disclaimer page — bundle into You tab settings area
- Monster Builder Pack — parked, needs eyes/mouth slots added to recipe before usable
- Make show_up / knocks_you_off / morning_cue editable in Settings, not just talk_style
- Revisit onboarding question wording if it still feels off after a fresh look
- Crisis card: region-detection (currently hardcoded to Canada/988) — needs a real approach
- Crisis: relational-safety/abuse category (separate from self-harm) — needs its own resource number
- SecureStore warning: "Value being stored is larger than 2048 bytes" — minor, not urgent
- **Gemini key exposure gap (new, flagged by Grok in handoff #4):** rate limiting is enforced server-side for the app's own Talk flow, but a patched client could skip the `claim_ai_call()` RPC entirely and hit Gemini directly using the existing `EXPO_PUBLIC_GEMINI_API_KEY`, since it's a client-embedded key. Real fix is moving the Gemini call behind an Edge Function so the key never ships to the client — that's Router-box work, not floor-sweep work, so it was correctly left out of handoff #4. Needs its own small box before or shortly after public launch; not a TestFlight blocker (friends-only, low abuse surface) but should not be forgotten before `signup_mode` flips to `public`.
- **Understanding spec** (see ATO_PLAN_v2.md → Understanding spec) — own future box (`intake`), sequenced after Stage 8 wraps
- Slack — parked as future ops tooling, raise proactively only if/when app scales

## Crisis detection — final architecture (decided after extended discussion)
AI-judged (separate lightweight Gemini classification call) with keyword-list fallback if the classifier fails/times out. No confirmation gate before showing the card. Persistent subtle support button in Talk UI regardless of detection. Legal disclaimer draft in crisis-disclaimer.md — still needs a lawyer's pass before real users.

## Idea parking lot — Wave 3 expansion (gated: only after Wave 2 has real nights happening)
1. Weekly Read — Sunday depth, title + one true line free, body locked
2. Last 30 days of cards
3. Weekly archive
4. Deeper Circle — model grid + "how you two talked this week," unlocks when both hit 7 Checks
5. More Talk — higher cap + can ask Sage about this week's Read
6. Mid-week note
7. Shareable weekly card
8. Interest news, second voice, extra pixel looks, custom pixel

## Idea parking lot — games/tokens/accuracy (single-player first, multiplayer parked further out)
Games give tokens; tokens unlock "refresh about themselves." Accuracy meter shows how well-known their profile is. Multiplayer games = 2x tokens, parked until Circle/Around exist.

## Housekeeping
- docs/ATO_PLAN_v2.md, docs/ME.md, docs/NOW.md, docs/BUSINESS.md — Cursor maintains these directly. Commit together, `git push` immediately, never left local-only.
- EXPO_PUBLIC_GEMINI_API_KEY set and live-verified. Model pinned to `gemini-3.7-flash` (not `-latest`).
- ATO_PLAN_v2.md updated with Referral spec + Understanding spec (future `intake` box, also listed in packets) + Public App Store readiness checklist — treat locked additions as locked, not deviations to flag.
- **Open decision (emci's, not technical):** Apple Developer account type — Individual vs Organization. Revisit before public submission.
- Bundle ID `com.emgens.ato` (App ID) / `com.emgens.ato.signin` (Services ID). Edge Function secret `APPLE_CLIENT_ID` = bundle ID.
- Apple client_secret JWT minted Aug 25, 2026. **Expires Feb 24, 2027 07:24 UTC.** Team ID `Q2UF7F6N36`, Key ID `3JKLGRJ586`. Regenerate late Jan 2027 — not automated.
- Email sending on `noreply@asstrollogs.com` (Resend-verified). Later: `mail.emgens.com` as verified Resend domain + Apple Email Sources list.
- Age gap (self-reported age question missing from Stage 2) — still needs closing; wasn't part of handoff #4's five items, re-flag before legal/landing pass since privacy labels now reference age-gating.
- **signup_mode** is `invite_only` in production. Flip to `public` is a one-line SQL change — per plan, at App Store public-submission time, not TestFlight. Don't flip early.
- First EAS dev-client build with native modules (`expo-notifications`, WidgetKit) succeeded after fixing two credential/build issues — see Stage 8 item 3. Future native-module additions may hit similar target/asset-catalog quirks; keep `ATOWidget` naming and the icon-inheritance prebuild plugin as the reference.

## Next 15 min
Your action item: create the free Sentry project, add `EXPO_PUBLIC_SENTRY_DSN` to `.env.local` and EAS env, reload, tap **Test crash reporting → JS error** on the You tab, confirm it lands in Sentry Issues. Then start Stage 8 handoff #5: legal + landing copy — drafted directly in this chat, not a Cursor job.
