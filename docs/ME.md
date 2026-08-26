# ME

**Name:** emci
**Twin:** Drake

## This week
Ship ATO — Wave 1. Spec: docs/ATO_PLAN_v2.md. Stages 1–7 done and on-device verified. Stage 8 handoff #1 (**Apple Sign-In + delete-account/token revoke**) **DONE and verified on a real device** — `confirmRevoked()` returned true. Stage 8 handoff #2 (**invite/referral gate**) **DONE** — invite-only default, atomic consume, pause/delete_branch verified. Next: push notifications + widget. Understanding / Intake spec designed (plan packets list `intake`), parked as its own future box after Stage 8 wraps.

## App
- **Category:** Hybrid — AI-native (Sage/router) + Social (Circle/Chat) + Health/finance/kids (crisis spec, coaching tone)
- **Landmine modules kept:** Social (report/block required) + Health/finance/kids (privacy pass, crisis static-card required, Grok critique before code on sensitive pieces)
- **A proof (APP.md w/ non-goals):** satisfied by ATO_PLAN_v2.md — "Not Co-Star, not a feed, not therapy, not Great Sage, not Yelp," plus the full Dies-if list.
- **B proof (3 decisions):** satisfied — platform = iOS/Expo → TestFlight → Apple; data lives in Supabase (project `ato`); accounts = yes (email OTP via Resend + Sign in with Apple on device, App ID `com.emgens.ato` / Services ID `com.emgens.ato.signin`).
- **First 60 seconds:** open app → Home shows yesterday's Check as a pixel face, one line in their talk_style (lift/even/cut), one finishable if-then Do. That's the whole loop.
- **Sage/Pixel relationship (defined, deviates from plan's original "Sage = voice, Pixel = body" framing):** the pixel is still one character — you — but now carries two readings depending on where it's shown. Home's pixel = current-you; Sage's pixel = aspirational-you (same character, glow/shine tell).
- **Growth tiers (built, live):** dual-axis from real ME data — presence (`me.check_count` → tier 0-3) and depth (`me.facts` → tier 0-2).

## Roster
- Assistant (Drake) — active
- Builder (Cursor) — active, Stages 1–7 + Stage 8 Apple handoff + invite/referral gate shipped; owns docs/ME.md, docs/NOW.md, docs/ATO_PLAN_v2.md, and docs/BUSINESS.md. Updates to any of those four are committed **and pushed** together — never left local-only.

## Live AI + model
- Cursor, `deepseek-v4-flash` (default volume) — crisis/safety-critical work always routes to Claude Opus 5 (fixed lane), regardless of Home/Away
- App's own router: Gemini (`MODEL_PROVIDER=gemini`), live-verified, pinned to `gemini-3.7-flash` (not `-latest` — see NOW.md rationale)
