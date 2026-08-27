# NOW

**Category:** Hybrid — AI-native + Social + Health/finance/kids
**Gates:** A ✓ (non-goals in ATO_PLAN_v2.md) · B ✓ (iOS/Expo, Supabase, Apple Sign-in+email) · C in progress · D not started
**Modules on:** report/block (Social), crisis static-card + privacy pass (Health/finance/kids) — both required, in progress
**Live AI + model:** Cursor, Grok 4.6 (current), Expo SDK 54

## On
**Stage 9 first pass shipped (intake core + Day 1 payoff wiring).** Fresh onboarding is identity, then 9 chip screens with a visible "N of 9". Five new ME columns (`evening_wind_down`, `energy_pattern`, `recovery_style`, `support_style`, `current_focus`) — existing `talk_style` / `show_up` / `knocks_you_off` / `morning_cue` names and types unchanged. `check_count < 3` picks a `first_cards.md` slot from energy-pattern + support-style and inserts the person's own `morning_cue` phrase into the Do. Live row: handle `zintake9` has all 9 fields; Day 1 Do is `After you make coffee, sit for one minute before opening your phone.`

**Stage 8 — nearly closed, three loose ends (unchanged):**
1. EAS binary 10 (`1d0d1041-9318-461f-b995-c589ac505dc2`, git `dc9ae77`) — OTA + real app icon cut. Needs `eas submit`, then install + confirm on a real device. **Do not submit binary 8 or 9.** Binary 8 (`d40e57a9`) **was already submitted and installed**.
2. Sentry native crash symbolication — still **unconfirmed** from here. Re-check once binary 10 is on-device, or by opening `e7bed112` in the Sentry dashboard.
3. Friends external testing group — Beta App Review pending on Apple since Aug 26, 2026. No action, just waiting.

**EAS Update (OTA) is live as of binary 10.** Devices on binary 10+ can receive this Stage 9 JS change via `eas update`. Devices on binary 8 or earlier cannot.

**Decision (Aug 27, 2026): Wave 1.5 and Wave 3 both start now, in parallel — intentional deviation from plan sequencing.** Night wall must not surface to real testers until Wave 2 Stage 2 ("I'm going") is live.

**Next boxes, one at a time:**
- Wave 1.5 Stage 11 — Optional fast-entry (Stage 10's bank-card wiring shipped with Stage 9; remaining Stage 10 visual two-account check is a confirm, not a build)
- Wave 2 Stage 2 — "I'm going" + friend colors (needed before Wave 3's wall means anything)
- Wave 3 — Plugs (deal rows) + Night wall

## Done
See git history for the full Stage 1–8 build log. Stage 9 first pass (this change): 9 tappable core questions, ME schema, Day 1 cue insert + energy/support bank pick. Not repeated here — this file's "On" section is the live edge of work; ATO_PLAN_v2.md and git history hold the full record.

## Left
- Submit + confirm binary 10 on device (icon, OTA, everything from today). Do not submit 8 or 9.
- Re-check Sentry symbolication (event `e7bed112` on binary 8 is unconfirmed; re-check on binary 10 or in the dashboard)
- Friends Beta App Review — waiting on Apple
- Edmtrain live data — waiting on their key approval; Around stays honest-empty until then
- Known, accepted, non-blocking: AI-quota client-bypass hardening — public-launch item, not now
- Stage 9 follow-ups (not this box): evening/energy push timing; re-intake for pre-field accounts; "something else" free-text on knocks_you_off

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
- **Intentional deviation:** the locked Ink / Paper / Steel / Bloom palette in ATO_PLAN_v2.md is discarded. Appearance is now five modes (Soft / Zen / Quest / Neon / Anime). Not a bug — the plan line was updated in the same change.
- **Intentional deviation (Aug 27, 2026):** Wave 1.5 and Wave 3 start now in parallel, instead of waiting for the Wave 1 Gate then Wave 2 Stage 2. Night wall must not surface to real testers until Wave 2 Stage 2 ("I'm going") is live.
- **Around refresh secrets (Wave 2):** Edge Function `refresh-around` is deployed (`verify_jwt: false`; auth is `AROUND_REFRESH_SECRET`). Needs `EDMTRAIN_CLIENT_KEY` (apply at edmtrain.com/developer-api while signed in) and `AROUND_REFRESH_SECRET`. Cron is not scheduled until both exist in Vault + function secrets. Phone never holds the Edmtrain key. ToS: displayed cache < 24h; unmodified event `link`; do not mix Edmtrain listings with another events feed (RA/Shotgun/DICE are ticket link-outs only).

## Next 15 min
Open new Cursor chat. Stage 11 (optional fast-entry) is the next Wave 1.5 box — skippable MBTI/Big Five/attachment/conflict layer, translating into the same backbone, no raw diagnostic labels stored. Confirm binary 10 submitted/installed if not already done.
