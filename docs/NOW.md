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
5. Legal + landing copy — privacy.md/terms.md drafted in Claude, committed to `app/legal/` (`57abf5e`); landing page live at `ato.emgens.com`. Remaining public-launch items (ASC privacy-label paste, `support@asstrollogs.com` inbox, lawyer pass) are parked below — **do not start until public launch is imminent.**
6. ✅ **EAS build → TestFlight — done.** Build 6 shipped, installed on a real device. Beta App Review submitted for the Friends external testing group — **pending as of Aug 26, 2026.**

Once Stage 8's remaining four floor-verification items close (build 7: app icon swap, age-field rollout, Sentry source-map confirmation; plus Friends Beta App Review), **Stage 9 (intake core)** is next up. Wave 1.5 (Stages 9–14, Understanding & Delight) is sequenced in ATO_PLAN_v2.md after the Wave 1 Gate; not blocked on public App Store readiness. AI capacity hardening stays a separate public-launch backlog item, not Wave 1.5.

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
  - **Sentry** (`e5c5a0f`) — already wired (init/wrap, native crash handling, You-tab test buttons). Added `npm run check:sentry`, plugin project set to `ato-app`. Verified: live JS error ingested, event id `600436b1001945eca54f84c5e67a6df7`. Native crash on TestFlight build 6 is expected **unsymbolicated** (upload was disabled for that binary). **EAS production source-map auto-upload is now on:** `SENTRY_AUTH_TOKEN` (sensitive), `SENTRY_DISABLE_AUTO_UPLOAD=false`, `SENTRY_ORG=emgens`, `SENTRY_PROJECT=ato-app`. Confirm maps on **build 7** (not yet cut).
  - **Privacy labels** (`22b242b`) — `src/app/legal/app-privacy-labels.md`, the App Store Connect paste sheet, aligned with `privacy.md`. Originally ten data types; **Date of Birth added** with the Stage 2 age field (now 11 types, still no tracking). Names Supabase, Gemini, Resend, Apple, Sentry. Push token intentionally not declared (v1 has none). Answers are ready to paste into App Store Connect — **not yet submitted there.**
  - **PrivacyInfo.xcprivacy** (`211e101`) — app + widget manifests already matched actual collection/required-reason APIs; locked types + API reasons into `floor-check`. Verified: `npx tsx ./scripts/floor-check.ts` 9/9 (Date of Birth added later with the age field; assertion count unchanged).
  - **Coach labeling** (`668424e`) — fixed gaps (Dawn lede, Talk title, composer placeholder, Teach Sage copy) so the UI itself, not just policy docs, labels Sage as a coach. Verified: floor-check coach assertions pass, no "Sage listens" language remains.
  - **Rate limiting** (`0f30625`) — live cap on project `ato`: **20 model calls/UTC day, 200/UTC month** (`app_config.ai_daily_cap`/`ai_monthly_cap`). Enforced via Postgres `claim_ai_call()` (SECURITY DEFINER, advisory lock), called from Talk UI before `generateTalk`. Deny copy: "Sage's out of things to say for today, back tomorrow." Daily-card generation intentionally not claimed (remounting Dawn would burn the cap). Verified: live SQL caps 20/200; `quota-check` 5/5; `voice-router-check` 24/24.
- Legal + landing copy drafted directly in Claude: `app/legal/privacy.md`, `app/legal/terms.md` (committed `57abf5e`), landing page live at `ato.emgens.com` (Vercel project `ato`, team `em-gens`, not yet linked to a git repo)
- `docs/BUSINESS.md` updated with finalized social handle decision (`@whatsyourato`, committed `57abf5e`)
- **Self-reported date of birth (Stage 2 ME box)** — `me.born_on` date, not a frozen age or 16+/18+ boolean. Onboarding Q1 is YYYY/MM/DD (same input pattern as the other text fields). Under 16: inline error "ATO is for people 16 and older." — blocked client-side before `createMe` and server-side in `complete_signup` before invite consume. 16/17 allowed; `is_at_least_age(born_on, 18)` stays false for Wave 2 going. Verified: `npm run check:age` 8/8; live under-16 RPC raises `age_under_16` with no ME row and invite unused; live 17-year-old stored `born_on = 2009-08-26`, `age_years = 17`, going helper false. Existing pre-field rows (`emci`, `yeezy`) stay NULL.
- **Kenney credits on You-tab Settings** — static Credits card lists only packs in `KENNEY_REGISTRY` (Shape Characters). Kenney, kenney.nl, pack page, CC0 line. Modular / Toon / 1-Bit / Animal Remastered / Fantasy UI Borders / Monster Builder are not bundled and are not listed.
- **Crisis card region-detection** — auto from device locale/timezone at launch (`expo-localization`), stored locally. Settings picker on You (Auto / United States / Canada / Other region). US → `988 Suicide & Crisis Lifeline`, Canada → `988 Suicide Crisis Helpline` (call or text 988). Any other region → honest fallback, no guessed number. Verified: `npm run check:crisis-region`.
- **SecureStore 2048-byte warning** — cause was the full Supabase session JSON written to Keychain under `sb-aijzsmupaaaxjctfgwpl-auth-token` (~2364 bytes for an Apple session; email-only was ~1898 and under the ceiling). Access JWT ~782–1199 bytes, refresh token 12 bytes — both fit. Adapter now keeps tokens in SecureStore (`ato.auth.access_token` / `ato.auth.refresh_token`) and the rest of the session in AsyncStorage; leftover oversized Keychain items migrate on next read. Verified: `npm run check:auth-storage` 6/6. Native Metro sign-in not reproduced here (Windows host, SecureStore is iOS/Android only).
- **Font/spacing consistency pass** — no new theme file; used existing `Spacing` + `ThemedText` types. Circle names 17→18 (match You), Unfriend 13→14 (`smallBold`), Sign out 16→14 (`smallBold` like other full-width buttons), inline errors `small`+600 → `smallBold`, Circle lede dropped cramped lineHeight 18 (match Home/Sage default), Sage message list bottom inset aligned to other tabs (`BottomTabInset + Spacing.four`).
- **Five-mode appearance system** — Soft (default) / Zen / Quest / Neon / Anime. Replaces Ink/Paper/Steel/Bloom entirely. Picker on You, stored locally. Verified: `npm run check:appearance`.
- **Wave 2 Stage 1 (Around data layer)** — typed `me.city` (not GPS), Around tab, static `around/{city}/weekend.json` from Edmtrain via `refresh-around`. No going / colors / heat map. Verified: `npm run check:around`. Calgary is a live Edmtrain city (`edmtrain.com/calgary-ab`); this weekend's public listing includes RIOT (Sat Aug 29, Palace Theatre). Storage write + cron wait on `EDMTRAIN_CLIENT_KEY` (apply at edmtrain.com/developer-api while signed in). Until that job runs, a missing file 404s into "nothing this weekend" — not fake shows.
- **Home Stage 1 fixtures stripped** — fake poster / Fake Person / "open box" were hardcoded on the real Home route for every signed-in user (not an empty-data fallback). Removed. No card → "No card yet" / Open Dawn. Floating header avatar removed (not a tap target); pixel stays on the Home face and the You poster. Verified: `npm run check:floor`.
- **Stage 8 handoff #6 (EAS → TestFlight)** — build 6 shipped and installed on a real device. Beta App Review submitted for the Friends external testing group (pending as of Aug 26, 2026).

## Left
- **Queued for EAS build 7** (not yet cut):
  - App icon swap — real icon, not the Expo default
  - Age-field rollout — `me.born_on` is in code/onboarding; this binary is what ships it to TestFlight testers (build 6 predates that)
  - Sentry source-map upload confirmation — auto-upload is on for production; build 6 was cut with upload disabled so that binary stays unsymbolicated. Confirm maps (and a native event) in `ato-app` after build 7
- Friends external testing group: Beta App Review for build 6 is **pending** — no action until Apple responds
- **Wave 2 leftover (not TestFlight):** apply for an Edmtrain client API key (signed-in at edmtrain.com/developer-api), set Edge Function secrets `EDMTRAIN_CLIENT_KEY` + `AROUND_REFRESH_SECRET`, POST `refresh-around` once, then schedule twice-daily cron. Phone never holds the Edmtrain key.
- **Known, accepted, non-blocking for TestFlight:** a patched client could skip `claim_ai_call()` and call Gemini directly using the client-embedded key. Public-launch item, not a TestFlight blocker — added to backlog below.

## Public release readiness — do not start until public launch is imminent
These are real, but they are not TestFlight work and they are not next. Leave them parked.
- App Store Connect privacy labels: answers ready in `app-privacy-labels.md` (11 types including Date of Birth), not yet pasted into App Store Connect itself
- `support@asstrollogs.com` — used across privacy.md/terms.md/landing footer as the contact address; **not yet confirmed as a real, monitored inbox**
- Terms §13 (governing law/dispute resolution) and the crisis disclaimer both still need a lawyer's pass

## Backlog (Stage 8 polish — not blocking the Friends TestFlight group)
- Fantasy UI Borders pack (Kenney) — UI chrome/panels/buttons
- Monster Builder Pack — parked, needs eyes/mouth slots added to recipe before usable
- Make show_up / knocks_you_off / morning_cue editable in Settings, not just talk_style
- Revisit onboarding question wording if it still feels off after a fresh look
- Crisis: relational-safety/abuse category, own resource number, parked separately
- **Wave 1.5 (Stages 9–14)** — sequenced in ATO_PLAN_v2.md after the Wave 1 Gate. Stage 9 (intake core) is next up once Stage 8's four floor-verification items close. Spec detail stays in Understanding spec; this is sequencing only.
- **AI capacity hardening** — close the client-embedded-key bypass noted above before public launch (server-side proxy or equivalent), fold into public-readiness checklist rather than TestFlight
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
- **Around refresh secrets (Wave 2):** Edge Function `refresh-around` is deployed (`verify_jwt: false`; auth is `AROUND_REFRESH_SECRET`). Needs `EDMTRAIN_CLIENT_KEY` (apply at edmtrain.com/developer-api while signed in) and `AROUND_REFRESH_SECRET`. Cron is not scheduled until both exist in Vault + function secrets. Phone never holds the Edmtrain key. ToS: displayed cache < 24h; unmodified event `link`; do not mix Edmtrain listings with another events feed (RA/Shotgun/DICE are ticket link-outs only).

## Next 15 min
Waiting on Apple: Beta App Review for the Friends external testing group (build 6). Do not start public-release items. Next binary is **build 7** (not yet cut): app icon swap, age-field rollout, confirm Sentry source maps landed. Once those four Stage 8 floor-verification items close, **Stage 9 (intake core)** is next.
