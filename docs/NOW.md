# NOW

**Category:** Hybrid — AI-native + Social + Health/finance/kids
**Gates:** A ✓ (non-goals in ATO_PLAN_v2.md) · B ✓ (iOS/Expo, Supabase, Apple Sign-in+email) · C in progress · D not started
**Modules on:** report/block (Social), crisis static-card + privacy pass (Health/finance/kids) — both required, in progress
**Live AI + model:** Cursor, Grok 4.6 (current), Expo SDK 54

## On
**Password sign-in is a secondary auth path for App Review.** Email + Send code (OTP) and Apple Sign-In stay the primary flows. The auth screen has a password field and a "Sign in with password" link under Send code so the seeded `ato.review@asstrollogs.com` demo account can use `signInWithPassword`. JS-only — same OTA channel, no new native module.

**You-tab crash/push probes are off TestFlight.** "Test crash reporting" / Native crash and "Test notifications" never render in production. Same compile-time `__DEV__` cut as `/dev-lab` (`Stack.Protected` + in-file gate). You does not statically import those cards; production Metro resolves the probe modules to a null stub so the controls are absent from the JS bundle, not hidden by a runtime flag. `triggerNativeTestCrash` is a no-op when `__DEV__` is false.

**Home hydrates today's card on a fresh install.** If on-device `today-card` storage is empty and today's Check already exists, Home writes Read/Do/Nudge from that row instead of showing "No card yet".

**Founder codes + access requests are in.** `me.is_founder` (default false) is flipped by root only — cosmetic Founder badge on You, not Dev/Admin, no extra app access. Flipping it true issues one owned invite code with `max_uses` null (unlimited). Consume never caps that code; `referred_by` is still the owner. The landing page (`landing/` → ato.emgens.com) takes an email into `access_requests`. `/dev-lab` Access (dev-gated, root/emci RPCs) lists pending rows. Approve generates a single-use code owned by root and emails it via Resend (`noreply@asstrollogs.com`, same from-address as OTP). Deny marks denied and sends nothing.

**Does Sage know you? is in (Stage 13, part 2).** A Home/Sage check-in (never inside Talk replies). Banked high/low paraphrase lines only — no Gemini call, no quota. Buttons are "Still fits" / "Not quite", not yes/no. Still fits is `confirmTraitSource` (source upgrade, number unchanged). Not quite is a single-axis Settings write (`self_settings`). Eligible axes are non-null, past a 14-day cooldown, not mid-band, not on the cruel-pole list, and not the last axis shown. Round-robin through that pool (oldest `last_touched` only ties the first pick). At most one per week; yields while any of the 15 axes is still null (completeness/game invite win that budget); dismiss ends the week. Two consecutive Still fits on the same axis graduates it until the 3-month Settings re-ask (not built). `me.sage_knows` stores cursor, week slot, streaks, and graduation.

**Nav bar appearance is in.** Bottom tab chrome uses the live appearance background in all five modes (opaque). Same family as the Sage zoom white-flash: native/system white behind the bar. The earlier `disableTransparentOnScrollEdge` + dark system material left the bar sampling white; tabs also mounted as Soft before storage loaded, so a saved dark/Zen mode kept a white bar. Navigation theme `card`/`background`, `blurEffect="none"`, hydrate-before-mount, and the web bar all use `theme.background` (not Soft-white card surface or translucent Anime).

**Sage content model v2 is in.** Read/Do labels are unchanged on Home, Dawn, widget, push, and Circle — no ATOsophy/Sync. Cards stay per-user on the existing quota (20/day, 200/month); no shared pools, no live reroll. Reload (cycle stored same-truth variants) is decided in ATO_PLAN_v2.md, not built. Talk, Dawn, consent, crisis, morning push, and widget keep `Sage · coach` and the disclosure sentence. Home in Quest appearance only uses `Sage · npc` on the card (no disclosure on that card); Soft / Zen / Neon / Anime Home stay `Sage · coach`. Home can show a third daily category, **Nudge** (internal zGlitch): encouragement from a real recent signal only — never from `talk_style`. No signal → no card. Never Circle, widget, or morning push. Circle reads `peer_checks` (day / status / Read / Do only). `checks_select_connected` is dropped, so a connected peer cannot retrieve `nudge_text` even with a direct `checks` query. The owner's Home path still `select('*')` on their own rows.

**Home milestone badges are in (Stage 13, part 1).** The existing all-time Checks chip is now a collapsible milestone strip: 7 Checks, first fact taught to Sage, and a full week (7 consecutive calendar days) without a cut. Each one is a pure read of already-logged Checks / stored facts — no randomness, no chance, no popup. Glow only after the milestone is true. Same chip language, contained in its own surface, all five appearance modes.

**Home ranking is in (Stage 13, part 4).** Optional-depth forced ranking: drag 4–5 plain behavioral lines, most-you at the top, one trait axis per round (first nine axes). Writes `self_tap` (direct, sticky merge). Soft-ask: yields if Does-Sage-know-you or a completeness claim already has that week's slot; extra-axis gaps go to the scenario swipe-deck.

**Scenario swipe-deck is in (Stage 13, part 5).** Gut call on Home/Sage/You. Six extra axes, one card each, two forced choices. SDT is three separate cards, never a three-way pick. Writes `self_game` (inferred; cannot overwrite a direct answer). Same weekly slot as ranking and Does-Sage-know-you.

**Home reveal is in (Stage 13, part 3).** Daily tap-to-open on Home. Pool is a fresh angle on this week's actual Read/Do pattern, a stored fact reflected back, or badge-proximity (1–3 remaining on 7-Checks or a week without a cut). Priority-pick like Nudge — first real signal wins, no filler. Content is selected before render. One short unfold (300ms) for every kind, one short haptic, Reduce Motion skips to the copy. Empty days show a plain calm line (`Nothing extra to notice today.`) with no sealed object.

**Check window + weekly recap cap are in.** A Check is for a calendar day in the user's timezone (signup-local day 1). You can log today or up to 2 days back if that day is still empty — one Check per day, not extra Checks on the same day. Days 3+ back are permanently closed. `record_check` is the only write path (client inserts revoked). Read + Do + Nudge text is kept for the rolling 7 calendar days (today through today-6); older text is nulled, did/skip stays forever for `check_count` and valence. Sunday recap still counts outcomes for the previous Sun–Sat; last Sunday's Read may already be pruned (today-7). `this_week` on ME was never implemented — recap reads the checks table.

**Nav pixel tap moods are in.** Tapping the top-right companion plays a short coherent gesture (wave, thumbs-up, happy bounce, or hug) with no startup delay. Rapid re-taps interrupt-and-restart — they do not queue. Sage weights bounce/wave a bit more; current-you uses the full set evenly. Crisis still hard-disables hands.

**Pixel placement shipped — global nav companion.** The live pixel sits small and fixed top-right on all tabs (Home, Sage, Around, You), mounted at the tab shell so it does not remount on tab switch or scroll with content. Idle / gesture / milestone / tap-mood animation runs from that instance. Current-you (no growth glow) on Home/Around/You; aspirational-you (presence glow + depth sparkle) on Sage. Home no longer renders a large centered face. The You-tab poster is identity + QR only (no large pixel).

**UI polish pass is in (poster, button borders, Sage zoom).** Poster redesigned on Ink / Paper / Steel / Bloom (shareable artifact only — app chrome stays Soft / Zen / Quest / Neon / Anime). Crisis "I'm okay, keep going" now has a 2px accent border. Soft-mode outline buttons used `theme.backgroundSelected` as a border (invisible on white); they now share `controlBorderColor`. Sage pinch-zoom is disabled on tab ScrollViews; tab chrome + SystemUI use the theme background so a zoom-out cannot flash native white.

**Wave 2 Stage 2 is in — "I'm going" + friend colors.** Opt-in `going` row per user per show (`set_going` / `night_snapshot`). A color blob appears on a show only at ≥3 people of that `show_up` hue; raw counts never leave the RPC. Faces show only when the person is going, `me.visible` is true (plan field `show`; SHOW is reserved), and they are not blocked either way. Hidden faces still count toward colors. 18+ nights call `is_at_least_age(born_on, 18)`. City stays typed (not GPS). Calgary `weekend.json` is still honestly empty until Edmtrain; type `fixture` as city for seeded test shows.

**Stage 9 first pass is in (intake core + Day 1 payoff wiring).** Fresh onboarding is identity, then 9 chip screens with a visible "N of 9". Five new ME columns (`evening_wind_down`, `energy_pattern`, `recovery_style`, `support_style`, `current_focus`) — existing `talk_style` / `show_up` / `knocks_you_off` / `morning_cue` names and types unchanged. Live row: handle `zintake9`. All 9 chips are editable afterward from the You tab / Settings (same chip UI; `show_up` still seeds color; `talk_style` still seeds Sage's tone).

**Stage 11 optional fast-entry is in.** After the 9 chips, `complete_signup` succeeds, then an optional `extra N of 9` phase (type grid + 8 vibe-check scenarios). Skip goes to Home. All 15 nullable 0–1 axes exist on ME (`autonomy`, `competence`, `relatedness`, `growth_mindset`, `locus_of_control`, `self_efficacy` plus Stage 11's nine), with the same CHECK constraints. Direct sources (`self_slider`, `self_tap`, `self_confirm`, `self_settings`) are sticky over inferred (`self_grid`, `self_situation`, `self_game`). Per-axis `last_touched` is `me.trait_touched_at` (bumps on a successful write). Null axes have no source or timestamp row and stay out of Sage prompts. Runtime fence on Read/Do/Nudge, Teach-Sage facts, and Talk. Not on poster / `peer_profile` / `night_snapshot`. Settings re-tap UI and three-path extra-axis intake remain later boxes.

**Sage voice pass is in.** Intake Q3 header is the locked question. Most-me axis labels (except steadiness / closeness) and lede are plain-language; six low-pole ranking lines and two Gut-call stems no longer duplicate. `sage.txt` is behavior + five few-shots (no "supportive coach" role). ME has `voice_preset` (default `close_friend`). Generated Read/Talk runs a keyword jargon guard before display; a hit swaps in a banked fallback and logs `ai_usage.jargon_flag` + `jargon_at` (no extra quota). Crisis card and Does-Sage-know-you bank are unchanged.

**Sage/You UI-bug bundle is in.** Sage has a small collapsible 8-ball above Talk (fixed local answers, infinite rolls) with an original glazed orb (not Mattel trade dress, not a Kenney sprite) that shakes on Ask again. Reply room shows as `X of 20 today` — no "AI" or "tokens" in the copy — on Sage and as a collapsed You-tab fold. The You-tab name lives on the poster only. The Settings crisis-line reference is a collapsible at the bottom, above credits; the active Talk crisis card is unchanged.

**Home/Talk content quality is in.** Home anti-repeat is no longer exact-string only: the generate prompt lists recent Reads/Dos and rotatable signals (knocks, facts, focus), and a topical-overlap gate drops paraphrases of the same angle. Sage Talk answers the typed line first; the day's Home card is optional background, not the reply. Recent Sage turns go with a Talk call so a follow-up can land (not the full thread). Sage still reads today's card via `useTodayCard` and does not import the card router.

**Delete-account re-verified (Aug 28, 2026).** `auth.admin.deleteUser` hard-deletes `auth.users`; `me` has no soft-delete flag and cascades with it. Checks, facts (ME column), Stage 11 trait columns, invite codes they own, `ai_usage`, `going`, Circle, chat, Sage messages, crisis flags, Apple credentials all cascade. `account_deletions` is the one retained row (no FK, audit). Apple revocation is confirmed by using the refresh token after `/auth/revoke`, not by the 200 alone.

**Stage 8 — nearly closed, three loose ends (unchanged):**
1. EAS binary 10 (`1d0d1041-9318-461f-b995-c589ac505dc2`, git `dc9ae77`) — OTA + real app icon cut. Needs `eas submit`, then install + confirm on a real device. **Do not submit binary 8 or 9.** Binary 8 (`d40e57a9`) **was already submitted and installed**.
2. Sentry native crash symbolication — still **unconfirmed** from here. Re-check once binary 10 is on-device, or by opening `e7bed112` in the Sentry dashboard.
3. Friends external testing group — Beta App Review pending on Apple since Aug 26, 2026. No action, just waiting.

**EAS Update (OTA) is live as of binary 10.** Devices on binary 10+ can receive this Sage content-model JS change via `eas update`. Devices on binary 8 or earlier cannot.

**Decision (Aug 27, 2026): Wave 1.5 and Wave 3 both start now, in parallel — intentional deviation from plan sequencing.** Wave 2 Stage 2 ("I'm going") is now live, so Night wall is unblocked for Wave 3.

**Talk output fence is in.** Gemini Talk replies run `containsFrameworkTerm` before they are shown — same check as Read/Do/Nudge and Teach-Sage facts. A hit retries generate once on the same `claim_ai_call`; a second hit is honest-empty / try-again (`kind: 'empty'`), never the blocked line. Banned phrases now include growth/fixed mindset, locus of control, self-efficacy, and self-determination. `autonomy` / `competence` / `relatedness` are not banned as standalone words.

**Fifteen axes + source rank + last_touched are in (live on Postgres).** Direct write cannot be overwritten by a later inferred write on the same axis. Confirm-upgrade is a dedicated path (`confirmTraitSource` / `confirmTraits`) that only flips the source token and `last_touched` — it never accepts a new number; `mergeTraitWrite` rejects `self_confirm`. Does-Sage-know-you UI is in (Stage 13 part 2). Settings re-tap for extra axes remains a later box except the single-axis editor on Not quite. Talk output fence already shipped.

**Library copy is in, and Sage reads it.** Ten written-once entries in `src/app/copy/library.md`. Card generation and Talk may use only **For Sage** paraphrase lines, and only when a knock, filled trait, fact, or typed line connects. Teaching/source copy never enters the prompt. No visible "library" section. Output fence unchanged. Grounding shapes framing: Sage restates the idea in its own words. A workload-heavy card's Read, Do, and Talk each phrase the same concept differently — they do not share the Library sentence verbatim.

**Explore is in (Home inner tab).** Periodic Sage observations (weekly, or on a meaningful trait/signal change) — never daily. Cached between regenerations. Cap 1 regen per local calendar day. Combines 2–3 traits only when a recent signal ties at least one filled axis; otherwise one trait or the 9 chips. Never the three agency axes together. Library-grounded; same framework fence as cards/Talk (retry once, then honest empty). Completeness is never an input. "Did this land?" writes `explore_reactions` only — never ME or trait scores. Phrase-pattern guard (`ai_usage.phrase_flag`) sits beside the existing word-level jargon guard on Explore output only; Read/Do/Talk/Nudge generation is unchanged.

**Decided Aug 28, 2026 (plan, not built — later boxes, not Stage 12):** intake three-path for extra axes (core 9 unchanged); profile completeness indicator; Dawn Reload with locks already closed. **Grok review locks are in ATO_PLAN_v2.md** (Explore 2–3 requires a recent signal + no three-agency combo + fence + 1 regen/day; Does-Sage-know-you confirm never moves the number; completeness is 9-complete vs 15-depth, not one % of a person; Talk fence retry is not a second quota charge; banned phrases for the new six, not autonomy/competence/relatedness as words; soft-ask budget of one). ATO_PLAN_v2.md is a working reference, not a locked spec — these are recorded there as current design.

**Next boxes, one at a time:**
- Wave 1.5 later boxes — completeness indicator, 3-month Settings prompt (Explore + Stage 13 delight are in)
- Wave 3 — Plugs (deal rows) + Night wall (going exists; wall can surface)

## Done
See git history for the full Stage 1–8 build log. Sage content model v2, Check window + recap text cap, Home milestone badges (Stage 13 part 1), Does Sage know you (Stage 13 part 2), Home reveal (part 3), forced ranking (part 4), scenario swipe-deck (part 5), Explore (Home inner tab + feedback table + phrase-pattern guard), nav tap moods, UI polish, Wave 2 Stage 2, Stage 9 first pass, Settings identity-chip editing, Stage 11 optional fast-entry, Sage voice pass (`sage.txt`, `voice_preset`, jargon guard), the Sage/You UI-bug bundle, the original 8-ball orb, Home/Talk content quality, nav-bar appearance theming, the Talk output fence, the six extra trait axes + direct-vs-inferred sources + `last_touched`, Library copy, and Stage 12 Library grounding are already in. This file's "On" section is the live edge of work; ATO_PLAN_v2.md and git history hold the full record.

## Left
- Submit + confirm binary 10 on device (icon, OTA, everything from today). Do not submit 8 or 9.
- Re-check Sentry symbolication (event `e7bed112` on binary 8 is unconfirmed; re-check on binary 10 or in the dashboard)
- Friends Beta App Review — waiting on Apple
- Edmtrain live data — waiting on their key approval; Around stays honest-empty until then
- Known, accepted, non-blocking: AI-quota client-bypass hardening — public-launch item, not now
- Stage 9 follow-ups (not this box): evening/energy push timing; re-intake for pre-field accounts; "something else" free-text on knocks_you_off
- Wave 2 Stage 2 flags (not guessed): 19+ uses the same 18 helper; `p_ages` is sent by the client (shows live in weekend JSON, not Postgres); emci/yeezy `born_on` is still null so 18+ nights fail closed for those rows

## Public release readiness — do not start until public launch is imminent
These are real, but they are not TestFlight work and they are not next. Leave them parked.
- App Store Connect privacy labels: answers ready in `app-privacy-labels.md` (11 types including Date of Birth), not yet pasted into App Store Connect itself
- `support@asstrollogs.com` — used across privacy.md/terms.md/landing footer as the contact address; **not yet confirmed as a real, monitored inbox**
- Terms §13 (governing law/dispute resolution) and the crisis disclaimer both still need a lawyer's pass

## Backlog (not blocking the Friends TestFlight group)
- Fantasy UI Borders pack (Kenney) — UI chrome/panels/buttons
- Monster Builder Pack — parked, needs eyes/mouth slots added to recipe before usable
- Revisit onboarding question wording if it still feels off after a fresh look
- **Decided, later Wave 1.5 boxes (see ATO_PLAN_v2 Understanding spec):** three-path extra-axis intake (play path shipped as scenarios); 3-month Settings prompt; completeness indicator (9 complete / 15 depth); Dawn Reload. Explore + phrasing-only feedback shipped. Library copy, Sage-reads-Library (Stage 12), Stage 13 badges, Does-Sage-know-you check-in, Home reveal, forced ranking, scenario swipe-deck, six extra axes, source rank, `last_touched`, confirm-upgrade lock, and Talk output fence shipped. Locks from the Aug 28 Grok review are in that spec (do not reopen in a later box).
- Crisis: relational-safety/abuse category, own resource number, parked separately
- **AI capacity hardening** — close the client-embedded-key bypass before public launch (server-side proxy or equivalent)
- Slack — parked as future ops tooling, bring up again if/when the app scales
- Push notification timing from `energy_pattern` / `evening_wind_down` (fields exist; not wired in Stage 9)

## Housekeeping
- docs/ATO_PLAN_v2.md, docs/ME.md, docs/NOW.md, docs/BUSINESS.md — Cursor maintains these directly. Commit together, `git push` immediately, never left local-only. ATO_PLAN_v2.md is a **working reference**, not a locked spec: it changes as design evolves; significant deviations are noted here or in that file, not treated as violations. Crisis / coach-label / diagnosis-avoidance / App Store floor sections in the plan are compliance-grounded and are not casually revised.
- EXPO_PUBLIC_GEMINI_API_KEY set and live-verified. Model pinned to `gemini-3.7-flash`.
- **Open decision (emci's, not technical):** Apple Developer account type — Individual vs Organization. Revisit before public submission.
- Bundle ID `com.emgens.ato` (App ID) / `com.emgens.ato.signin` (Services ID) confirmed.
- Apple client_secret JWT minted Aug 25, 2026, expires Feb 24, 2027 07:24 UTC. Regenerate around late Jan 2027. Not automated.
- Email sending on `noreply@asstrollogs.com` (Resend-verified). OTP uses Auth custom SMTP. Access-request approve emails go through Edge Function `review-access` with `RESEND_API_KEY` set as a function secret (same Resend account / from-address). `support@asstrollogs.com` used as the public contact address in legal/landing copy — inbox confirmation is parked under Public release readiness, not active work.
- Landing page live at `ato.emgens.com` — invite request form is in `landing/` (email → `access_requests`). Social handle decided as `@whatsyourato` (primary), fallback `emgensato`/`atoapp`/`heyato` per-platform if taken. Not yet confirmed reserved on any platform.
- **Intentional deviation:** the locked Ink / Paper / Steel / Bloom palette in ATO_PLAN_v2.md is discarded for app chrome. Appearance is five modes (Soft / Zen / Quest / Neon / Anime). The You-tab share poster still uses Ink / Paper / Steel / Bloom as a fixed shareable artifact. Not a bug — the plan line was updated in the same change.
- **Intentional deviation (Aug 27, 2026):** Wave 1.5 and Wave 3 start now in parallel, instead of waiting for the Wave 1 Gate then Wave 2 Stage 2. Stage 2 ("I'm going") shipped; Night wall may surface with Wave 3.
- **Around refresh secrets (Wave 2):** Edge Function `refresh-around` is deployed (`verify_jwt: false`; auth is `AROUND_REFRESH_SECRET`). Needs `EDMTRAIN_CLIENT_KEY` (apply at edmtrain.com/developer-api while signed in) and `AROUND_REFRESH_SECRET`. Cron is not scheduled until both exist in Vault + function secrets. Phone never holds the Edmtrain key. ToS: displayed cache < 24h; unmodified event `link`; do not mix Edmtrain listings with another events feed (RA/Shotgun/DICE are ticket link-outs only).

## Next 15 min
Open new Cursor chat. Founder codes + access requests are in. Landing form is live on ato.emgens.com. `/dev-lab` approve emails a single-use code (`RESEND_API_KEY` is set; live approve returned `emailed: true`). Next Wave 1.5 work: completeness, 3-month Settings. Wave 3 (plugs + Night wall) is unblocked now that going exists. Confirm binary 10 submitted/installed if not already done.
