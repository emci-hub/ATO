# ME

**Name:** emci
**Twin:** Drake

## This week
Sage content model v2 is in. Read/Do labels unchanged (no ATOsophy/Sync). Generation stays per-user on the existing quota. Home in Quest uses `Sage · npc` on the card only; Talk/Dawn/widget/push and Home in the other four modes stay `Sage · coach`. Home-only Nudge from a real recent signal; empty when there isn't one. The 9 onboarding identity chips are now editable from the You tab / Settings. Stage 11 optional fast-entry is in (all 15 nullable 0–1 axes exist; direct sources sticky over inferred; `last_touched` on write; confirm-upgrade cannot change the number). Library copy is in (`src/app/copy/library.md`; six domain + four framework; Sage not wired). Sage has a collapsible 8-ball with an original glazed orb (shake on Ask again); reply room shows as `X of 20 today` (no "AI"/"tokens"); You-tab name is on the poster only; Settings crisis line is a collapsible above credits. Home Reads rotate signals instead of paraphrasing one story; Talk answers the typed question first, with the day's card as background only. Talk replies now share the framework-echo fence with cards (retry once, not a second quota charge; else honest empty). Delete-account hard-deletes ME and cascades owned rows; the audit row is the only intentional leftover. Bottom tab bar follows all five appearance modes (opaque themed chrome — same native-white family as the Sage zoom flash, plus a Soft-first hydration miss). Plan framing (Aug 28): ATO_PLAN_v2.md is a working reference, not a locked spec. Decided in that file, not built: Explore, three-path extra-axis intake, completeness indicator (9 complete / 15 depth), Dawn Reload. Six extra axes, source rank, `last_touched`, confirm-upgrade lock, Talk fence, and Library copy (domain + framework) shipped. Grok review locks (Explore combine, Does-Sage-know-you, fence phrases/quota, soft-ask budget) are in the Understanding spec. Next Wave 1.5 box: Stage 12 Sage coaching content. Night wall is unblocked for Wave 3 now that going exists.

Stage 8 still has three loose ends only: submit/confirm EAS binary 10 (OTA + real app icon) on a real device, re-check Sentry native symbolication once that's on-device, and wait on Apple's Beta App Review for the Friends TestFlight group. Everything else in Stage 8 is done.

**EAS Update (OTA) is live** as of binary 10 — future JS/UI/backend-only work ships via `eas update`, no more build+Apple-review cycles for most changes. Native-only exceptions remain: icon, widget, permissions, new native modules. Devices still on binary 8 or earlier need a TestFlight install of 10 before they can receive OTA.

**Binary 8** (`d40e57a9`) **was submitted and installed** — theme picker, Around, Home fix, and age field verified on-device. Native crash test landed as Sentry event `e7bed112`; stack symbolication is still **unconfirmed** from here (CI token cannot read event frames; no `com.emgens.ato@1.0.0+8` release). Re-check once binary 10 is on-device, or by opening `e7bed112` in the Sentry dashboard.

**Decision: Wave 1.5 and Wave 3 both start now, in parallel — deliberately not following the plan's original stage order.** Wave 2 Stage 2 ("I'm going") is now live, so Night wall is unblocked. Stage 9 first pass is in; identity chips are editable in Settings; Stage 11 optional fast-entry is in (all 15 axes; direct vs inferred; `last_touched`; confirm-upgrade cannot change the number); Talk output fence is in; Library copy is in (domain + framework; Sage not wired). Next Wave 1.5 box: Stage 12 (Sage coaching content). ATO_PLAN_v2.md is a working reference — Aug 28 design (Explore, three-path intake, Reload) and the Grok review locks are recorded there; extra axes + source rank + confirm-upgrade lock + Talk fence + Library copy have shipped.

## App
- **Category:** Hybrid — AI-native (Sage/router) + Social (Circle/Chat) + Health/finance/kids (crisis spec, coaching tone)
- **Landmine modules kept:** Social (report/block required) + Health/finance/kids (privacy pass, crisis static-card required, Grok critique before code on sensitive pieces)
- **A proof (APP.md w/ non-goals):** satisfied by ATO_PLAN_v2.md.
- **B proof (3 decisions):** satisfied — platform = iOS/Expo → TestFlight → Apple; data lives in Supabase (project `ato`); accounts = yes (email OTP via Resend + Sign in with Apple on device).
- **First 60 seconds:** open app → Home shows today's Check (read + if-then Do) with the live pixel fixed top-right, not a large centered face, plus a small all-time Checks chip.
- **Sage/Pixel relationship:** pixel is one character — current-you (plain, idle) on Home/Around/You, aspirational-you (growth glow/shine) on Sage. Same shell-mounted instance; glow is a Sage overlay, not a second pixel. Tap moods play on that instance. You-tab poster is identity + QR, no larger still.
- **Growth tiers (built, live):** dual-axis — presence (`me.check_count` → tier 0-3) and depth (`me.facts` → tier 0-2).
- **Floor requirements (done):** Sentry wired and JS-verified (native crash on build 6 expected unsymbolicated; binary 8 native crash event `e7bed112` ingested, symbolication **unconfirmed**; org `emgens`, project `ato-app`), App Store Connect privacy label answers drafted (11 types including Date of Birth; paste-in parked until public launch), `PrivacyInfo.xcprivacy` locked and verified 9/9, Sage labeled "coach" throughout the live UI except Home in Quest (`Sage · npc` on that card only), AI router rate-limited server-side (20/day, 200/month per user via Postgres `claim_ai_call()`). Self-reported `me.born_on` collected at onboarding; 16+ enforced at signup; 18+ going enforced in Around + `set_going`.

## Roster
- Assistant (Drake) — active
- Builder (Cursor) — active. Current model: Grok 4.6. Owns docs/ME.md, docs/NOW.md, docs/ATO_PLAN_v2.md, and docs/BUSINESS.md — updates committed **and pushed** together, never left local-only.

## Live AI + model
- Cursor: Grok 4.6 (current) — crisis/safety-critical work always routes to Claude Opus 5 (fixed lane) regardless of Home/Away
- App's own router: Gemini (`MODEL_PROVIDER=gemini`), pinned to `gemini-3.7-flash`, server-side rate-limited (20/day, 200/month per user)
