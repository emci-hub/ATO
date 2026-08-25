# ME

**Name:** emci
**Twin:** Drake

## This week
Ship ATO — Wave 1. Spec: docs/ATO_PLAN_v2.md. Stages 1–6 done and on-device verified. Side-quest work (Kenney pipeline, persistent header avatar, Sage identity, growth tiers, neon glow, several real navigation/realtime bugs) all closed and on-device confirmed. Opening Stage 7 (Chat + Report) next — the plan's own hard Apple submission blocker, not optional.

## App
- **Category:** Hybrid — AI-native (Sage/router) + Social (Circle/Chat) + Health/finance/kids (crisis spec, coaching tone)
- **Landmine modules kept:** Social (report/block required) + Health/finance/kids (privacy pass, crisis static-card required, Grok critique before code on sensitive pieces)
- **A proof (APP.md w/ non-goals):** satisfied by ATO_PLAN_v2.md — "Not Co-Star, not a feed, not therapy, not Great Sage, not Yelp," plus the full Dies-if list.
- **B proof (3 decisions):** satisfied — platform = iOS/Expo → TestFlight → Apple; data lives in Supabase (fresh project, `ato`, on a non-quota-maxed account); accounts = yes (email OTP via Resend custom SMTP now, Apple Sign-in added at Stage 8 before TestFlight).
- **First 60 seconds:** open app → Home shows yesterday's Check as a pixel face, one line in their talk_style (lift/even/cut), one finishable if-then Do. That's the whole loop.
- **Sage/Pixel relationship (defined, deviates from plan's original "Sage = voice, Pixel = body" framing):** the pixel is still one character — you — but now carries two readings depending on where it's shown. Home's pixel = current-you, exactly as the app understands you today (recipe, latest Check, current look). Sage's pixel = aspirational-you — the same character, marked with a subtle visual tell (glow/shine), representing "the version you're working toward," not a separate companion or coach character. Sage's actual voice/copy (reflect more than ask, coach not doctor) already leans this direction; worth a deliberate copy pass later to confirm `sage.txt` reads as "your own best voice" rather than "an outside coach," now that this is explicit rather than incidental.
- **Growth tiers (planned, not yet built)** — see NOW.md backlog for the mechanic. Sage's visual distinctness increases at milestone thresholds already tracked on ME (`check_count`), reusing the plan's existing 7-Check unlock point rather than inventing a new number. Deliberately kept separate from the daily `look` system (even/tired/set/listen/glow, driven by last-7-Checks valence) — growth tier is a slow, long-term signal; look is a fast, short-term one. Mixing them would blur two different kinds of feedback into one confusing signal.

## Roster
- Assistant (Drake) — active
- Builder (Cursor) — active, Stages 1–6 shipped and on-device verified, owns docs/ME.md and docs/NOW.md directly

## Live AI + model
- Cursor, `deepseek-v4-flash` (default volume, spec already written) — crisis/safety-critical work always routes to Claude Opus 5 (fixed lane), regardless of Home/Away
- App's own router: Gemini (`MODEL_PROVIDER=gemini`), live-verified, pinned to `gemini-3.7-flash` (not `-latest` — see NOW.md rationale)
