# ME

**Name:** emci
**Twin:** Drake

## This week
Ship ATO — Wave 1. Spec: docs/ATO_PLAN_v2.md. Stages 1–7 done and on-device verified. Stage 8 handoff #1 (**Apple Sign-In + delete-account/token revoke**) DONE and verified on a real device. Stage 8 handoff #2 (**Invite/referral gate**) DONE — 7/7 automated checks passed, tree-pause test verified. Stage 8 handoff #3 (**Push notifications + widget**) **DONE — device-verified.** 11/11 JS checks, plus real-device confirmation: permission prompt fires once after first Check, all three deep links correct (Morning→Home, Evening→Home w/ check focus, Sunday→This week), widget renders Read+Do live and matches the current Dawn card (confirmed at Day 4, correctly on `source: generated`/Gemini once check_count crossed 3). One EAS credentials/target-naming bug hit and fixed along the way (widget Xcode target collided with main app target — renamed to `ATOWidget`), plus one asset-catalog icon-inheritance bug fixed. You tab always shows **Test notifications** (Timezone → Morning / Evening / Sunday → Invite codes); a decline is not nagged. Widget UI is native (WidgetKit/SwiftUI) and does not inherit style changes from the main app automatically — deliberately left unsynced for now, revisit once Home's styling settles. Next: floor-requirements sweep (Stage 8 handoff #4). Understanding / Intake spec designed (plan packets list `intake`), still parked as its own future box after Stage 8 wraps.

## App
- **Category:** Hybrid — AI-native (Sage/router) + Social (Circle/Chat) + Health/finance/kids (crisis spec, coaching tone)
- **Landmine modules kept:** Social (report/block required) + Health/finance/kids (privacy pass, crisis static-card required, Grok critique before code on sensitive pieces)
- **A proof (APP.md w/ non-goals):** satisfied by ATO_PLAN_v2.md — "Not Co-Star, not a feed, not therapy, not Great Sage, not Yelp," plus the full Dies-if list.
- **B proof (3 decisions):** satisfied — platform = iOS/Expo → TestFlight → Apple; data lives in Supabase (project `ato`); accounts = yes (email OTP via Resend + Sign in with Apple on device, App ID `com.emgens.ato` / Services ID `com.emgens.ato.signin`).
- **First 60 seconds:** open app → Home shows yesterday's Check as a pixel face, one line in their talk_style (lift/even/cut), one finishable if-then Do. That's the whole loop.
- **Sage/Pixel relationship (defined, deviates from plan's original "Sage = voice, Pixel = body" framing):** the pixel is still one character — you — but now carries two readings depending on where it's shown. Home's pixel = current-you; Sage's pixel = aspirational-you (same character, glow/shine tell).
- **Growth tiers (built, live):** dual-axis from real ME data — presence (`me.check_count` → tier 0-3) and depth (`me.facts` → tier 0-2).
- **Access control (built, live):** `signup_mode` (invite_only/public) on `app_config`. Every ME row auto-issues 4 one-use invite codes on creation. `referred_by` hidden, never shown publicly. `pause_branch`/`unpause_branch`/`delete_branch` recursive moderation functions, queried directly via Supabase SQL editor — no admin UI, per plan discipline.
- **Push + widget (built, device-verified):** morning/evening/Sunday local pushes in phone timezone, no streak-pressure copy, permission asked once after `check_count >= 1`, decline leaves app fully usable. iOS widget shows Read + Do via App Group `group.com.emgens.ato`, honest empty state, updates live on new Dawn card. Widget is a separate native (SwiftUI/WidgetKit) surface — does not auto-inherit main-app UI restyles; left intentionally unsynced for now.

## Roster
- Assistant (Drake) — active
- Builder (Cursor) — active, Stages 1–7 + Stage 8 Apple handoff + Stage 8 invite/referral handoff + Stage 8 push/widget shipped and verified; owns docs/ME.md, docs/NOW.md, docs/ATO_PLAN_v2.md, and docs/BUSINESS.md. Updates to any of those four are committed **and pushed** together — never left local-only.

## Live AI + model
- Cursor, `Cursor Grok 4.6 High` (this session's active pick) — crisis/safety-critical work always routes to Claude Opus 5 (fixed lane), regardless of Home/Away. deepseek-v4-pro currently disabled to conserve remaining $10 balance; only reactivate for genuinely gnarly work.
- App's own router: Gemini (`MODEL_PROVIDER=gemini`), live-verified, pinned to `gemini-3.7-flash` (not `-latest` — see NOW.md rationale)
