# ME

**Name:** emci
**Twin:** Drake

## This week
Wave 2 Stage 2 shipped — "I'm going" + friend colors (≥3 of a hue, no raw counts, 18+ gate, faces honor `me.visible`). Type `fixture` as city for seeded test shows; Calgary stays honest-empty until Edmtrain. Stage 9 first pass is in (9 chip questions + Day 1 bank wiring). Next Wave 1.5 box: Stage 11 optional fast-entry. Night wall is unblocked for Wave 3 now that going exists.

Stage 8 still has three loose ends only: submit/confirm EAS binary 10 (OTA + real app icon) on a real device, re-check Sentry native symbolication once that's on-device, and wait on Apple's Beta App Review for the Friends TestFlight group. Everything else in Stage 8 is done.

**EAS Update (OTA) is live** as of binary 10 — future JS/UI/backend-only work ships via `eas update`, no more build+Apple-review cycles for most changes. Native-only exceptions remain: icon, widget, permissions, new native modules. Devices still on binary 8 or earlier need a TestFlight install of 10 before they can receive OTA.

**Binary 8** (`d40e57a9`) **was submitted and installed** — theme picker, Around, Home fix, and age field verified on-device. Native crash test landed as Sentry event `e7bed112`; stack symbolication is still **unconfirmed** from here (CI token cannot read event frames; no `com.emgens.ato@1.0.0+8` release). Re-check once binary 10 is on-device, or by opening `e7bed112` in the Sentry dashboard.

**Decision: Wave 1.5 and Wave 3 both start now, in parallel — deliberately not following the plan's original stage order.** Wave 2 Stage 2 ("I'm going") is now live, so Night wall is unblocked. Stage 9 first pass is in; next Wave 1.5 box: Stage 11 (optional fast-entry).

## App
- **Category:** Hybrid — AI-native (Sage/router) + Social (Circle/Chat) + Health/finance/kids (crisis spec, coaching tone)
- **Landmine modules kept:** Social (report/block required) + Health/finance/kids (privacy pass, crisis static-card required, Grok critique before code on sensitive pieces)
- **A proof (APP.md w/ non-goals):** satisfied by ATO_PLAN_v2.md.
- **B proof (3 decisions):** satisfied — platform = iOS/Expo → TestFlight → Apple; data lives in Supabase (project `ato`); accounts = yes (email OTP via Resend + Sign in with Apple on device).
- **First 60 seconds:** open app → Home shows yesterday's Check as a pixel face, one line in their talk_style (lift/even/cut), one finishable if-then Do.
- **Sage/Pixel relationship:** pixel is one character — current-you on Home, aspirational-you (glow/shine) on Sage.
- **Growth tiers (built, live):** dual-axis — presence (`me.check_count` → tier 0-3) and depth (`me.facts` → tier 0-2).
- **Floor requirements (done):** Sentry wired and JS-verified (native crash on build 6 expected unsymbolicated; binary 8 native crash event `e7bed112` ingested, symbolication **unconfirmed**; org `emgens`, project `ato-app`), App Store Connect privacy label answers drafted (11 types including Date of Birth; paste-in parked until public launch), `PrivacyInfo.xcprivacy` locked and verified 9/9, Sage labeled "coach" throughout the live UI, AI router rate-limited server-side (20/day, 200/month per user via Postgres `claim_ai_call()`). Self-reported `me.born_on` collected at onboarding; 16+ enforced at signup; 18+ going enforced in Around + `set_going`.

## Roster
- Assistant (Drake) — active
- Builder (Cursor) — active. Current model: Grok 4.6. Owns docs/ME.md, docs/NOW.md, docs/ATO_PLAN_v2.md, and docs/BUSINESS.md — updates committed **and pushed** together, never left local-only.

## Live AI + model
- Cursor: Grok 4.6 (current) — crisis/safety-critical work always routes to Claude Opus 5 (fixed lane) regardless of Home/Away
- App's own router: Gemini (`MODEL_PROVIDER=gemini`), pinned to `gemini-3.7-flash`, server-side rate-limited (20/day, 200/month per user)
