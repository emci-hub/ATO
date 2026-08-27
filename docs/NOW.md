# NOW

**Category:** Hybrid — AI-native + Social + Health/finance/kids
**Gates:** A ✓ (non-goals in ATO_PLAN_v2.md) · B ✓ (iOS/Expo, Supabase, Apple Sign-in+email) · C in progress · D not started
**Modules on:** report/block (Social), crisis static-card + privacy pass (Health/finance/kids) — both required, in progress
**Live AI + model:** Cursor, Grok 4.6 (current), Expo SDK 54

## On
**Stage 8 — nearly closed, three loose ends:**
1. EAS binary 10 (`1d0d1041-9318-461f-b995-c589ac505dc2`, git `dc9ae77`) — OTA + real app icon cut. Needs `eas submit`, then install + confirm on a real device. **Do not submit binary 8 or 9.** Binary 8 (`d40e57a9`) **was already submitted and installed** (theme picker, Around, Home fix, age field verified on-device).
2. Sentry native crash symbolication — upload is on (`SENTRY_AUTH_TOKEN`, `SENTRY_DISABLE_AUTO_UPLOAD=false`). Binary 8 native crash landed as event `e7bed112`; stack symbolication still **unconfirmed** from here (CI token cannot read event frames; no `com.emgens.ato@1.0.0+8` release). Re-check once binary 10 is on-device, or by opening `e7bed112` in the Sentry dashboard.
3. Friends external testing group — Beta App Review pending on Apple since Aug 26, 2026. No action, just waiting.

**EAS Update (OTA) is live as of binary 10.** `expo-updates` wired, fixed `runtimeVersion` `"1.0.0"`, production channel set. Any device on binary 10+ can receive JS/UI/backend-only changes via `eas update` — no new build, no Apple review. Devices still on binary 8 or earlier cannot receive OTA pushes and need a fresh TestFlight install of 10 first.

**Decision (Aug 27, 2026): Wave 1.5 and Wave 3 both start now, in parallel — intentional deviation from plan sequencing.**
ATO_PLAN_v2.md's Wave 3 spec gates the Night wall on Wave 2 Stage 2 ("I'm going" + friend colors) actually being live, specifically to avoid shipping an empty chat room nobody's in. That risk was flagged to emci directly and he chose to proceed anyway — noted here, not silently overridden. Practical mitigation: build Wave 3's Night wall logic/UI now, but its actual first real use will naturally wait until Wave 2 Stage 2 exists, since the wall only renders for a show people are marked "going" to. Sequence build order however is fastest; just don't advertise/surface the wall to real testers before Wave 2 Stage 2 ships.

**Next boxes, no build required (OTA-eligible) — Cursor takes these one at a time, one box per stage per plan discipline:**
- Wave 1.5 Stage 9 — Intake core (see ATO_PLAN_v2.md → Understanding spec for full detail)
- Wave 2 Stage 2 — "I'm going" + friend colors (needed before Wave 3's wall means anything)
- Wave 3 — Plugs (deal rows) + Night wall

## Done
See git history for the full Stage 1–8 build log (Home shell through floor-requirements sweep, EAS/TestFlight pipeline, five-mode appearance system, Around Stage 1 data layer, app icon, OTA wiring). Not repeated here — this file's "On" section is the live edge of work; ATO_PLAN_v2.md and git history hold the full record.

## Left
- Submit + confirm binary 10 on device (icon, OTA, everything from today). Do not submit 8 or 9.
- Re-check Sentry symbolication (event `e7bed112` on binary 8 is unconfirmed; re-check on binary 10 or in the dashboard)
- Friends Beta App Review — waiting on Apple
- Edmtrain live data — waiting on their key approval; Around stays honest-empty until then
- Known, accepted, non-blocking: AI-quota client-bypass hardening — public-launch item, not now

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
Open new Cursor chat. Confirm binary 10 submitted/installed if not already done. Then: Stage 9 (Intake core) — first box of the Wave 1.5 + Wave 3 parallel push, OTA-eligible, no build needed.
