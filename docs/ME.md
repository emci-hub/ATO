# ME

**Name:** emci
**Twin:** Drake

## This week
Ship ATO — Wave 1. Spec: docs/ATO_PLAN_v2.md. Stages 1–4 done (Home shell, Sign-in/ME/Theme, Pixel, Dawn+Router). On Stage 5 (Talk + crisis spec).

## App
- **Category:** Hybrid — AI-native (Sage/router) + Social (Circle/Chat) + Health/finance/kids (crisis spec, coaching tone)
- **Landmine modules kept:** Social (report/block required) + Health/finance/kids (privacy pass, crisis static-card required, Grok critique before code on sensitive pieces)
- **A proof (APP.md w/ non-goals):** satisfied by ATO_PLAN_v2.md — "Not Co-Star, not a feed, not therapy, not Great Sage, not Yelp," plus the full Dies-if list.
- **B proof (3 decisions):** satisfied — platform = iOS/Expo → TestFlight → Apple; data lives in Supabase (fresh project, `ato`, on a non-quota-maxed account); accounts = yes (email OTP via Resend custom SMTP now, Apple Sign-in added at Stage 8 before TestFlight).
- **First 60 seconds:** open app → Home shows yesterday's Check as a pixel face, one line in their talk_style (lift/even/cut), one finishable if-then Do. That's the whole loop.

## Roster
- Assistant (Drake) — active
- Builder (Cursor) — active, Stages 1–4 shipped, now owns docs/ME.md and docs/NOW.md directly

## Live AI + model
- Cursor, `deepseek-v4-flash` (volume, spec already written)
- App's own router: Gemini (`MODEL_PROVIDER=gemini`), local-provider fallback until a real API key is set
