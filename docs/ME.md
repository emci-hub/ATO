# ME

**Name:** emci
**Twin:** Drake

## This week
Ship ATO — Wave 1. Spec: docs/ATO_PLAN_v2.md. Stages 1–7 done and on-device verified. Stage 8: Apple Sign-In (done), invite/referral gate (done), push+widget (done), floor-requirements sweep (**done**, pushed `ea2b4f3`), legal+landing copy (drafted, mostly live, loose ends open — see NOW.md → Left). Next: EAS build → TestFlight submission.

## App
- **Category:** Hybrid — AI-native (Sage/router) + Social (Circle/Chat) + Health/finance/kids (crisis spec, coaching tone)
- **Landmine modules kept:** Social (report/block required) + Health/finance/kids (privacy pass, crisis static-card required, Grok critique before code on sensitive pieces)
- **A proof (APP.md w/ non-goals):** satisfied by ATO_PLAN_v2.md.
- **B proof (3 decisions):** satisfied — platform = iOS/Expo → TestFlight → Apple; data lives in Supabase (project `ato`); accounts = yes (email OTP via Resend + Sign in with Apple on device).
- **First 60 seconds:** open app → Home shows yesterday's Check as a pixel face, one line in their talk_style (lift/even/cut), one finishable if-then Do.
- **Sage/Pixel relationship:** pixel is one character — current-you on Home, aspirational-you (glow/shine) on Sage.
- **Growth tiers (built, live):** dual-axis — presence (`me.check_count` → tier 0-3) and depth (`me.facts` → tier 0-2).
- **Floor requirements (done):** Sentry wired and JS-verified (native crash pending next EAS build), App Store Connect privacy label answers drafted, `PrivacyInfo.xcprivacy` locked and verified 9/9, Sage labeled "coach" throughout the live UI, AI router rate-limited server-side (20/day, 200/month per user via Postgres `claim_ai_call()`).

## Roster
- Assistant (Drake) — active
- Builder (Cursor) — active. Current model: Grok 4.6. Owns docs/ME.md, docs/NOW.md, docs/ATO_PLAN_v2.md, and docs/BUSINESS.md — updates committed **and pushed** together, never left local-only.

## Live AI + model
- Cursor: Grok 4.6 (current) — crisis/safety-critical work always routes to Claude Opus 5 (fixed lane) regardless of Home/Away
- App's own router: Gemini (`MODEL_PROVIDER=gemini`), pinned to `gemini-3.7-flash`, server-side rate-limited (20/day, 200/month per user)
