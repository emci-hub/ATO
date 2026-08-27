# NOW

**Category:** Hybrid — AI-native + Social + Health/finance/kids
**Gates:** A ✓ (non-goals in ATO_PLAN_v2.md) · B ✓ (iOS/Expo, Supabase, Apple Sign-in+email) · C in progress · D not started
**Modules on:** report/block (Social), crisis static-card + privacy pass (Health/finance/kids) — both required, in progress
**Live AI + model:** Cursor, Grok 4.6 (current), Expo SDK 54

## On
**Check window + weekly recap cap + Home milestone badge are in.** A Check is for a calendar day in the user's timezone (signup-local day 1). You can log today or up to 2 days back if that day is still empty — one Check per day, not extra Checks on the same day. Days 3+ back are permanently closed. `record_check` is the only write path (client inserts revoked). Read + Do text is kept for the rolling 7 calendar days (today through today-6); older text is nulled, did/skip stays forever for `check_count` and valence. Sunday recap still counts outcomes for the previous Sun–Sat; last Sunday's Read may already be pruned (today-7). `this_week` on ME was never implemented — recap reads the checks table. Home shows a small all-time Checks chip (presence-tier glow, all five appearance modes).

**Nav pixel tap moods are in.** Tapping the top-right companion plays a short coherent gesture (wave, thumbs-up, happy bounce, or hug) with no startup delay. Rapid re-taps interrupt-and-restart — they do not queue. Sage weights bounce/wave a bit more; current-you uses the full set evenly. Crisis still hard-disables hands.

**Pixel placement shipped — global nav companion.** The live pixel sits small and fixed top-right on all tabs (Home, Sage, Around, You), mounted at the tab shell so it does not remount on tab switch or scroll with content. Idle / gesture / milestone / tap-mood animation runs from that instance. Current-you (no growth glow) on Home/Around/You; aspirational-you (presence glow + depth sparkle) on Sage. Home no longer renders a large centered face. The You-tab poster is identity + QR only (no large pixel).

**UI polish pass is in (poster, button borders, Sage zoom).** Poster redesigned on Ink / Paper / Steel / Bloom (shareable artifact only — app chrome stays Soft / Zen / Quest / Neon / Anime). Crisis "I'm okay, keep going" now has a 2px accent border. Soft-mode outline buttons used `theme.backgroundSelected` as a border (invisible on white); they now share `controlBorderColor`. Sage pinch-zoom is disabled on tab ScrollViews; tab chrome + SystemUI use the theme background so a zoom-out cannot flash native white.

**Wave 2 Stage 2 is in — "I'm going" + friend colors.** Opt-in `going` row per user per show (`set_going` / `night_snapshot`). A color blob appears on a show only at ≥3 people of that `show_up` hue; raw counts never leave the RPC. Faces show only when the person is going, `me.visible` is true (plan field `show`; SHOW is reserved), and they are not blocked either way. Hidden faces still count toward colors. 18+ nights call `is_at_least_age(born_on, 18)`. City stays typed (not GPS). Calgary `weekend.json` is still honestly empty until Edmtrain; type `fixture` as city for seeded test shows.

**Stage 9 first pass is in (intake core + Day 1 payoff wiring).** Fresh onboarding is identity, then 9 chip screens with a visible "N of 9". Five new ME columns (`evening_wind_down`, `energy_pattern`, `recovery_style`, `support_style`, `current_focus`) — existing `talk_style` / `show_up` / `knocks_you_off` / `morning_cue` names and types unchanged. Live row: handle `zintake9`.

**Stage 8 — nearly closed, three loose ends (unchanged):**
1. EAS binary 10 (`1d0d1041-9318-461f-b995-c589ac505dc2`, git `dc9ae77`) — OTA + real app icon cut. Needs `eas submit`, then install + confirm on a real device. **Do not submit binary 8 or 9.** Binary 8 (`d40e57a9`) **was already submitted and installed**.
2. Sentry native crash symbolication — still **unconfirmed** from here. Re-check once binary 10 is on-device, or by opening `e7bed112` in the Sentry dashboard.
3. Friends external testing group — Beta App Review pending on Apple since Aug 26, 2026. No action, just waiting.

**EAS Update (OTA) is live as of binary 10.** Devices on binary 10+ can receive this check-window / recap / badge JS change via `eas update`. Devices on binary 8 or earlier cannot.

**Decision (Aug 27, 2026): Wave 1.5 and Wave 3 both start now, in parallel — intentional deviation from plan sequencing.** Wave 2 Stage 2 ("I'm going") is now live, so Night wall is unblocked for Wave 3.

**Next boxes, one at a time:**
- Wave 1.5 Stage 11 — Optional fast-entry (Stage 10's bank-card wiring shipped with Stage 9; remaining Stage 10 visual two-account check is a confirm, not a build)
- Wave 3 — Plugs (deal rows) + Night wall (going exists; wall can surface)

## Done
See git history for the full Stage 1–8 build log. Check window + recap text cap + Home milestone badge (this change). Nav tap moods, UI polish, Wave 2 Stage 2, and Stage 9 first pass are already in. This file's "On" section is the live edge of work; ATO_PLAN_v2.md and git history hold the full record.

## Left
- Submit + confirm binary 10 on device (icon, OTA, everything from today). Do not submit 8 or 9.
- Re-check Sentry symbolication (event `e7bed112` on binary 8 is unconfirmed; re-check on binary 10 or in the dashboard)
- Friends Beta App Review — waiting on Apple
- Edmtrain live data — waiting on their key approval; Around stays honest-empty until then
- Known, accepted, non-blocking: AI-quota client-bypass hardening — public-launch item, not now
- Stage 9 follow-ups (not this box): evening/energy push timing; re-intake for pre-field accounts; "something else" free-text on knocks_you_off
- Wave 2 Stage 2 flags (not guessed): 19+ uses the same 18 helper; `p_ages` is sent by the client (shows live in weekend JSON, not Postgres); emci/yeezy `born_on` is still null so 18+ nights fail closed for those rows

## Public release readiness — do not start until public launch is imminent
These are real, but they are not TestFlight work and they are not next. Leave them parked.
- App Store Connect privacy labels: answers ready in `app-privacy-labels.md` (11 types including Date of Birth), not yet pasted into App Store Connect itself
- `support@asstrollogs.com` — used across privacy.md/terms.md/landing footer as the contact address; **not yet confirmed as a real, monitored inbox**
- Terms §13 (governing law/dispute resolution) and the crisis disclaimer both still need a lawyer's pass

## Backlog (not blocking the Friends TestFlight group)
- Fantasy UI Borders pack (Kenney) — UI chrome/panels/buttons
- Monster Builder Pack — parked, needs eyes/mouth slots added to recipe before usable
- Make show_up / knocks_you_off / morning_cue editable in Settings, not just talk_style
- Revisit onboarding question wording if it still feels off after a fresh look
- Crisis: relational-safety/abuse category, own resource number, parked separately
- **AI capacity hardening** — close the client-embedded-key bypass before public launch (server-side proxy or equivalent)
- Slack — parked as future ops tooling, bring up again if/when the app scales
- Push notification timing from `energy_pattern` / `evening_wind_down` (fields exist; not wired in Stage 9)

## Housekeeping
- docs/ATO_PLAN_v2.md, docs/ME.md, docs/NOW.md, docs/BUSINESS.md — Cursor maintains these directly. Commit together, `git push` immediately, never left local-only.
- EXPO_PUBLIC_GEMINI_API_KEY set and live-verified. Model pinned to `gemini-3.7-flash`.
- **Open decision (emci's, not technical):** Apple Developer account type — Individual vs Organization. Revisit before public submission.
- Bundle ID `com.emgens.ato` (App ID) / `com.emgens.ato.signin` (Services ID) confirmed.
- Apple client_secret JWT minted Aug 25, 2026, expires Feb 24, 2027 07:24 UTC. Regenerate around late Jan 2027. Not automated.
- Email sending on `noreply@asstrollogs.com` (Resend-verified). `support@asstrollogs.com` used as the public contact address in legal/landing copy — inbox confirmation is parked under Public release readiness, not active work.
- Landing page live at `ato.emgens.com` — social handle decided as `@whatsyourato` (primary), fallback `emgensato`/`atoapp`/`heyato` per-platform if taken. Not yet confirmed reserved on any platform.
- **Intentional deviation:** the locked Ink / Paper / Steel / Bloom palette in ATO_PLAN_v2.md is discarded for app chrome. Appearance is five modes (Soft / Zen / Quest / Neon / Anime). The You-tab share poster still uses Ink / Paper / Steel / Bloom as a fixed shareable artifact. Not a bug — the plan line was updated in the same change.
- **Intentional deviation (Aug 27, 2026):** Wave 1.5 and Wave 3 start now in parallel, instead of waiting for the Wave 1 Gate then Wave 2 Stage 2. Stage 2 ("I'm going") shipped; Night wall may surface with Wave 3.
- **Around refresh secrets (Wave 2):** Edge Function `refresh-around` is deployed (`verify_jwt: false`; auth is `AROUND_REFRESH_SECRET`). Needs `EDMTRAIN_CLIENT_KEY` (apply at edmtrain.com/developer-api while signed in) and `AROUND_REFRESH_SECRET`. Cron is not scheduled until both exist in Vault + function secrets. Phone never holds the Edmtrain key. ToS: displayed cache < 24h; unmodified event `link`; do not mix Edmtrain listings with another events feed (RA/Shotgun/DICE are ticket link-outs only).

## Next 15 min
Open new Cursor chat. Stage 11 (optional fast-entry) is the next Wave 1.5 box — skippable MBTI/Big Five/attachment/conflict layer, translating into the same backbone, no raw diagnostic labels stored. Wave 3 (plugs + Night wall) is unblocked now that going exists. Confirm binary 10 submitted/installed if not already done.
