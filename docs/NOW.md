# NOW

**Category:** Hybrid — AI-native + Social + Health/finance/kids
**Gates:** A ✓ (non-goals in archive/OLD_PLAN.md) · B ✓ (iOS/Expo, Supabase, Apple Sign-in+email) · C in progress · D not started
**Modules on:** report/block (Social), crisis static-card + privacy pass (Health/finance/kids) — both required, in progress
**Live AI + model:** Cursor, Grok 4.6 (current), Expo SDK 54
**Latest production OTA:** `11d99ff3-33a3-49f8-832f-bde38d8f61ed` (commit `2bfbbc7`, runtime 1.0.0, ios+android) — Phase 3: Home hero card, Legends+Circle primary tabs, subscription-gated appearance modes, 20/24 type steps, `home_bootstrap`. Published Sep 2, 2026. Binary 10+. Supersedes `2498225d` (commit `c2eb2f8`, Phases 0-2: vendor keys server-side, `ai-generate` JWT + token cap + quota claim, root as `me.is_root`, typecheck/lint in the OTA gate, docs restructure).

## On
**Unified AI provider layer is on production (OTA `b84f0aa6`, Sep 1, 2026).** Every Sage model call goes through `generateText({ prompt, temperature, maxOutputTokens, responseFormat })` in `src/lib/ai`. `EXPO_PUBLIC_AI_PROVIDER` selects Gemini, NVIDIA, Perplexity, Claude, Grok, or `local`. **Superseded Sep 2, 2026: every one of those six now goes through the `ai-generate` Edge Function and every key is a Supabase secret** — the client-side `EXPO_PUBLIC_*` key path described below was removed, and `check:ai-provider` fails on any `EXPO_PUBLIC_*_API_KEY` reference under `src/`. `MODEL_PROVIDER=local` still forces the deterministic fallback. A hidden provider switcher (tap the Build line 5 times) stores an on-device override in AsyncStorage. Each remote call logs `provider + timestamp` to `ai_provider_log` (not the response) so the switcher can show rolling 1-minute / 24-hour self-tracked counts next to seeded free-tier baselines. **Gemini API key rotated the same day** in gitignored `.env.local` and the production EAS env var (`eas env:set`; classic `eas secret:list` is empty/deprecated). Claude/Grok will 503 until `ANTHROPIC_API_KEY` and `XAI_API_KEY` are set on the Supabase project. NVIDIA/Perplexity need their `EXPO_PUBLIC_*` keys locally to switch to them.

**Test-account wipe for clean retest (Aug 31, 2026).** All test accounts (riley, sam, yeezy, zintake9, lazyemci) hard-deleted via `auth.users` cascade (checks, trait_history, trait_tracks, token_events, ai_usage, going, sage_messages, explore_*, question_*, connections, messages, blocks, mutes, reports, invite_codes, apple_credentials all cascade; `account_deletions` audit rows written for each). Only **emci2** (`lil_emci@hotmail.com`, Apple) remains. **EMCIRETEST** is owned by emci2, unlimited (`max_uses NULL`), verified usable. **Known gap:** handle is `emci2`, not `emci`, so dev-root RPCs keyed on `handle='emci'` don't recognize it.

**Fixed dev-test identity (Sep 2, 2026).** `ato-dev@example.com` / `@atodev` is a real auth + `me` row provisioned by `supabase/migrations/wave31_dev_test_user.sql` (auth id `a70d3e0e-4c00-4a1e-8c0d-00000000d3e0`). **Superseded Sep 3, 2026: there is no client-side sign-in for this account anymore** — sign in the normal way (Apple / OTP / a password set in Settings) and, while already signed in as `@atodev`, the Legends tab shows a dev-only "test persona" strip (this user only) that swaps all 16 trait values between the 4 legend archetypes and clears seen-legend history so the matching card re-shows — needs the owner-scoped `user_legend_history` delete policy that `wave31` also added. `npm run check:dev-test-user` guards the whole thing. The earlier ad-hoc `legends-dev@emgens.com` / `@legendtest` account was removed by the same migration. The account is deliberately not root/founder/dev-granted.

**Hidden dev-access unlock (Sep 3, 2026).** Tapping the version number on You 7x opens a password prompt, checked server-side by the new `dev-unlock` Edge Function against the `DEV_UNLOCK_PASSWORD` Supabase secret — never hardcoded client-side. A correct password sets an in-memory, session-only flag (`src/lib/dev-access-unlock.ts`, no AsyncStorage/SecureStore) that `canSeeDevLab` accepts alongside `PRE_LAUNCH_DEV`/`__DEV__`, root, and per-account grants (`dev-lab.tsx`, Home's dev row) — a cold start always starts locked again. This replaces the old "Sign in as dev user" button and the hardcoded dev-test password/auto-login in `src/lib/dev-test-user.ts`, both removed entirely. `npm run check:dev-unlock` guards the Edge Function contract and the wiring. **`DEV_UNLOCK_PASSWORD` still needs to be set as a Supabase secret and the function deployed** (`supabase secrets set DEV_UNLOCK_PASSWORD=... && supabase functions deploy dev-unlock`) — this repo has no CI, so both are manual, outside this PR.

**"Dev only." on cold start = stale binary 8, not a live gate (confirmed).** Testers on binary 8 see a blank screen with "Dev only." — that is the **embedded bundle from before commits `2fdc278` + `5f1c86b` (Aug 28)** which (a) moved all `*-lab` screens out of the cold-start position behind `<Stack.Protected guard={__DEV__}>` and (b) replaced the `Dev only.` block in each lab with `<Redirect href="/" />`. The string no longer exists anywhere in `src` or the bundles. **Binary 8 cannot receive OTA** (no `expo-updates`). **Binary 10 is already submitted and processing in TestFlight** (build `1d0d1041`, submission `c0c6342d`, ASC app id `6805614731`, finished Aug 27) — the fix for all testers is **install binary 10**; the current production OTA `d5332b8b` then applies automatically.

**Wave 22 — Dawn categories, Explore combine, Levity, The Story (Aug 31, 2026).** Dawn Read may draw from one settled category among Steadiness / Agency / Drive; new users with none of those three settled keep knock/fact/focus exactly; Do if-then is untouched; anti-repeat and cut/crisis gates still run on the generated card. Explore may generate from any live category, at most two per entry and only when a recent signal ties them, and must not restate the pinned Categories card on the same screen. Agency-triple (GM+LC+SE) and the output fence are unchanged. 9th category **Levity** is a bar (Playfulness + conflict assertiveness + cooperativeness) — Love/closeness stays the only conflict-adjacent map. **The Story** is a separate longer-form Gemini call on its own quota (`claim_story_generate`), fingerprint-gated, thin-profile gated, no offline fallback, on the **Explore tab**. **All new copy is unreviewed. The Story is diagnosis-adjacent — same bar as the Crisis spec. Not shippable without emci's direct read.**

**Explore is its own tab (Sep 1, 2026).** The Sage tab is now clean chat only — 8-ball + conversation, nothing else. **Explore is a real bottom tab**, opened directly — no "Explore ›" button in Sage. The Explore tab holds: Categories at full detail (`CategoriesFold` — bars/maps, concept explainers, weekly spotlight), The Story, the Sage title card, Notes insight spend, and the Explore observation bubbles with "Did this land?" reactions. "N of 16 settled" lives on the Explore tab header (no longer on Sage).

**Shared friend-voice style checklist is live (OTA `9855305a`, commit `96f61b8`).** All five generation surfaces (Dawn Read, Explore, Title, Category summaries, The Story) inject one shared `STYLE_BLOCK` from `src/lib/voice/style-checklist.ts`: six rules (never "you are"; never describe itself; one idea at a time when possible — Rule 3 acknowledges Rule 6's title/category exception; leave room for change, prefer lately/this week/for now; sound like a friend; Rule 6 — when more than one quality shares a sentence, join with but/yet/and, never a comma list) plus emci-approved few-shot anchors and bad→good join examples. Also fixes the stale `check:traits` assertion.

**Wave 21 — Playfulness, categories, Home 2-slot, Circle share (Aug 31, 2026).** 16th axis `playfulness` (IQ / ranking / gut-call / Depth / EWMA, same as the other extra axes). Categories read **report-track only** (never `self_game`). Bars after the existing stability floor; maps require **both** axes independently stable. Combined title+category Gemini on the existing title quota (not Talk). Pinned Categories summary on Explore + Categories fold on You + concept "?" explainers (**unreviewed**). Home category teaser is a **deliberate, dated reversal** of the Box 8 one-slot rule — teaser never sits next to crisis or missed-check. Weekly category spotlight. Full-picture capstone badge when all live categories are ready. Circle category compare is dual-opt-in (per-friend or Close Friends pool) and fully separate from Full Profile. Crisis card, widget, and Check are untouched. No paywall.

**IA reorganization is in (15 boxes, Aug 30, 2026).** Home is card + Did/Skip + a primary slot, plus a **deliberate second collapsed category teaser (Aug 31 override of the original one-slot Box 8 rule)** when that slot is not crisis or missed-check. One weekly Ask (Does-Sage-know-you / ranking / Gut call) shares the primary slot. Questions live on "Tell Sage more" off You. Explore is a real bottom tab (axis grounding in `buildExplorePrompt`; pulled out of the Sage thread Sep 1). You holds tone, badges, growth, Weeks, support (region picker only), trait bands, Full Profile, Categories, Account. AI consent is a Dawn/Sage interstitial. Consent-off past day 3 is honest-empty Today; Did/Skip still saves (`record_check` `p_no_card`) and counts toward `check_count`. **Full device pass is the gate before Stage 8 handoff #2 (invite/referral).**

**Sage Support tap is in.** A low-key lifebuoy + "Support" under the Sage composer (and at the bottom when Talk is off) opens the same static crisis card as the keyword interrupt — no message required. Keyword path, card copy, numbers, region logic, and "I'm okay, keep going" are unchanged. Sage is a permanent tab (not hideable; only Circle hides). You's "If you need someone now" fold is the **region picker only**.

**Axis counts are live.** Sage thin-profile coaching, Talk/insight depth copy, divergence, and Full Profile completeness all read `TRAIT_AXES.length` — thin is `settled / TRAIT_AXES.length < 6/15` (currently 16 axes, so fewer than 7 effective settled = thin). Adding a 17th axis updates those automatically. Explore still never combines `growth_mindset` + `locus_of_control` + `self_efficacy` in one entry.

**Nav bar is customizable (Sep 1, 2026).** A custom JS bottom bar (replacing `NativeTabs`), driven by a persisted `NavOrder` in AsyncStorage. **Home and Sage are pinned and swappable with each other, never into More; More is the fixed rightmost slot; Explore / Around / You / Circle are freely reorderable and movable between the bar and More.** Long-press a tab to enter "Edit navigation" (drag to arrange, Done to commit). Gated tabs use a reusable `isUnlocked` check: unmet ones leave the bar and More and show only under **Not unlocked yet** (no Bar/More toggle, reason on the row). Circle is locked until a friend is scanned ("Scan a friend to unlock Circle.") and keeps its stored slot. Default: **Home / Sage / Explore / You on the bar (5 items), Around + Circle in More** — Around defaults secondary ("a room opened on purpose"); the default only applies to new/unset accounts, any persisted order is preserved.

**Circle Explore is in.** Circle appears only after a QR scan / link paste connects two accounts. Per-friend category share (`category_share`) and Close Friends pool (`close_friends_share`, default off) are both opt-in; `peer_category_pack` returns cached title+category summaries only, never Full Profile. Both sides must opt in before either sees the other's cards.

**Does Sage know you? is in (Stage 13, part 2).** One kind of the weekly Home Ask (never inside Talk replies, no duplicate Sage/You card). Banked high/low paraphrase lines only — no Gemini call, no quota. Buttons are "Still fits" / "Not quite". Still fits is `confirmTraitSource` (source upgrade, number unchanged). Not quite is a single-axis Settings write (`self_settings`). Eligible axes are non-null, past a 14-day cooldown, not mid-band, not on the cruel-pole list, and not the last axis shown. Round-robin through that pool. At most one per week; yields while any axis is still null; dismiss ends the week. Two consecutive Still fits graduates it until the 3-month Settings re-ask (not built). `me.sage_knows` stores cursor, week slot, streaks, and graduation.

**Sage content model v2 is in.** Read/Do labels unchanged (no ATOsophy/Sync). Cards stay per-user on the existing quota (20/day, 200/month). Reload (cycle stored same-truth variants) is decided in archive/OLD_PLAN.md, not built. Home in Quest uses `Sage · npc` on the card only; elsewhere `Sage · coach`. Home can show a third daily category, **Nudge** (internal zGlitch): encouragement from a real recent signal only. Never Circle, widget, or morning push. `checks_select_connected` is dropped; `peer_checks` returns day / status / Read / Do only.

**Home milestone badges are in (Stage 13, part 1).** On You: a collapsible milestone strip — 7 Checks, first fact taught to Sage, and a full week without a cut, plus the full-picture capstone (all categories ready). Pure reads of already-logged data. Glow only when true. Honest-empty Checks count toward presence.

**Home ranking is in (Stage 13, part 4).** Optional-depth forced ranking as one kind of the weekly Home Ask: drag 4–5 plain behavioral lines, most-you at the top, one trait axis per round. Writes `self_tap` (direct, sticky merge). Yields if Does-Sage-know-you or a completeness claim already has that week's slot; extra-axis gaps go to the scenario swipe-deck.

**Scenario swipe-deck is in (Stage 13, part 5).** Gut call as one kind of the weekly Home Ask. Six extra axes, one card each, two forced choices. Writes `self_game` (inferred; cannot overwrite a direct answer). Same weekly slot as ranking and Does-Sage-know-you.

**Home reveal is in (Stage 13, part 3).** Daily tap-to-open on Home. Pool is a fresh angle on this week's actual Read/Do pattern, a stored fact reflected back, or badge-proximity. One short unfold (300ms), one short haptic, Reduce Motion skips to the copy. Empty days show a plain calm line with no sealed object.

**Check window + weekly recap cap are in.** A Check is for a calendar day in the user's timezone. Today or up to 2 days back; days 3+ permanently closed. `record_check` is the only write path. Read + Do + Nudge text kept for the rolling 7 calendar days; older text nulled, did/skip stays forever. Sunday recap counts the previous Sun–Sat. `this_week` on ME was never implemented — recap reads the checks table.

**Build line is in.** You Settings and `/dev-lab` show what this phone is actually running: EAS update group id, short `expo-updates` UUID, or `embedded` / `local`. Tap copies the full id.

**Pixel placement + tap moods shipped.** One small fixed top-right nav companion on all tabs (current-you on Home/Around/You, aspirational-you on Sage); tap plays a short coherent mood; crisis hard-disables hands. Shape is one of 6 hashed recipes per account; color from `show_up`.

**UI polish pass is in.** Poster redesigned on Ink / Paper / Steel / Bloom (shareable artifact only; app chrome stays Soft / Zen / Quest / Neon / Anime). Crisis "I'm okay, keep going" has a 2px accent border. Soft-mode outline buttons share `controlBorderColor`. Sage pinch-zoom disabled on tab ScrollViews; tab chrome + SystemUI use theme background.

**Wave 2 Stage 2 is in — "I'm going" + friend colors.** Opt-in `going` row per user per show. Color blob only at ≥3 people of that `show_up` hue; raw counts never leave the RPC. Faces show only when going, `me.visible` true, and not blocked. 18+ nights call `is_at_least_age`. City stays typed (not GPS). Calgary `weekend.json` honestly empty until Edmtrain.

**Stage 9 first pass is in (intake core + Day 1 payoff wiring).** Fresh onboarding is identity, then 8 chip screens ("Eight quick taps") with a visible "N of 8". Four ME columns still active (`evening_wind_down`, `energy_pattern`, `support_style`, `current_focus`) — `recovery_style` question removed 2026-09-01 (was an orphan; the DB column stays for existing users' historical values, coalesced not overwritten on re-save). All 8 chips editable from You/Settings.

**Stage 11 optional fast-entry is in.** After the 8 chips, `complete_signup` succeeds, then an optional `extra N of 9` phase (type grid + 8 vibe-check scenarios). All 16 nullable 0–1 axes exist on ME. Direct sources sticky over inferred; inferred writes damped; `last_touched` on write; confirm-upgrade cannot change the number.

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

**EAS Update (OTA) is live as of binary 10.** Devices on binary 10+ receive JS via `eas update`. Devices on binary 8 or earlier cannot. Latest production JS: group `c897410d-a019-4d66-8062-3267ca695710` (commit `4b27a0b`, legend story variants). **OTA published Sep 2, 2026.** Prior group `d5332b8b-7d5d-4898-bb5f-df121933b499` (`fb71b2d`, dev-test personas) is superseded.

## Done
**Legend variants device-verify + first resurface (Da Vinci v2, wave33, Sep 2, 2026).** Confirmed the wave32 figure+variant catalog loads from `legend_variants` with the `legend_figures` embed and serves at most one variant per figure per batch (new `npm run check:legends-live`, 4/4 against production). Seeded Da Vinci's first v2 variant (migration `wave33_legend_variant_v2`, applied live): same `figure_id`, `variant_key='v2'`, linked to `arch_the_architect`, new angle (systematic self-directed study vs v1's never-finishing). After v1 is seen, Da Vinci resurfaces through v2 — no new OTA required (the wave32 client reads `legend_variants` live). Data-only; not yet tapped through on a physical binary-10 device.

**Legend variants repeat policy OTA (commit `4b27a0b`, Sep 2, 2026).** Group `c897410d`. Client for the wave32 figure+variant model: store reads `legend_variants` (+ figure embed), match serves the best unseen variant per figure per batch, cards/history use the variant model. **OTA published Sep 2, 2026.** 100% production channel — no staged rollout. Supersedes `d5332b8b`.

**Legend variants repeat policy (wave32, Sep 2, 2026).** `legend_figures` + `legend_variants` replace the single-story `legends` table: a figure (Da Vinci etc.) owns one or more story variants, each linked to its own archetype(s). Never-repeat is per **variant** — a figure can resurface later with a different angle (or a different archetype it also fits). **Migration applied to production 2026-09-02** (4 figures → 4 `v1` variants, variant ids reuse the old legend ids so junction/history re-pointed cleanly). Client moved in the same pass (store reads `legend_variants`, match dedupes per figure); code commit + OTA follow this entry.

**Legends dev-test personas OTA (commit `fb71b2d`, Sep 2, 2026).** Group `d5332b8b`. `__DEV__` cold-start auto-login as the fixed dev-test user + Legends-tab "test persona" strip. **OTA published Sep 2, 2026.** 100% production channel — no staged rollout. Supersedes `d4919b06`.

**Question deferral + invited-list OTA (commit `d95fcfa`, Sep 2, 2026).** Group `d4919b06`. Relocates skipped intake questions to the rotating Questions pool (`me.question_deferred`) and collapses "People you invited" into a fold on You. Also the first OTA carrying the **Legends tab** (commit `7cc530d`, landed earlier the same day). **OTA published Sep 2, 2026.** 100% production channel — no staged rollout. Superseded by `d5332b8b`.

**Dev-testing standard shipped (Sep 2, 2026).** `wave31_dev_test_user` applied to production: fixed dev-test account `ato-dev@example.com` / `@atodev` (auth + me), owner-delete RLS on `user_legend_history`, old `legends-dev@emgens.com` removed. Client: `src/lib/dev-test-user.ts` (creds + 4 archetype presets), `__DEV__` cold-start auto-login in `use-session.ts`, Legends-tab dev-only "test persona" strip for the dev user. `npm run check:dev-test-user` 9/9. Details in the identity bullet under On; next step is verifying the auto-login + strip on a real dev build.

**More sheet "You" tap fixed (commit `3b3a1c6`, Sep 1, 2026 — live on production since OTA `d5332b8b`, Sep 2).** The `76483a7` More-sheet fix moved hidden `TabTrigger`s for tabs parked in More, but placed them as siblings after `</TabList>` instead of inside it — expo-router/ui's `Tabs` only registers `TabTrigger`s that are descendants of `TabList`, so any reorderable tab moved into More (e.g. "You") silently stopped navigating on tap. Hidden triggers now render inside `TabList` (zero-sized via a `width:0/height:0` style, `accessible={false}` so screen readers skip them) so they stay registered regardless of bar/More placement. `nav-check.ts` (now 15/15, commit `68d2bce`) asserts the hidden triggers stay inside `TabList` so this can't silently regress again; no visual change to the bar.

**Provider-layer + Gemini key-rotation OTA** (commit `6e07fbc`). Group `b84f0aa6`. Unified `generateText` transport, hidden 5-tap `/ai-lab` switcher, `ai_provider_log` usage rows, `ai-generate` Edge Function for Claude/Grok. Gemini key value rotated in `.env.local` + EAS production env (not committed). **OTA published Sep 1, 2026.** 100% production channel — no staged rollout. Supersedes `cab5a13c`.

**More-sheet + locked-tab OTA** (commit `76483a7`). Group `cab5a13c`. More items navigate (push before close; hidden TabTriggers). Gated tabs use `isUnlocked` — Circle stays in Edit Navigation under "Not unlocked yet" until a friend is scanned. **OTA published Sep 1, 2026.** 100% production channel — no staged rollout. Supersedes `9688599c`. Superseded by `b84f0aa6`.

**Skippable intake + null-safe Dawn + push timing OTA** (commit `22d5361`). Group `9688599c`. Core intake is skippable (null intake fields accepted via `wave23`), Dawn degrades safely on null fields, and daily push windows key off `energy_pattern`. **OTA published Sep 1, 2026.** 100% production channel — no staged rollout. Supersedes `0028d5f5`.

**Push timing keyed off `energy_pattern`.** Daily morning/evening windows shift with the chip — `morning` 6/19, `afternoon` 8/20, `evening` 9/21, `night_owl` 10/22; null keeps the fixed 7/20 default. Sunday stays fixed 10:00. Only the send time moves — content, deep links, and copy are untouched. `morning_cue` / `evening_wind_down` stay anchor phrases for card copy, never timing.

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
- ~~Push + publish Phase 3~~ — **done Sep 2, 2026**, OTA `11d99ff3` (commit `2bfbbc7`).
- **Check EAS production `EXPO_PUBLIC_GEMINI_MODEL`** — must be `gemini-3.7-flash` or unset (the code default is now correct either way). Could not be read non-interactively from the build session.
- **Set the `DEV_UNLOCK_PASSWORD` Supabase secret and deploy `dev-unlock`** — the client and check suite are ready, but the Edge Function needs the secret set and deploying before the 7-tap unlock actually works.
- **Rotate the dev-test account's own Supabase password** (`ATO-dev-user-2026`, wave31 migration) — still in git history; no longer reachable client-side, but rotate it before public launch too.
- **Wire real billing** behind `src/lib/subscription.ts` before charging for Zen/Neon/Anime — the gate is live, the entitlement source is a stub that always returns inactive.
- Full device pass against `docs/ATO_DEVICE_TESTS.md` (binary 10+, OTA `d5332b8b`)
- Verify the Legends "test persona" strip on a real dev build, signed in as `@atodev` the normal way (OTA `d5332b8b` carries the code, but dev builds need the strip exercised)
- Set Supabase secrets `ANTHROPIC_API_KEY` / `XAI_API_KEY` (and optional `ANTHROPIC_MODEL` / `XAI_MODEL`) before Claude or Grok can work from `/ai-lab`
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
- **`npx tsc --noEmit` pre-existing errors (16) — tracked cleanup, NOT fixed.** These are unrelated to the intake-sweep / nav / pixel work; the runtime check gates (`npm run check:*` via tsx) are the real gate. Full list:
  1. `scripts/check-window-check.ts:83` — `.reason` on union `{ ok: true } | { ok: false; reason: ... }`
  2. `scripts/founder-access-check.ts:94` — assert overload mismatch
  3. `scripts/founder-access-check.ts:110` — `.length` on `never`
  4. `scripts/founder-access-check.ts:121` — assert overload mismatch
  5. `scripts/voice-router-check.ts:385` — `.message` on `never`
  6. `scripts/voice-router-check.ts:386` — `.recentTurns` on `never`
  7. `scripts/voice-router-check.ts:387` — `.recentTurns` on `never`
  8. `src/app/(tabs)/around.tsx:73` — `NightSnapshot.colors` `readonly []` vs mutable `number[]`
  9. `src/app/onboarding.tsx:261` — `createMe` call missing `voice_preset` (required by `MeInsert`)
  10. `src/components/optional-intake.tsx:165` — `VibeQuestion.fieldLabel` doesn't exist on `VibeDisagreeQuestion`
  11. `src/components/themed-pressable.tsx:43` — `StyleSheet` platform-specific overload (`default` key)
  12. `src/lib/checks.ts:75` — `localYmd` not found
  13. `src/lib/dev-access-server.ts:51` — `DevGrantRow.capability` string vs literal union
  14. `src/lib/reveal.ts:167` — `RevealCheck`/`WeekCheck` `created_at` mismatch
  15. `src/lib/reveal.ts:168` — `WeekCheck`/`RevealCheck` missing `day, status`
  16. `src/lib/sentry.ts:28` — `Expected 0 arguments, but got 1`
- **Decided, later Wave 1.5 boxes (see OLD_PLAN Understanding spec):** three-path extra-axis intake (play path shipped as scenarios); 3-month Settings prompt; You-tab weekly completeness slot; Dawn Reload. Locks from the Aug 28 Grok review are in that spec (do not reopen in a later box).
- Crisis: relational-safety/abuse category, own resource number, parked separately
- **AI capacity hardening** — close the client-embedded-key bypass before public launch
- Slack — parked as future ops tooling

## Housekeeping
- docs/archive/OLD_PLAN.md, docs/ME.md, docs/NOW.md, docs/BUSINESS.md — Cursor maintains these directly. Commit together, `git push` immediately, never left local-only. archive/OLD_PLAN.md is a **working reference**, not a locked spec. Crisis / coach-label / diagnosis-avoidance / App Store floor sections are compliance-grounded and not casually revised. Device pass lives in `docs/ATO_DEVICE_TESTS.md`. `PROJECT_CONTEXT.md` is a pointer to these four, not a second source of truth.
- **Production OTA publishes go through `npm run ota:publish -- <eas args>` — the hard pre-publish gate.** It runs the full offline `check:*` suite first (`npm run check:ota-gate`) and refuses to publish if any check fails. Never run bare `eas update` for production. Live/env-gated checks (accounts, seeds, network, providers) are excluded from the gate by design and run by hand when their environment exists.
- EXPO_PUBLIC_AI_PROVIDER selects the live vendor (default gemini). **Since Sep 2, 2026 every vendor key is a Supabase secret on `ai-generate`** (`GEMINI_API_KEY`, `NVIDIA_API_KEY`, `PERPLEXITY_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `DEEPSEEK_API_KEY`); nothing under `src/` may reference an `EXPO_PUBLIC_*_API_KEY` (`check:ai-provider` fails if it does). Model from `EXPO_PUBLIC_GEMINI_MODEL` / `GEMINI_MODEL` secret (default `gemini-3.7-flash`; `gemini-2.5-flash` is retired). Never commit `.env.local`.
- **Open decision (emci's, not technical):** Apple Developer account type — Individual vs Organization. Revisit before public submission.
- Bundle ID `com.emgens.ato` (App ID) / `com.emgens.ato.signin` (Services ID) confirmed.
- Apple client_secret JWT minted Aug 25, 2026, expires Feb 24, 2027 07:24 UTC. Regenerate around late Jan 2027. Not automated.
- Email sending on `noreply@asstrollogs.com` (Resend-verified). Landing page live at `ato.emgens.com` — invite request form in `landing/`. Social handle decided as `@whatsyourato` (primary), fallbacks `emgensato`/`atoapp`/`heyato`.
- **Intentional deviation:** the locked Ink / Paper / Steel / Bloom palette is discarded for app chrome; appearance is five modes (Soft / Zen / Quest / Neon / Anime). The You-tab share poster still uses the four.
- **Intentional deviation (Aug 27, 2026):** Wave 1.5 and Wave 3 start now in parallel.
- **Around refresh secrets (Wave 2):** Edge Function `refresh-around` is deployed. Needs `EDMTRAIN_CLIENT_KEY` + `AROUND_REFRESH_SECRET`; cron not scheduled until both exist. Phone never holds the Edmtrain key.

## Next 15 min
Work through `docs/ATO_DEVICE_TESTS.md` in full on a real device with **binary 10** installed (it pulls OTA `d5332b8b-7d5d-4898-bb5f-df121933b499`). Every box's checklist, one sitting. Bring back anything that fails. Once that pass is clean, Stage 8 handoff #2: invite/referral gate (Auth + ME). Open items that are not the device pass: dev-test auto-login + Legends persona strip verification, Gut Call regression, Live Talk failure, closing the `emci2` root-handle gap, Claude/Grok Supabase secrets if those providers will be used.
