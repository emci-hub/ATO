# ME

**Name:** emci
**Twin:** Drake

## This week
Ship ATO — Wave 1. Spec: docs/ATO_PLAN_v2.md. Stages 1–7 done and on-device verified. Stage 8 handoffs #1–#4 fully done; floor requirements re-verified this session (Sentry live ingest, nutrition labels matched to privacy.md, PrivacyInfo locked, Sage labeled coach including Dawn/Teach Sage, Talk cap live 20/day 200/month). Next: landing polish if needed, then EAS → TestFlight.

## App
- **Category:** Hybrid — AI-native (Sage/router) + Social (Circle/Chat) + Health/finance/kids (crisis spec, coaching tone)
- **Landmine modules kept:** Social (report/block required) + Health/finance/kids (privacy pass, crisis static-card required, Grok critique before code on sensitive pieces)
- **A proof (APP.md w/ non-goals):** satisfied by ATO_PLAN_v2.md — "Not Co-Star, not a feed, not therapy, not Great Sage, not Yelp," plus the full Dies-if list.
- **B proof (3 decisions):** satisfied — platform = iOS/Expo → TestFlight → Apple; data lives in Supabase (project `ato`); accounts = yes (email OTP via Resend + Sign in with Apple on device, App ID `com.emgens.ato` / Services ID `com.emgens.ato.signin`).
- **First 60 seconds:** open app → Home shows yesterday's Check as a pixel face, one line in their talk_style (lift/even/cut), one finishable if-then Do. That's the whole loop.
- **Sage/Pixel relationship:** the pixel is one character — you — but carries two readings depending on where it's shown. Home's pixel = current-you; Sage's pixel = aspirational-you (same character, glow/shine tell). "Sage is a coach, not a person" is explicit in-copy across Sage-speaking surfaces (Talk title `Sage · coach`, Home card, Dawn lede, morning push, widget, consent cards, crisis card) plus Teach Sage — not just the privacy policy.
- **Growth tiers (built, live):** dual-axis from real ME data — presence (`me.check_count` → tier 0-3) and depth (`me.facts` → tier 0-2).
- **Access control (built, live):** `signup_mode` (invite_only/public) on `app_config`. Every ME row auto-issues 4 one-use invite codes on creation. `referred_by` hidden, never shown publicly. `pause_branch`/`unpause_branch`/`delete_branch` recursive moderation functions, queried directly via Supabase SQL editor — no admin UI, per plan discipline.
- **Push + widget (built, device-verified):** morning/evening/Sunday local pushes in phone timezone, no streak-pressure copy, permission asked once after `check_count >= 1`, decline leaves app fully usable. iOS widget shows Read + Do via App Group `group.com.emgens.ato`, honest empty state, updates live on new Dawn card. Widget is a separate native (SwiftUI/WidgetKit) surface — does not auto-inherit main-app UI restyles; left intentionally unsynced for now.
- **Floor requirements (built, re-verified):** Sentry JS+native SDK (You-tab test buttons + `npm run check:sentry`). DSN connected; JS test error ingested this session. Native crash lands after the next EAS build. App Privacy nutrition labels match `privacy.md` + `PrivacyInfo.xcprivacy` (`NSPrivacyTracking = false`, 10 types). Sage labeled coach on Talk/Home/Dawn/consent/crisis/morning push/widget/Teach Sage. Talk model calls rate-limited per user server-side (`claim_ai_call`, **live 20/day 200/month**).

## Roster
- Assistant (Drake) — active
- Builder (Cursor) — active, Stages 1–7 + Stage 8 handoffs #1–#4 shipped and verified (floor sweep re-verified this session); owns docs/ME.md, docs/NOW.md, docs/ATO_PLAN_v2.md, and docs/BUSINESS.md. Updates to any of those four are committed **and pushed** together — never left local-only.

## Live AI + model
- Cursor: `deepseek-v4-flash` default volume lane; Grok 4.6 confirmed reachable again as of handoff #4 (used as primary builder on that handoff at emci's request) — crisis/safety-critical work always routes to Claude Opus 5 (fixed lane), regardless of Home/Away
- App's own router: Gemini (`MODEL_PROVIDER=gemini`), live-verified, pinned to `gemini-3.7-flash` (not `-latest` — see NOW.md rationale). **Known gap:** the Gemini API key is currently client-embedded (`EXPO_PUBLIC_GEMINI_API_KEY`); server-side rate limiting protects the app's own flow but not against a patched client hitting Gemini directly. Parked in NOW.md backlog as future Edge-Function work, not a TestFlight blocker.
