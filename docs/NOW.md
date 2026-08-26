# NOW

**Category:** Hybrid — AI-native + Social + Health/finance/kids
**Gates:** A ✓ (non-goals in ATO_PLAN_v2.md) · B ✓ (iOS/Expo, Supabase, Apple Sign-in+email) · C in progress · D not started
**Modules on:** report/block (Social), crisis static-card + privacy pass (Health/finance/kids) — both required, in progress
**Live AI + model:** Cursor, Grok 4.6 (current), Expo SDK 54

## On
Stage 8 (TestFlight) — sequencing as tight handoffs:
1. ✅ Apple Sign-In + delete-account/token revoke — done, verified on real device.
2. ✅ Invite/referral gate (Auth + ME) — done.
3. ✅ Push notifications + widget — done.
4. ✅ **Floor requirements sweep — DONE, pushed `master` `57abf5e` → `ea2b4f3`.** See Done section for the five sub-items and commits.
5. Legal + landing copy — privacy.md/terms.md drafted in Claude, committed to `app/legal/` (`57abf5e`); landing page live at `ato.emgens.com`. **Loose ends still open, tracked below under Left.**
6. EAS build → TestFlight submission — next up.

## Done
- Stage 1 (Home shell) — screenshot verified: 3 tabs (Home, Sage, You), no Circle tab, fake card, fake poster
- Stage 2 (Sign-in + ME + Theme) — fully verified
- Stage 3 (Pixel) — fully verified
- Stage 4 (Dawn + Router) — fully verified, 16/16 automated checks pass
- Crisis module + classifier + Talk box — built and verified 23/23
- Stage 5 (Talk) — built + verified
- Stage 6 (Share + Circle) — built + verified
- Stage 7 (Chat + Report) — built + verified, `master` in sync
- Stage 8 handoff #1 (Apple Sign-In + delete/revoke) — done, `confirmRevoked()` true on real device
- Stage 8 handoff #2 (Invite/referral gate) — done, 7/7 automated checks + seeded tree pause test passed
- Stage 8 handoff #3 (Push notifications + widget) — done, all four device-test steps verified on real iPhone
- **Stage 8 handoff #4 (Floor-requirements sweep) — done, pushed `ea2b4f3`:**
  - **Sentry** (`e5c5a0f`) — already wired (init/wrap, native crash handling, You-tab test buttons). Added `npm run check:sentry`, plugin project set to `ato-app`. Verified: live JS error ingested, event id `600436b1001945eca54f84c5e67a6df7`. Native crash on TestFlight build 6 is expected **unsymbolicated** (upload was disabled for that binary). **EAS production source-map auto-upload is now on:** `SENTRY_AUTH_TOKEN` (sensitive), `SENTRY_DISABLE_AUTO_UPLOAD=false`, `SENTRY_ORG=emgens`, `SENTRY_PROJECT=ato-app`. Next production build should upload maps; no build triggered in this box.
  - **Privacy labels** (`22b242b`) — `src/app/legal/app-privacy-labels.md`, the App Store Connect paste sheet, aligned with `privacy.md`. Originally ten data types; **Date of Birth added** with the Stage 2 age field (now 11 types, still no tracking). Names Supabase, Gemini, Resend, Apple, Sentry. Push token intentionally not declared (v1 has none). Answers are ready to paste into App Store Connect — **not yet submitted there.**
  - **PrivacyInfo.xcprivacy** (`211e101`) — app + widget manifests already matched actual collection/required-reason APIs; locked types + API reasons into `floor-check`. Verified: `npx tsx ./scripts/floor-check.ts` 9/9 (Date of Birth added later with the age field; assertion count unchanged).
  - **Coach labeling** (`668424e`) — fixed gaps (Dawn lede, Talk title, composer placeholder, Teach Sage copy) so the UI itself, not just policy docs, labels Sage as a coach. Verified: floor-check coach assertions pass, no "Sage listens" language remains.
  - **Rate limiting** (`0f30625`) — live cap on project `ato`: **20 model calls/UTC day, 200/UTC month** (`app_config.ai_daily_cap`/`ai_monthly_cap`). Enforced via Postgres `claim_ai_call()` (SECURITY DEFINER, advisory lock), called from Talk UI before `generateTalk`. Deny copy: "Sage's out of things to say for today, back tomorrow." Daily-card generation intentionally not claimed (remounting Dawn would burn the cap). Verified: live SQL caps 20/200; `quota-check` 5/5; `voice-router-check` 24/24.
- Legal + landing copy drafted directly in Claude: `app/legal/privacy.md`, `app/legal/terms.md` (committed `57abf5e`), landing page live at `ato.emgens.com` (Vercel project `ato`, team `em-gens`, not yet linked to a git repo)
- `docs/BUSINESS.md` updated with finalized social handle decision (`@whatsyourato`, committed `57abf5e`)
- **Self-reported date of birth (Stage 2 ME box)** — `me.born_on` date, not a frozen age or 16+/18+ boolean. Onboarding Q1 is YYYY/MM/DD (same input pattern as the other text fields). Under 16: inline error "ATO is for people 16 and older." — blocked client-side before `createMe` and server-side in `complete_signup` before invite consume. 16/17 allowed; `is_at_least_age(born_on, 18)` stays false for Wave 2 going. Verified: `npm run check:age` 8/8; live under-16 RPC raises `age_under_16` with no ME row and invite unused; live 17-year-old stored `born_on = 2009-08-26`, `age_years = 17`, going helper false. Existing pre-field rows (`emci`, `yeezy`) stay NULL.
- **Kenney credits on You-tab Settings** — static Credits card lists only packs in `KENNEY_REGISTRY` (Shape Characters). Kenney, kenney.nl, pack page, CC0 line. Modular / Toon / 1-Bit / Animal Remastered / Fantasy UI Borders / Monster Builder are not bundled and are not listed.
- **SecureStore 2048-byte warning** — cause was the full Supabase session JSON written to Keychain under `sb-aijzsmupaaaxjctfgwpl-auth-token` (~2364 bytes for an Apple session; email-only was ~1898 and under the ceiling). Access JWT ~782–1199 bytes, refresh token 12 bytes — both fit. Adapter now keeps tokens in SecureStore (`ato.auth.access_token` / `ato.auth.refresh_token`) and the rest of the session in AsyncStorage; leftover oversized Keychain items migrate on next read. Verified: `npm run check:auth-storage` 6/6. Native Metro sign-in not reproduced here (Windows host, SecureStore is iOS/Android only).
- **Font/spacing consistency pass** — no new theme file; used existing `Spacing` + `ThemedText` types. Circle names 17→18 (match You), Unfriend 13→14 (`smallBold`), Sign out 16→14 (`smallBold` like other full-width buttons), inline errors `small`+600 → `smallBold`, Circle lede dropped cramped lineHeight 18 (match Home/Sage default), Sage message list bottom inset aligned to other tabs (`BottomTabInset + Spacing.four`).

## Left
- Stage 8 item 5 loose ends (not blockers for the sweep, but open before public/App Store submission):
  - App Store Connect privacy labels: answers ready in `app-privacy-labels.md` (now includes Date of Birth), not yet pasted into App Store Connect itself
  - `support@asstrollogs.com` — used across privacy.md/terms.md/landing footer as the contact address; **not yet confirmed as a real, monitored inbox**
  - Terms §13 (governing law/dispute resolution) and the crisis disclaimer both still need a lawyer's pass before public launch
  - Sentry native crash path — JS ingest verified; TestFlight build 6 native frames expected unsymbolicated. Next EAS production build should upload source maps (`SENTRY_AUTH_TOKEN` on EAS, auto-upload re-enabled). Confirm a native event in `ato-app` after that binary.
- Stage 8 item 6: EAS build → TestFlight submission — next up
- **Known, accepted, non-blocking for TestFlight:** a patched client could skip `claim_ai_call()` and call Gemini directly using the client-embedded key. Public-launch item, not a TestFlight blocker — added to backlog below.

## Backlog (Stage 8 — polish pass, before TestFlight)
- Fantasy UI Borders pack (Kenney) — UI chrome/panels/buttons
- Monster Builder Pack — parked, needs eyes/mouth slots added to recipe before usable
- Make show_up / knocks_you_off / morning_cue editable in Settings, not just talk_style
- Revisit onboarding question wording if it still feels off after a fresh look
- Crisis card: region-detection (currently hardcoded to Canada/988)
- Crisis: relational-safety/abuse category, own resource number, parked separately
- **Understanding spec** (see ATO_PLAN_v2.md → Understanding spec) — own future box (`intake`), sequenced after Stage 8 wraps
- **AI capacity hardening** — close the client-embedded-key bypass noted above before public launch (server-side proxy or equivalent), fold into public-readiness checklist rather than TestFlight
- Slack — parked as future ops tooling, bring up again if/when the app scales

## Housekeeping
- docs/ATO_PLAN_v2.md, docs/ME.md, docs/NOW.md, docs/BUSINESS.md — Cursor maintains these directly. Commit together, `git push` immediately, never left local-only.
- EXPO_PUBLIC_GEMINI_API_KEY set and live-verified. Model pinned to `gemini-3.7-flash`.
- **Open decision (emci's, not technical):** Apple Developer account type — Individual vs Organization. Revisit before public submission.
- Bundle ID `com.emgens.ato` (App ID) / `com.emgens.ato.signin` (Services ID) confirmed.
- Apple client_secret JWT minted Aug 25, 2026, expires Feb 24, 2027 07:24 UTC. Regenerate around late Jan 2027. Not automated.
- Email sending on `noreply@asstrollogs.com` (Resend-verified). `support@asstrollogs.com` used as the public contact address in legal/landing copy — needs confirmation as a real monitored inbox before it's live-facing.
- Landing page live at `ato.emgens.com` — social handle decided as `@whatsyourato` (primary), fallback `emgensato`/`atoapp`/`heyato` per-platform if taken. Not yet confirmed reserved on any platform.

## Next 15 min
Stage 8 item 6: EAS build → TestFlight submission. Before starting on device: confirm current EAS/Expo project config is still valid (`eas build:configure` check), and use the floor-requirements-sweep build to also verify the Sentry native crash path that's still outstanding.
