# ME

**Name:** emci
**Twin:** Drake

## This week
Ship ATO — Wave 1. Spec: docs/ATO_PLAN_v2.md. Stages 1–5 done (Home shell, Sign-in/ME/Theme, Pixel, Dawn+Router, Talk+crisis — live classifier confirmed). On Stage 6.

## App
- **Category:** Hybrid — AI-native (Sage/router) + Social (Circle/Chat) + Health/finance/kids (crisis spec, coaching tone)
- **Landmine modules kept:** Social (report/block required) + Health/finance/kids (privacy pass, crisis static-card required, Grok critique before code on sensitive pieces)
- **A proof (APP.md w/ non-goals):** satisfied by ATO_PLAN_v2.md — "Not Co-Star, not a feed, not therapy, not Great Sage, not Yelp," plus the full Dies-if list.
- **B proof (3 decisions):** satisfied — platform = iOS/Expo → TestFlight → Apple; data lives in Supabase (fresh project, `ato`, on a non-quota-maxed account); accounts = yes (email OTP via Resend custom SMTP now, Apple Sign-in added at Stage 8 before TestFlight).
- **First 60 seconds:** open app → Home shows yesterday's Check as a pixel face, one line in their talk_style (lift/even/cut), one finishable if-then Do. That's the whole loop.

## Roster
- Assistant (Drake) — active
- Builder (Cursor) — active, Stages 1–5 shipped, now owns docs/ME.md and docs/NOW.md directly

## Live AI + model
- Cursor: `deepseek-v4-flash` (Home, volume) / `deepseek-v4-pro` (Home, hard volume) / Cursor Grok 4.6 (second opinion, both lanes) / Claude Opus 5 (flagship, safety-critical, fixed lane both lanes). Away (no Deepseek): GPT-5.6 Sol/Terra (volume equivalent) / Gemini 3.7 Flash (long/visual). Auto never used.
- App's own router: Gemini `gemini-3.7-flash` (`MODEL_PROVIDER=gemini`) — live, confirmed working with a real key. Pinned explicit version, not a `-latest` alias.
