# NOW

**Category:** Hybrid — AI-native + Social + Health/finance/kids
**Gates:** A ✓ (non-goals in ATO_PLAN_v2.md) · B ✓ (iOS/Expo, Supabase, Apple Sign-in+email) · C in progress · D not started
**Modules on:** report/block (Social), crisis static-card + privacy pass (Health/finance/kids) — both required, in progress
**Live AI + model:** Cursor, Grok 4.6 (current), Expo SDK 54
**Latest production OTA:** `af9b56ee-6022-4421-a1b4-d3b781ce149b` (commit `3c0aae7`) — Explore is a real bottom tab; Sage tab is clean chat

## On
**Test-account wipe for clean retest (Aug 31, 2026).** All test accounts (riley, sam, yeezy, zintake9, lazyemci) hard-deleted via `auth.users` cascade (checks, trait_history, trait_tracks, token_events, ai_usage, going, sage_messages, explore_*, question_*, connections, messages, blocks, mutes, reports, invite_codes, apple_credentials all cascade; `account_deletions` audit rows written for each). Only **emci2** (`lil_emci@hotmail.com`, Apple) remains. **EMCIRETEST** is owned by emci2, unlimited (`max_uses NULL`), verified usable. **Known gap:** handle is `emci2`, not `emci`, so dev-root RPCs keyed on `handle='emci'` don't recognize it.

**"Dev only." on cold start = stale binary 8, not a live gate (confirmed).** Testers on binary 8 see a blank screen with "Dev only." — that is the **embedded bundle from before commits `2fdc278` + `5f1c86b` (Aug 28)** which (a) moved all `*-lab` screens out of the cold-start position behind `<Stack.Protected guard={__DEV__}>` and (b) replaced the `Dev only.` block in each lab with `<Redirect href="/" />`. The string no longer exists anywhere in `src` or the bundles. **Binary 8 cannot receive OTA** (no `expo-updates`). **Binary 10 is already submitted and processing in TestFlight** (build `1d0d1041`, submission `c0c6342d`, ASC app id `6805614731`, finished Aug 27) — the fix for all testers is **install binary 10**; the current production OTA `af9b56ee` then applies automatically.

**Wave 22 — Dawn categories, Explore combine, Levity, The Story (Aug 31, 2026).** Dawn Read may draw from one settled category among Steadiness / Agency / Drive; new users with none of those three settled keep knock/fact/focus exactly; Do if-then is untouched; anti-repeat and cut/crisis gates still run on the generated card. Explore may generate from any live category, at most two per entry and only when a recent signal ties them, and must not restate the pinned Categories card on the same screen. Agency-triple (GM+LC+SE) and the output fence are unchanged. 9th category **Levity** is a bar (Playfulness + conflict assertiveness + cooperativeness) — Love/closeness stays the only conflict-adjacent map. **The Story** is a separate longer-form Gemini call on its own quota (`claim_story_generate`), fingerprint-gated, thin-profile gated, no offline fallback, on the **Explore tab**. **All new copy is unreviewed. The Story is diagnosis-adjacent — same bar as the Crisis spec. Not shippable without emci's direct read.**

**Explore is its own tab (Sep 1, 2026).** The Sage tab is now clean chat only — 8-ball + conversation, nothing else. **Explore is a real bottom tab** (Home / Sage / Explore / Around / Circle / You), opened directly — no "Explore ›" button in Sage. The Explore tab holds: Categories at full detail (`CategoriesFold` — bars/maps, concept explainers, weekly spotlight), The Story, the Sage title card, Notes insight spend, and the Explore observation bubbles with "Did this land?" reactions. "N of 16 settled" lives on the Explore tab header (no longer on Sage). **The tab bar is a fixed `NativeTabs` list — there is no reorder / "More" tab / nav customization in the code (Home and Sage are the first two and are never hideable; the rest are static too).**

**Shared friend-voice style checklist is live (OTA `9855305a`, commit `96f61b8`).** All five generation surfaces (Dawn Read, Explore, Title, Category summaries, The Story) inject one shared `STYLE_BLOCK` from `src/lib/voice/style-checklist.ts`: six rules (never "you are"; never describe itself; one idea at a time when possible — Rule 3 acknowledges Rule 6's title/category exception; leave room for change, prefer lately/this week/for now; sound like a friend; Rule 6 — when more than one quality shares a sentence, join with but/yet/and, never a comma list) plus emci-approved few-shot anchors and bad→good join examples. Also fixes the stale `check:traits` assertion.

**Wave 21 — Playfulness, categories, Home 2-slot, Circle share (Aug 31, 2026).** 16th axis `playfulness` (IQ / ranking / gut-call / Depth / EWMA, same as the other extra axes). Categories read **report-track only** (never `self_game`). Bars after the existing stability floor; maps require **both** axes independently stable. Combined title+category Gemini on the existing title quota (not Talk). Pinned Categories summary on Explore + Categories fold on You + concept "?" explainers (**unreviewed**). Home category teaser is a **deliberate, dated reversal** of the Box 8 one-slot rule — teaser never sits next to crisis or missed-check. Weekly category spotlight. Full-picture capstone badge when all live categories are ready. Circle category compare is dual-opt-in (per-friend or Close Friends pool) and fully separate from Full Profile. Crisis card, widget, and Check are untouched. No paywall.

**IA reorganization is in (15 boxes, Aug 30, 2026).** Home is card + Did/Skip + a primary slot, plus a **deliberate second collapsed category teaser (Aug 31 override of the original one-slot Box 8 rule)** when that slot is not crisis or missed-check. One weekly Ask (Does-Sage-know-you / ranking / Gut call) shares the primary slot. Questions live on "Tell Sage more" off You. Explore is a real bottom tab (axis grounding in `buildExplorePrompt`; pulled out of the Sage thread Sep 1). You holds tone, badges, growth, Weeks, support (region picker only), trait bands, Full Profile, Categories, Account. AI consent is a Dawn/Sage interstitial. Consent-off past day 3 is honest-empty Today; Did/Skip still saves (`record_check` `p_no_card`) and counts toward `check_count`. **Full device pass is the gate before Stage 8 handoff #2 (invite/referral).**

**Sage Support tap is in.** A low-key lifebuoy + "Support" under the Sage composer (and at the bottom when Talk is off) opens the same static crisis card as the keyword interrupt — no message required. Keyword path, card copy, numbers, region logic, and "I'm okay, keep going" are unchanged. Sage is a permanent tab (not hideable; only Circle hides). You's "If you need someone now" fold is the **region picker only**.

**Axis counts are live.** Sage thin-profile coaching, Talk/insight depth copy, divergence, and Full Profile completeness all read `TRAIT_AXES.length` — thin is `settled / TRAIT_AXES.length < 6/15` (currently 16 axes, so fewer than 7 effective settled = thin). Adding a 17th axis updates those automatically. Explore still never combines `growth_mindset` + `locus_of_control` + `self_efficacy` in one entry.

**Nav bar is fixed.** Tabs are Home / Sage / Explore / Around / Circle (appears only after a connection) / You. **There is no reorder, "More" tab, or nav customization** — the tab bar is a static `NativeTabs` list. Home and Sage are the first two and are never hideable; the others are static too.

**Circle Explore is in.** Circle appears only after a QR scan / link paste connects two accounts. Per-friend category share (`category_share`) and Close Friends pool (`close_friends_share`, default off) are both opt-in; `peer_category_pack` returns cached title+category summaries only, never Full Profile. Both sides must opt in before either sees the other's cards.

**Does Sage know you? is in (Stage 13, part 2).** One kind of the weekly Home Ask (never inside Talk replies, no duplicate Sage/You card). Banked high/low paraphrase lines only — no Gemini call, no quota. Buttons are "Still fits" / "Not quite". Still fits is `confirmTraitSource` (source upgrade, number unchanged). Not quite is a single-axis Settings write (`self_settings`). Eligible axes are non-null, past a 14-day cooldown, not mid-band, not on the cruel-pole list, and not the last axis shown. Round-robin through that pool. At most one per week; yields while any axis is still null; dismiss ends the week. Two consecutive Still fits graduates it until the 3-month Settings re-ask (not built). `me.sage_knows` stores cursor, week slot, streaks, and graduation.

**Sage content model v2 is in.** Read/Do labels unchanged (no ATOsophy/Sync). Cards stay per-user on the existing quota (20/day, 200/month). Reload (cycle stored same-truth variants) is decided in ATO_PLAN_v2.md, not built. Home in Quest uses `Sage · npc` on the card only; elsewhere `Sage · coach`. Home can show a third daily category, **Nudge** (internal zGlitch): encouragement from a real recent signal only. Never Circle, widget, or morning push. `checks_select_connected` is dropped; `peer_checks` returns day / status / Read / Do only.

**Home milestone badges are in (Stage 13, part 1).** On You: a collapsible milestone strip — 7 Checks, first fact taught to Sage, and a full week without a cut, plus the full-picture capstone (all categories ready). Pure reads of already-logged data. Glow only when true. Honest-empty Checks count toward presence.

**Home ranking is in (Stage 13, part 4).** Optional-depth forced ranking as one kind of the weekly Home Ask: drag 4–5 plain behavioral lines, most-you at the top, one trait axis per round. Writes `self_tap` (direct, sticky merge). Yields if Does-Sage-know-you or a completeness claim already has that week's slot; extra-axis gaps go to the scenario swipe-deck.

**Scenario swipe-deck is in (Stage 13, part 5).** Gut call as one kind of the weekly Home Ask. Six extra axes, one card each, two forced choices. Writes `self_game` (inferred; cannot overwrite a direct answer). Same weekly slot as ranking and Does-Sage-know-you.

**Home reveal is in (Stage 13, part 3).** Daily tap-to-open on Home. Pool is a fresh angle on this week's actual Read/Do pattern, a stored fact reflected back, or badge-proximity. One short unfold (300ms), one short haptic, Reduce Motion skips to the copy. Empty days show a plain calm line with no sealed object.

**Check window + weekly recap cap are in.** A Check is for a calendar day in the user's timezone. Today or up to 2 days back; days 3+ permanently closed. `record_check` is the only write path. Read + Do + Nudge text kept for the rolling 7 calendar days; older text nulled, did/skip stays forever. Sunday recap counts the previous Sun–Sat. `this_week` on ME was never implemented — recap reads the checks table.

**Build line is in.** You Settings and `/dev-lab` show what this phone is actually running: EAS update group id, short `expo-updates` UUID, or `embedded` / `local`. Tap copies the full id.

**Pixel placement + tap moods shipped.** One small fixed top-right nav companion on all tabs (current-you on Home/Around/You, aspirational-you on Sage); tap plays a short coherent mood; crisis hard-disables hands. Shape is one of 6 hashed recipes per account; color from `show_up`.

**UI polish pass is in.** Poster redesigned on Ink / Paper / Steel / Bloom (shareable artifact only; app chrome stays Soft / Zen / Quest / Neon / Anime). Crisis "I'm okay, keep going" has a 2px accent border. Soft-mode outline buttons share `controlBorderColor`. Sage pinch-zoom disabled on tab ScrollViews; tab chrome + SystemUI use theme background.

**Wave 2 Stage 2 is in — "I'm going" + friend colors.** Opt-in `going` row per user per show. Color blob only at ≥3 people of that `show_up` hue; raw counts never leave the RPC. Faces show only when going, `me.visible` true, and not blocked. 18+ nights call `is_at_least_age`. City stays typed (not GPS). Calgary `weekend.json` honestly empty until Edmtrain.

**Stage 9 first pass is in (intake core + Day 1 payoff wiring).** Fresh onboarding is identity, then 9 chip screens with a visible "N of 9". Five ME columns (`evening_wind_down`, `energy_pattern`, `recovery_style`, `support_style`, `current_focus`). All 9 chips editable from You/Settings.

**Stage 11 optional fast-entry is in.** After the 9 chips, `complete_signup` succeeds, then an optional `extra N of 9` phase (type grid + 8 vibe-check scenarios). All 16 nullable 0–1 axes exist on ME. Direct sources sticky over inferred; inferred writes damped; `last_touched` on write; confirm-upgrade cannot change the number.

**You-tab Full Profile is in.** Collapsed Settings fold on You: all currently-defined axes, "not answered yet" when null, last source in plain language, last updated from `trait_touched_at`, 2-letter codes, "How this has shifted" timeline, AxisTaps edit with 8s undo. Completion is `N of 16 settled` (stability-weighted report-track) — invitation, never a percent of a person.

**You-tab facts list is in.** Summary row next to "How you show up": "Sage remembers N things" or "Nothing yet". Tap opens "What Sage remembers" — read/delete only; teaching stays Chat "Teach Sage this".

**Infinite Questions core is in.** "Tell Sage more" off You. Cached batch of 5 multiple-choice items mapped to the 16 axes. Regen 3/UTC-day via `claim_questions_batch`. Answers write `self_situation` through `mergeTraitWrite` (damped). Same Explore guards on stems and options. Optional skippable intake sweep uses the full-sweep path — never required. Draft copy flagged for emci (`INTAKE_SWEEP_COPY_REVIEWED` false).

**Trait history, notes, EWMA tracks, and Full Profile depth are in.** Every numeric trait write appends `trait_history` and blends into `trait_tracks` (report vs game never mix; EWMA α=0.35; stability floor 3 answers; 60-day idle then 90-day half-life decay at read). Notes (`me.tokens` + `token_events`) are earned only — never purchased. Spend is a known price: extra Sage look (no trait write) or Full Profile Depth (real ranking pick or gut-call for that axis, 48h cooldown). Live Sage title from stable axes only (own quota, does not throttle Talk); user can flag it.

**Sage voice pass is in.** `sage.txt` is behavior + five few-shots. ME has `voice_preset` (default `close_friend`). Generated Read/Talk runs a keyword jargon guard; a hit swaps in a banked fallback and logs `ai_usage.jargon_flag` + `jargon_at`. Library copy is in (`src/app/copy/library.md`); Sage reads For Sage paraphrase lines when a knock, trait, fact, or typed line connects.

**Home/Talk content quality is in.** Home anti-repeat is no longer exact-string only; a topical-overlap gate drops paraphrases of the same angle. Sage Talk answers the typed line first; the day's Home card is optional background. Recent Sage turns go with a Talk call so a follow-up can land.

**Delete-account re-verified (Aug 28, 2026).** `auth.admin.deleteUser` hard-deletes `auth.users`; `me` has no soft-delete flag and cascades with it. All owned rows cascade. `account_deletions` is the one retained row (no FK, audit). Apple revocation confirmed by refresh-token check after `/auth/revoke`, not the 200 alone.

## Stage 8 — nearly closed, three loose ends (unchanged)
1. EAS binary 10 (`1d0d1041-9318-461f-b995-c589ac505dc2`, git `dc9ae77`) — **already submitted and in TestFlight** (submission `c0c6342d`, ASC app id `6805614731`). Needs install + confirm on a real device. **Do not submit binary 8 or 9.** Binary 8 (`d40e57a9`) was submitted and installed but cannot receive OTA — testers must move to 10.
2. Sentry native crash symbolication — still **unconfirmed** from here. Re-check once binary 10 is on-device, or by opening `e7bed112` in the Sentry dashboard.
3. Friends external testing group — Beta App Review pending on Apple since Aug 26, 2026. No action, just waiting.

**EAS Update (OTA) is live as of binary 10.** Devices on binary 10+ receive JS via `eas update`. Devices on binary 8 or earlier cannot. Latest production JS: group `af9b56ee-6022-4421-a1b4-d3b781ce149b` (`3c0aae7`, Explore is a real tab). **OTA published Aug 31, 2026.** Prior group `5999d5d4-06a2-46e9-bc7e-5ab1938a8711` (`34f45a5`, Explore full screen) is superseded.

## Done
**Sign up / Log in split is in.** Separate screens: Sign up is OTP + Apple with no password field; Log in is Apple, optional password, and OTP fallback. Password set/change in You Settings via `supabase.auth.updateUser` (GoTrue hash).

**Pipeline-blueprint Trace is in** (commits `f6a43f5`, `558f2fe`, `1ae6105`, `dcc8f8b`, `52ff462`). Dawn, Talk, and Explore log context → model → guard → output; Around is not wired. One generic viewer over the section registry. **OTA published Aug 29, 2026.**

**Explore as a real tab OTA** (commit `3c0aae7`). Group `af9b56ee-6022-4421-a1b4-d3b781ce149b`. Explore moved into the tab navigator as a native tab (Home / Sage / Explore / Around / Circle / You); the Sage header "Explore ›" button was removed; the pushed `/explore` screen became a tab holding the title card, Categories at full detail (`CategoriesFold`), The Story, Notes insight spend, and the observation bubbles. **OTA published Aug 31, 2026.** 100% production channel — no staged rollout. Binary 10+ picks it up on launch. Supersedes `5999d5d4`.

**Friend-voice style checklist OTA** (commit `96f61b8`). Group `9855305a`. Shared six-rule style checklist + approved anchors across Dawn Read, Explore, Title, Category, Story. **OTA published Aug 31, 2026.** 100% production channel — no staged rollout. Superseded by `af9b56ee`.

**Wave 22 + warmer Story copy OTA** (commits `171dea4`, `0f4dc3a`). Group `04c91f24`. Dawn categories, Explore combine, Levity, The Story (own quota, no fallback); Story told-vs-played copy in friend voice. **OTA published Aug 31, 2026.** Superseded by `9855305a`.

**Live TRAIT_AXES counts OTA** (commit `7d6cbd7`). Group `0b829830`. Sage thin-profile is a 6/15 fraction of the live axis list. **OTA published Aug 31, 2026.** Superseded.

**Sage Support tap OTA** (commit `f76238c`). Group `b82f1902`. **OTA published Aug 31, 2026.** Superseded.

**Wave 21 Playfulness + categories OTA** (commit `6d82c75`). Group `8d89a42c`. 16th axis, eight report-track categories, Home two-slot teaser, Circle dual-opt-in compare. **OTA published Aug 31, 2026.** Superseded.

**Trait tracks + settled completeness + Sage titles OTA** (commits `98b2140`, `e815033`). Group `8cea6738`. **OTA published Aug 31, 2026.** Superseded.

**IA reorganization through Explore axis grounding OTA** (commits `88e3fe9` … `66149b6`). Group `8771f505`. Home one-slot, weekly Ask, Tell Sage more, Explore in Sage with axis grounding, You regroup, consent interstitial, support promoted, honest-empty Today. **OTA published Aug 30, 2026.**

**You-tab facts list + sample previews OTA** (commits `cf3fc4a`, `8902371`). Group `166dfa28`. **OTA published Aug 29, 2026.**

## Unreviewed copy — one list, waiting on emci (Aug 31, 2026)

Every flag below is `false` in code; nothing ships as reviewed without emci's direct read. Story/Levity are diagnosis-adjacent — same bar as the Crisis spec.

1. **The Story + told-vs-played samples** — `STORY_COPY_REVIEWED = false` (`sage-story.ts`). Sample paragraph, 3 tension lines, live Story prompt. `TITLE_COPY_REVIEWED = false` (`sage-title.ts`) for title samples.
2. **Playfulness poles + stems** — `POLE_COPY_REVIEWED = false` (`axis-poles.ts`): Full Profile poles for all 16 axes. Playfulness ranking items, scenario first + second stems (`SCENARIO_DECK_MORE`), `TRAIT_POLE_LINES`/mid lines.
3. **Levity copy** — category def/name (`categories.ts`), fallback band + map-quadrant lines (`category-bands.ts`, `CATEGORY_BAND_COPY_REVIEWED = false`), category concept explainer, Explore category grounding for `cat_levity`.
4. **Category bands + category copy** — `CATEGORY_COPY_REVIEWED = false` (`categories.ts`) and `CATEGORY_BAND_COPY_REVIEWED = false` (`category-bands.ts`): offline fallback bands + live category line copy (Explore pinned card, You fold, teaser, Circle compare).
5. **25 concept explainers** — `CONCEPT_COPY_REVIEWED = false` (`concept-explainers.ts`): 16 axis + 9 category "?" explainers.
6. **Dawn category grounding** — `DAWN_CATEGORY_COPY_REVIEWED = false` (`dawn-category.ts`).
7. **Intake sweep copy** — `INTAKE_SWEEP_COPY_REVIEWED = false` (`questions/local.ts`).

## Left
- Full device pass against `docs/ATO_DEVICE_TESTS.md` (binary 10+, OTA `af9b56ee`)
- Get all testers onto binary 10 (they cannot receive OTA on binary 8)
- Confirm binary 10 on a real device (icon, OTA, everything)
- Gut Call regression — still open
- Live Talk failure — still open
- Re-check Sentry symbolication (event `e7bed112` on binary 8 is unconfirmed)
- Friends Beta App Review — waiting on Apple
- Edmtrain live data — waiting on their key approval; Around stays honest-empty until then
- Known, accepted, non-blocking: AI-quota client-bypass hardening — public-launch item, not now
- Close the `require_root()` handle gap: surviving admin account is `emci2`, not `emci`

## Public release readiness — do not start until public launch is imminent
- App Store Connect privacy labels: answers ready in `app-privacy-labels.md` (11 types), not yet pasted into App Store Connect
- `support@asstrollogs.com` — used as the public contact; **not yet confirmed as a real, monitored inbox**
- Terms §13 (governing law/dispute resolution) and the crisis disclaimer both still need a lawyer's pass

## Backlog (not blocking the Friends TestFlight group)
- Fantasy UI Borders pack (Kenney) — UI chrome/panels/buttons
- Monster Builder Pack — parked, needs eyes/mouth slots added to recipe before usable
- Revisit onboarding question wording if it still feels off after a fresh look
- **Decided, later Wave 1.5 boxes (see ATO_PLAN_v2 Understanding spec):** three-path extra-axis intake (play path shipped as scenarios); 3-month Settings prompt; You-tab weekly completeness slot; Dawn Reload. Locks from the Aug 28 Grok review are in that spec (do not reopen in a later box).
- Crisis: relational-safety/abuse category, own resource number, parked separately
- **AI capacity hardening** — close the client-embedded-key bypass before public launch
- Slack — parked as future ops tooling
- Push notification timing from `energy_pattern` / `evening_wind_down` (fields exist; not wired)

## Housekeeping
- docs/ATO_PLAN_v2.md, docs/ME.md, docs/NOW.md, docs/BUSINESS.md — Cursor maintains these directly. Commit together, `git push` immediately, never left local-only. ATO_PLAN_v2.md is a **working reference**, not a locked spec. Crisis / coach-label / diagnosis-avoidance / App Store floor sections are compliance-grounded and not casually revised. Device pass lives in `docs/ATO_DEVICE_TESTS.md`.
- EXPO_PUBLIC_GEMINI_API_KEY set and live-verified. Model pinned to `gemini-3.7-flash`.
- **Open decision (emci's, not technical):** Apple Developer account type — Individual vs Organization. Revisit before public submission.
- Bundle ID `com.emgens.ato` (App ID) / `com.emgens.ato.signin` (Services ID) confirmed.
- Apple client_secret JWT minted Aug 25, 2026, expires Feb 24, 2027 07:24 UTC. Regenerate around late Jan 2027. Not automated.
- Email sending on `noreply@asstrollogs.com` (Resend-verified). Landing page live at `ato.emgens.com` — invite request form in `landing/`. Social handle decided as `@whatsyourato` (primary), fallbacks `emgensato`/`atoapp`/`heyato`.
- **Intentional deviation:** the locked Ink / Paper / Steel / Bloom palette is discarded for app chrome; appearance is five modes (Soft / Zen / Quest / Neon / Anime). The You-tab share poster still uses the four.
- **Intentional deviation (Aug 27, 2026):** Wave 1.5 and Wave 3 start now in parallel.
- **Around refresh secrets (Wave 2):** Edge Function `refresh-around` is deployed. Needs `EDMTRAIN_CLIENT_KEY` + `AROUND_REFRESH_SECRET`; cron not scheduled until both exist. Phone never holds the Edmtrain key.

## Next 15 min
Work through `docs/ATO_DEVICE_TESTS.md` in full on a real device with **binary 10** installed (it pulls OTA `af9b56ee-6022-4421-a1b4-d3b781ce149b`). Every box's checklist, one sitting. Bring back anything that fails. Once that pass is clean, Stage 8 handoff #2: invite/referral gate (Auth + ME). Open items that are not the device pass: Gut Call regression, Live Talk failure, closing the `emci2` root-handle gap.
