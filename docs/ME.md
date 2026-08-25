# ME

**Name:** emci
**Twin:** Drake

## This week
Ship ATO — Wave 1. Spec: docs/ATO_PLAN_v2.md. Stages 1–7 done and on-device verified (Home shell, Sign-in/ME/Theme, Pixel, Dawn+Router, Talk, Share+Circle, Chat+Report). On Stage 8 (TestFlight sequence): Apple Sign-In + delete-account is **code complete** (DB side live-verified); next is an iOS EAS **development client** on a real device (`eas build --platform ios --profile development`) — Expo Go cannot run Sign in with Apple. Bundle ID confirmed `com.emgens.ato` / Services ID `com.emgens.ato.signin`.

## App
- **Category:** Hybrid — AI-native (Sage/router) + Social (Circle/Chat) + Health/finance/kids (crisis spec, coaching tone)
- **Landmine modules kept:** Social (report/block required) + Health/finance/kids (privacy pass, crisis static-card required, Grok critique before code on sensitive pieces)
- **A proof (APP.md w/ non-goals):** satisfied by ATO_PLAN_v2.md — "Not Co-Star, not a feed, not therapy, not Great Sage, not Yelp," plus the full Dies-if list.
- **B proof (3 decisions):** satisfied — platform = iOS/Expo → TestFlight → Apple; data lives in Supabase (fresh project, `ato`, on a non-quota-maxed account); accounts = yes (email OTP via Resend custom SMTP now, Apple Sign-in wired at Stage 8 — native button + delete/revoke — still needs the device build to close).
- **First 60 seconds:** open app → Home shows yesterday's Check as a pixel face, one line in their talk_style (lift/even/cut), one finishable if-then Do. That's the whole loop.
- **Sage/Pixel relationship (defined, deviates from plan's original "Sage = voice, Pixel = body" framing):** the pixel is still one character — you — but now carries two readings depending on where it's shown. Home's pixel = current-you, exactly as the app understands you today (recipe, latest Check, current look). Sage's pixel = aspirational-you — the same character, marked with a subtle visual tell (glow/shine), representing "the version you're working toward," not a separate companion or coach character. Sage's actual voice/copy (reflect more than ask, coach not doctor) already leans this direction; worth a deliberate copy pass later to confirm `sage.txt` reads as "your own best voice" rather than "an outside coach," now that this is explicit rather than incidental.
- **Growth tiers (built, live):** dual-axis, derived from real ME data — presence axis (`me.check_count` → tier 0-3, neon glow around the header avatar + web Sage icon) and depth axis (`me.facts` array, now populated for real by Chat's "Teach Sage this" → tier 0-2, small sharp white sparkle). Tiers only ever go up, never down. Milestone celebrations (bigger one-time animation) at 7/21 checks, tracked on `me.milestones_celebrated`. Deliberately kept separate from the daily `look` system (even/tired/set/listen/glow, driven by last-7-Checks valence) — growth tier is a slow, long-term signal; look is a fast, short-term one.

## Roster
- Assistant (Drake) — active
- Builder (Cursor) — active, Stages 1–7 shipped and on-device verified, owns docs/ME.md, docs/NOW.md, docs/ATO_PLAN_v2.md, and docs/BUSINESS.md directly. Updates to any of those four are committed **and pushed** together — never left local-only.

## Live AI + model
- Cursor, `deepseek-v4-flash` (default volume) — crisis/safety-critical work always routes to Claude Opus 5 (fixed lane), regardless of Home/Away
- App's own router: Gemini (`MODEL_PROVIDER=gemini`), live-verified, pinned to `gemini-3.7-flash` (not `-latest` — see NOW.md rationale)
