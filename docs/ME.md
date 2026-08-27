# ME

**Name:** emci
**Twin:** Drake

## This week
Ship ATO — Wave 1. Spec: docs/ATO_PLAN_v2.md. Stages 1–7 done and on-device verified. Stage 8: Apple Sign-In (done), invite/referral gate (done), push+widget (done), floor-requirements sweep (**done**, pushed `ea2b4f3`), legal+landing copy (drafted, mostly live; ASC paste / support inbox / lawyer pass parked until public launch is imminent), self-reported date of birth on ME (**done** in code, in EAS binary 8, ships to testers once that IPA is submitted), Kenney credits on You-tab Settings (**done** — Shape Characters only, the bundled pack), SecureStore 2048-byte warning (**done** — session cache in AsyncStorage, tokens in Keychain), font/spacing consistency pass (**done** — outliers folded into existing `ThemedText`/`Spacing`), crisis card region-detection (**done** — US/Canada 988 with localized labels, honest fallback for any other region, Settings override on You), five-mode appearance system (**done** — Soft/Zen/Quest/Neon/Anime, Ink/Paper/Steel/Bloom discarded), Home Stage 1 fixtures stripped (**done** — no fake poster/card/"open box" on the real Home route; floating header avatar gone), Wave 2 Stage 1 Around data layer (**done** — typed city, Edmtrain → `weekend.json`, honest empty; going/heatmap not in this box; first live Storage write waits on an Edmtrain client API key). **TestFlight build 6 shipped**, installed on a real device; Beta App Review for the Friends external testing group is **pending**. **EAS production binary 8** cut (`d40e57a9`, git `2a0732c`) — appearance / Around / age / Home fixture strip; not submitted to TestFlight yet. App icon swap still queued. Once those four Stage 8 floor-verification items close, **Stage 9 (intake core)** is next — Wave 1.5 (Stages 9–14, Understanding & Delight) is sequenced in ATO_PLAN_v2.md after the Wave 1 Gate, not blocked on public App Store readiness. AI capacity hardening stays a separate public-launch backlog item, not Wave 1.5.

## App
- **Category:** Hybrid — AI-native (Sage/router) + Social (Circle/Chat) + Health/finance/kids (crisis spec, coaching tone)
- **Landmine modules kept:** Social (report/block required) + Health/finance/kids (privacy pass, crisis static-card required, Grok critique before code on sensitive pieces)
- **A proof (APP.md w/ non-goals):** satisfied by ATO_PLAN_v2.md.
- **B proof (3 decisions):** satisfied — platform = iOS/Expo → TestFlight → Apple; data lives in Supabase (project `ato`); accounts = yes (email OTP via Resend + Sign in with Apple on device).
- **First 60 seconds:** open app → Home shows yesterday's Check as a pixel face, one line in their talk_style (lift/even/cut), one finishable if-then Do.
- **Sage/Pixel relationship:** pixel is one character — current-you on Home, aspirational-you (glow/shine) on Sage.
- **Growth tiers (built, live):** dual-axis — presence (`me.check_count` → tier 0-3) and depth (`me.facts` → tier 0-2).
- **Floor requirements (done):** Sentry wired and JS-verified (native crash on build 6 expected unsymbolicated; source-map confirmation waits on binary 8 on a device — org `emgens`, project `ato-app`), App Store Connect privacy label answers drafted (11 types including Date of Birth; paste-in parked until public launch), `PrivacyInfo.xcprivacy` locked and verified 9/9, Sage labeled "coach" throughout the live UI, AI router rate-limited server-side (20/day, 200/month per user via Postgres `claim_ai_call()`). Self-reported `me.born_on` collected at onboarding; 16+ enforced at signup; 18+ going helper ready for Wave 2 — in EAS binary 8, ships to testers once submitted.

## Roster
- Assistant (Drake) — active
- Builder (Cursor) — active. Current model: Grok 4.6. Owns docs/ME.md, docs/NOW.md, docs/ATO_PLAN_v2.md, and docs/BUSINESS.md — updates committed **and pushed** together, never left local-only.

## Live AI + model
- Cursor: Grok 4.6 (current) — crisis/safety-critical work always routes to Claude Opus 5 (fixed lane) regardless of Home/Away
- App's own router: Gemini (`MODEL_PROVIDER=gemini`), pinned to `gemini-3.7-flash`, server-side rate-limited (20/day, 200/month per user)
