# ATO IA — device test checklist

Compiled as each box lands. Same file in the repo at `docs/ATO_DEVICE_TESTS.md`. Run this whole list on a real device before TestFlight, not per box. Ordered so earlier items don't depend on later ones.

> **⚠ Boxes 5–28 below are the HISTORICAL pass (Sep 1, 2026, OTA `0028d5f5`).** They were written before the Sep 4–13 work and their OTA reference is stale. The **current outstanding pass is the section immediately below** — start there.

---

# CURRENT PASS — outstanding as of Sep 13, 2026

**What you're on:** production OTA group `e505d827-48ed-4bbb-8f68-1ae7a4f13f85` (commit `8363b28`, published Sep 13, 2026). Binary 10+. **Force-quit and reopen the app** (swipe it away, don't just background it) — updates are fetched on cold start only.

**Everything in sections A, B and E is now on your device.** The Sep 13 server-side work (Edge Functions / secrets / DB) was already live before this OTA. Only C (needs a migration) and D (needs a new binary) remain blocked.

## A — Server-side changes from Sep 13 (live now, no OTA needed)

- [x] **`ai-generate` v9 — the one that matters most.** **CONFIRMED WORKING Sep 13, 2026** via `check:card-live` (Edge Function path, real Gemini output, provider `gemini`, 3 days generated with genuine topical variety — not bank content). The redeploy carrying the ongoing-round timeout fix (`6f6bb61`) is healthy. Note: an in-app check on a thin/day-2 account will show BANK content instead (check_count < 3 routes there regardless of `ai-generate`'s health) — that's expected, not a failure; `check:card-live` is what actually exercises the deployed function.
- [ ] **Ongoing-round timeout (the reason for that deploy).** Finish the 50-question intake (or use a dev intake-stage preset to reach 50/50), then let the ongoing round auto-start. Confirm it releases 25 questions without a timeout/Sentry error — this is the exact failure the deploy was meant to fix.
- [ ] **7-tap dev unlock.** You tab → tap the version number 7× → enter the `DEV_UNLOCK_PASSWORD`. Confirm it unlocks dev tools. Note the field is `autoCapitalize="none"` and the compare is exact — type the capital and the symbol deliberately. (Currently a no-op in practice since `PRE_LAUNCH_DEV` already shows dev tools; the real test is that a *wrong* password is rejected and a correct one returns `ok`.)
- [ ] **QA override invite code.** Sign up a throwaway account using the override code. Confirm it is accepted. Also confirm the signup lands with `referred_by = null` and no `invite_codes` audit row — that's expected for the override path, not a bug.
- [ ] **Dev-test account password.** Sign in as `ato-dev@example.com` / `@atodev` with the new password. Confirm the old `ATO-dev-user-2026` no longer works.

## B — Already shipped in your current OTA, never device-verified

Everything here is sitting on your phone right now and just needs exercising.

- [ ] **Questions batch-save (Sep 11).** Answer questions in the 50-question intake. Confirm there is **no fade/dim on every tap** (the old per-answer save), that "Answered" stamps immediately, and that a page's answers only save when you press Next Page. Kill the app mid-page and confirm nothing is silently lost.
- [ ] **Ongoing-round paged UI (Sep 11).** Once a round exists, confirm it renders as a real pager — "Page X of Y", 5 per page — and that it *replaces* the finished 50-question pager rather than stacking below it. Test reroll on a row and skip.
- [ ] **Onboarding no longer shows "Add a bit more" (Sep 11).** On a fresh signup, confirm the flow is account info → 8 chip questions → Home. The 8-scenario screen should not appear.
- [ ] **"Reset to fresh signup" for @atodev (Sep 11).** In Dev Lab → You, run it (type `atodev` to confirm). Confirm the app actually lands back on the "Introduce yourself" onboarding screen and you're still signed in.
- [ ] **Legends "test persona" strip.** Signed in as `@atodev`, confirm the strip appears on Legends and that swapping archetypes actually changes the matched legend.
- [ ] **Category picker + Legends gate + completeness gate (Sep 4 batch).** Confirm the Questions category picker renders that category's bank questions as a browsable list with "N of 48 answered"; confirm Legends shows the locked state with an "Answer Questions" CTA when the profile isn't settled; confirm Explore observations / Sage Title / Sage insight all lock with copy rather than degrading.
- [ ] **Staleness fixes (Sep 4).** Settle your last axis and confirm the locked surfaces unlock **in the same session**, without backing out of the screen. This was the actual bug — they used to stay locked until unmount.
- [ ] **Category statements prompt (Sep 10).** On an account with a long/rich profile, generate category statements and confirm they read correctly and aren't truncated or generic. Explicitly not yet tested against a real long-profile case.

## C — Was blocked, now unblocked

- [ ] **`wave65` handle-collision dev account (`@atodev2`).** **Migration applied Sep 13, 2026, confirmed live** — `handle_taken('atodev2')` returns `true` via a direct RPC call. Remaining: confirm the Dev Lab "Handle collision" panel itself (not just the raw RPC) shows it as taken — that's the actual UI path a dev would use.

## D — Blocked: needs a NEW BINARY BUILD (not an OTA)

- [ ] **EAS env var deletion (Sep 13).** `EXPO_PUBLIC_GEMINI_API_KEY` and `EXPO_PUBLIC_GEMINI_MODEL` were deleted from the production EAS environment. **Env vars are baked in at build time, so an OTA cannot test this** — it only takes effect on the next EAS build. On that build, confirm AI generation still works (the model is chosen inside `ai-generate` now, so it should be unaffected). `EXPO_PUBLIC_MODEL_PROVIDER` was deliberately **kept** — it is still read live by `src/lib/ai/config.ts:58` and `src/lib/voice/config.ts:26`.

## E — Shipped in OTA `e505d827` (Sep 13)

- [ ] **parse.ts silent-catch logging (commit `40a9dbc`).** Logging-only, no user-facing behavior — there is nothing to *see* in the UI. A malformed AI question response now prints `[questions] batch response was not valid JSON (rawLength=…)` instead of vanishing silently. Only observable in dev logs, so treat this as "no news is fine" rather than an active test step.

## F — Open bugs with no written detail (investigate before testing)

- [ ] **Gut Call regression** — listed as open in `docs/NOW.md` with no reproduction steps recorded. Needs someone to say what "regression" means before it can be tested.
- [ ] **Live Talk failure** — same: listed as open, no detail. Note section A's Sage Talk check may already surface it.

---

# HISTORICAL PASS — Boxes 5–28 (Sep 1, 2026)

**JS for this historical checklist was on production OTA** group `0028d5f5-3797-417e-b345-9005cb17ca5b` (`41fcec4`, core intake one page), published Sep 1, 2026. **You must be on binary 10+** — binary 8 and earlier cannot receive OTA and will show the stale "Dev only." cold-start bug. Binary 10 is in TestFlight (build `1d0d1041`).

---

## Box 5 — One ask, one place

- [ ] Set ask override to `sage_knows` (`/dev-lab` → Card → Ask kind override). Reload Home.
      Confirm: one frame, header reads exactly "One thing, then back to your day.", no "Does Sage know you?" text visible anywhere.
- [ ] Answer it (Still fits / Not quite). Confirm the trait actually moved — check the band on You, or the row in Supabase.
- [ ] Set override to `ranking`. Reload Home. Confirm one frame, no "Most me" label. Drag an order, save, confirm it wrote (`self_tap` source on the touched axis).
- [ ] Set override to `scenario`. Reload Home. Confirm one frame, no "Gut call" label. Tap a choice, confirm the axis it targets actually updates (e.g. `me.autonomy`).
- [ ] Clear the override entirely. Reload Home. Confirm Home falls back to the real `resolveAsk` result — either a genuine unspent-week ask, or nothing if the week's already spent.
- [ ] Confirm You no longer shows a ranking card anywhere on the screen.
- [ ] Confirm Sage no longer shows a "Does Sage know you?" card anywhere in the toys row.
- [ ] Screenshot: Home with an Ask rendered, Home with no Ask, You (no ranking), Sage (no sage-knows).

---

## Box 6 — Questions to its own screen

- [ ] From You, tap "Tell Sage more." Confirm it pushes to a new screen, not a fold on Home.
- [ ] Confirm the screen title reads exactly "Tell Sage more" and the interaction is always expanded — no collapse/fold control on this screen.
- [ ] Confirm Home no longer shows a Questions fold anywhere.
- [ ] Answer a question on the new screen. Confirm it still writes (either the cached-item path or a trait write via `self_situation`), and confirm it does NOT consume the weekly Ask slot — check that an Ask can still appear on Home the same week.
- [ ] Screenshot: You tab showing the "Tell Sage more" row, and the pushed screen itself.

## Box 6.5 — Dev Lab sections

- [ ] Open `/dev-lab`. Confirm four labeled sections: Home, Sage, You, System.
- [ ] Confirm Today slot override and Ask kind override now render under Home, not a generic "Card" section.
- [ ] In each of the four sections, tap "Force test error." Confirm each throws a distinct error containing its section name, and confirm it actually reaches Sentry (check the Sentry dashboard for four separate events, not one).
- [ ] Confirm `/dev-lab` access is unchanged — still root + granted testers, still opens locally under `__DEV__`.
- [ ] Note: PushTestCard and SentryTestCard remain on the You tab (`you-dev-tools.tsx`), not physically inside `/dev-lab`. Confirm both still work from there.

## Box 7 — Explore is a real tab

- [ ] Confirm the bottom tab bar reads, in order: **Home / Sage / Explore / Around / Circle / You** (Circle only after a connection).
- [ ] Open the Sage tab. Confirm it is **clean chat only** — 8-ball + the conversation, with nothing else stacked above the thread (no title card, no categories, no story, no observations, no "N of 16 settled", no Notes spend, **no "Explore ›" header button**).
- [ ] Tap the **Explore** tab directly. Confirm it opens the Explore content in place (tab bar stays visible — it is not a pushed screen, there is no Back button).
- [ ] On the Explore tab confirm the order top to bottom: "Explore" header with "N of 16 settled", title card, Categories (full detail fold), The Story, Notes insight spend, then the observation bubbles.
- [ ] Confirm the observation bubbles render there, each with "Did this land?" yes/no and the "Noted." ack.
- [ ] Confirm Explore observations are not on Home and not on the You tab.
- [ ] In `/dev-lab` → Sage section, tap "Force regenerate Explore." Confirm it shows fresh observation text with its tagged axis inline.
      **F5 check (known, deferred):** read the regenerated text against its tagged axis — does the prose actually match the axis name (e.g. does an `openness`-tagged entry read like openness, not like sleep/recovery)? This is not fixed yet (Box 14). Use this tool to gauge how bad it looks on the Explore tab.
- [ ] Confirm a Talk message in Sage still behaves normally — reply quality/tone should be unchanged, since Talk still uses the narrower 5-check history, not the fuller Explore history.

## Box 8 — Home strip-down, two slots (deliberate override)

**Dated reversal (Aug 31, 2026):** Box 8 originally locked Home to **one thing** below Did/Skip. Wave 21 **deliberately** extends that to a second, small, collapsed category teaser. This is not drift. Crisis and missed-check stay alone — the teaser never sits next to those two safety slots.

- [ ] Open Home fresh. Confirm render order top to bottom: header, Read/Do/(Nudge), Did/Skip, then the primary slot (crisis / missed_check / note / ask / week / none).
- [ ] When the primary slot is **crisis** or **missed_check**, confirm **nothing else** renders below it — no category teaser, no second card. Those two stay full priority, alone.
- [ ] When the primary slot is **note**, **ask**, **week**, or **none**, confirm a second small collapsed row can appear: category name + one line. It does not jump to Explore on first tap — tap peeks inline, then a clear path into Explore.
- [ ] Confirm the teaser does **not** change on every app-open; it refreshes once per local day.
- [ ] Confirm Nudge caps at one extra line — never a fourth line of text in the card block.
- [ ] In `/dev-lab` → Home, with the slot override set to `off`, confirm the new inline readout shows the six raw inputs (crisisActive, missedCheck, noteAvailable, noteOpenedToday, askPending, isSunday) and the kind it resolved to. Use this to sanity-check *why* Home is showing what it's showing on your real test accounts.
- [ ] Force each of the six slot kinds via the override one at a time (`crisis`, `missed_check`, `note`, `ask`, `week`, `none`) and confirm Home renders correctly for each, including `none` **and** `week` rendering nothing extra in the **primary** slot (the category teaser may still appear when either is allowed) — `week` no longer has its own row (see below).
- [ ] Force `crisis` and `missed_check` and confirm the category teaser is absent.
- [ ] With two or more missed checks open on a test account, confirm only the single OLDEST one renders — not one card per missed day.
- [ ] Confirm MilestoneBadges and QuestGrowthBars no longer appear anywhere on Home.
- [ ] Confirm Home shows exactly one link to `/week`, the always-visible "This week" row — the Sunday-only `'week'`-slot row ("Your week.") was removed (2026-09-13) as the duplicate; `'week'` still exists as a `slotKind` value (it still un-gates the category teaser same as `note`/`ask`/`none`) but no longer renders anything of its own in the primary slot.
- [ ] Confirm the Note ("reveal") still opens correctly from the slot and that reopening it same-day doesn't re-show it in the slot (falls through to the next slot kind instead).
- [ ] Confirm the teaser name has a small "?" that explains the *concept* (not the person's data). Draft copy — unreviewed.

## Box 9 — You regroup: tone, badges, account

- [ ] Open You. Confirm one card titled exactly "How Sage sounds" holding both the talk_style picker and the voice preset picker, each with its own live preview on tap (before saving).
- [ ] Confirm "How you show up" now shows 8 chips, not 9 — talk_style should not appear there anymore.
- [ ] Confirm MilestoneBadges renders on You, directly under the Share block, collapsed by default (tap to expand).
- [ ] Confirm QuestGrowthBars renders right after the badges strip.
- [ ] Confirm timezone now lives inside a collapsed "Account" fold near the bottom, not as a top-level row.
- [ ] In `/dev-lab` → You, use "Growth preview" to set an arbitrary check_count and fact count. Return to You and confirm the badges/growth bars reflect the preview values. Then clear the preview and confirm real values return.
- [ ] Confirm the growth preview tool did NOT write any real Checks or facts rows (spot check in Supabase if unsure).
- [ ] Confirm MilestoneBadges and QuestGrowthBars no longer appear on Home (re-check from Box 8 — should still hold).

## Box 10 — Weeks entry and band provenance

- [ ] On You, confirm a "Weeks" row directly after "Tell Sage more" that pushes to `/week`.
- [ ] Tap a filled trait band. Confirm the detail view shows the bar, the two endpoint phrases, and exactly: "This came from a question you answered. It can change."
- [ ] Confirm the band detail never shows an axis name, a raw number, or a source token (self_slider, self_situation, self_game, self_tap, self_settings) anywhere.
- [ ] Confirm an unfilled axis has no band and no detail — no gap line, no placeholder.
- [ ] In `/dev-lab` → You, use "Band detail" to step through every filled axis for your test account without scrolling You manually. Confirm it's read-only — it shouldn't change any trait values.

## Box 11 — AI consent as interstitial

- [ ] On a fresh/reset account (ai_consent null), trigger Dawn. Confirm a full-screen modal appears and cannot be dismissed without answering — no back-button or backdrop-tap escape.
- [ ] Same test on Sage: reach a point where consent is pending, confirm the same modal blocks the screen until answered.
- [ ] Answer "yes." Confirm the modal closes and the underlying screen becomes usable, and confirm a real model call can now actually fire (e.g. get a real Dawn card or Talk reply, not bank content).
- [ ] In `/dev-lab` → System, use "Reset AI consent" to force ai_consent back to null. Confirm the interstitial re-triggers on your next visit to Dawn or Sage.
- [ ] On an account with consent explicitly denied, confirm content stays bank-only and Sage still shows "Talk is off" — this must not have changed.
- [ ] On You → Account, confirm the "Sage's AI" row reads "On" / "Off" / "Not set yet" correctly matching the account's actual state, and confirm toggling it after the first answer still works via the normal settings path (not the dev reset tool).
- [ ] With airplane mode or a network blocker, confirm consent-null still blocks Dawn/Talk from ever attempting a model call — this is the router-level gate, should be unaffected by the interstitial UI change.

## Box 12 — Support row promoted on You

- [ ] On You, confirm the support fold now sits directly after "Weeks" and before the trait bands section — not buried near the bottom anymore.
- [ ] Confirm the fold title reads exactly "If you need someone now."
- [ ] Open it and confirm it is still the region picker (Auto / US / CA / Other) — it does not render the Talk crisis card.
- [ ] On Sage, confirm a low-key Support tap (lifebuoy + "Support") sits under the composer and opens the same crisis support modal. No keyword or message required. Same copy, same numbers, same "I'm okay, keep going."
- [ ] With Talk off (consent denied), confirm that Support tap is still visible at the bottom of Sage and still opens the same modal.
- [ ] Confirm opening Support this way does NOT create a `crisis_flags` row (spot check Supabase).
- [ ] Trigger a real crisis keyword in Talk (using whatever your approved test phrase is) and confirm the interrupt card still appears in the thread and blocks a model call, unchanged from before this box.
- [ ] Confirm Dawn's crisis interrupt path still works the same way, unchanged.
- [ ] Note: no dev-lab trigger exists for this yet — testing the crisis interrupt still requires using a real flagged phrase. Cursor flagged this as needing a deliberate fencing decision before building; not in scope for this box.

## Box 12.5 — Dev Lab crisis card preview (fenced)

- [ ] In `/dev-lab` → System, tap "Preview crisis card." Confirm CrisisCard renders inline with real copy, no keyword typed.
- [ ] Confirm this control does NOT appear anywhere in Talk or Dawn — only inside `/dev-lab`.
- [ ] Confirm using the preview does NOT create a `crisis_flags` row (spot check Supabase).
- [ ] Confirm the control disappears/is unreachable in a production (non-`__DEV__`) build, even for a root/granted tester account.
- [ ] Separately, confirm the REAL crisis path still works: trigger a genuine flagged phrase in Talk, confirm the interrupt still fires and still logs a `crisis_flags` row as before.

## Box 13 — O5 honest-empty Today
**⚠ Known issue as of Box 13: Did/Skip fails on this screen until Box 13.1 lands. Do not treat this box as testable end-to-end until 13.1 is also done.**

- [ ] On a consent-off account past day 3, confirm Home shows exactly: "No card today. Sage only writes these with your say-so — you can turn that on any time in You."
- [ ] Confirm no bank card, no repeated previous card, no fabricated content appears.
- [ ] Confirm days 1–3 and consent-on accounts are completely unaffected — still show real cards.
- [ ] In `/dev-lab` → Home, confirm the slot-input readout now also shows `pastDay3`, `consentNotTrue`, `noBankCard`, `honestEmpty` for the current account.
- [ ] **After 13.1 lands:** tap Did/Skip on the honest-empty screen and confirm it actually saves (does not error), and confirm it correctly counts (or doesn't — check 13.1's report) toward check_count/badges.
- [ ] Confirm this state never reaches the widget or push (should be silently true — nothing to see, which is the point).

## Box 13.1 — record_check accepts honest-empty Checks

- [ ] Tap Did or Skip on the honest-empty Today screen. Confirm it now succeeds instead of erroring.
- [ ] Log a normal Check (real bank or model card) with actual read/do text. Confirm it still works exactly as before.
- [ ] Confirm a real card's Check still rejects blank read/do (the relaxation is scoped to `p_no_card` only).
- [ ] **Decided:** honest-empty Checks count toward `check_count`, presence tier, and badges — same as any other Check. Presence is a "did you show up" metric, not a "did you get real content" metric; depth (facts) is the separate axis for that. No follow-up needed.
- [ ] Confirm valence/tomorrow's-tone still reads Check *status* (not read text) — a no-card skip should still soften tomorrow's tone the same way a real skip would.
- [ ] Confirm Circle's peer row shows nothing broken for a peer who logged a no-card Check (should show status only, no leaked null-handling bug).
- [ ] **Confirmed already, no need to re-check:** this migration has been applied to the live Supabase project (`aijzsmupaaaxjctfgwpl`). No manual step needed unless testing against a different environment.

## Box 14 — Explore axis grounding

- [ ] In `/dev-lab` → Sage → "Force regenerate Explore," run it on a real device session (not code review) at least 3 times. For each, read the tagged axis and the body — do they actually match, or does the body drift onto something else (like the old sleep/openness mismatch)?
- [ ] Specifically re-test `openness` if you can, since that was the original confirmed mismatch. Confirm it now reads as curiosity/new-experience, not just sleep/recovery wearing the openness label.
- [ ] Confirm the grounding line itself never leaks into the rendered text — no axis name, no "you are," no framework name, in any entry you generate.
- [ ] If a regeneration ever comes back empty/null (this happened once during Cursor's own spot-check on `conscientiousness`), note it — not expected to block anything, but worth flagging if you see it repeat.
- [ ] This closes F5. No further action expected unless a live mismatch turns up. JS is on OTA `8771f505-5cf5-4652-8d89-42f2ad57f05c` — regenerate on a binary 10+ device after it has pulled the update.

## Box 22 — Dawn categories, Explore combine, Levity, The Story

All copy on this box is **unreviewed**. Do not treat Category/Levity/Story lines as final.

- [ ] On a thin/new account (none of Steadiness, Agency, Drive settled): open Dawn/Home generated Read. Confirm it still draws from knocks/facts/focus, not empty, and Do is still `After you {morning_cue}, …`.
- [ ] On an account with Steadiness settled: confirm a generated Read may lean on that merge, still never names the category, and Do is unchanged.
- [ ] Confirm a category-sourced Read still drops on topical-repeat / cut-after-crisis / two-cuts / cruel-cut / framework-echo the same as any other Read.
- [ ] Open the Explore tab directly. Confirm a Categories summary (full detail) sits above The Story and the observations. Confirm a generated Explore line does not paraphrase that Categories card.
- [ ] Confirm Explore never combines more than two categories, and never pairs all three of growth_mindset + locus_of_control + self_efficacy as raw axes.
- [ ] On You → Categories, confirm Levity appears as a **bar** (not a map) once playfulness + a conflict axis have settled. Love / closeness remains the only conflict-adjacent map.
- [ ] On the Explore tab, confirm The Story fold (collapsed) sits under Categories. Open it only when Gemini actually wrote one. Confirm: no generic fallback paragraph when the model is unreachable; the fold is simply missing. Confirm the prose never names a category. If told-vs-played tension exists, confirm it is hedged, not an accusation, not smoothed away.
- [ ] Flag every Story paragraph and every new Levity/Dawn/Explore line for emci before treating any of it as shippable.

## Box 23 — Shared friend-voice style checklist (all 5 surfaces)

- [ ] Open a generated Dawn Read (Home/dawn), an Explore observation, the Sage Title + its Category lines, and The Story. For each, confirm the copy reads like a friend who noticed something: never "you are", never self-description ("this reflects", "a gap worth", "the data shows"), never "always" (prefers lately/this week/for now).
- [ ] Confirm a title or category summary that names more than one quality joins them with but/yet/and — never a plain comma list. Example to match: "Grounded and self-driven, but happiest doing it alone", not "Steady, driven, and independent".
- [ ] Confirm multi-trait sentences read as one whole person (Rule 6) and single-idea sentences stay one idea (Rule 3).
- [ ] Confirm the checklist text never appears in rendered output (it's prompt-only scaffolding).

## Box 24 — Circle Explore handshake (consent-gated comparison)

- [ ] With two test accounts, scan a QR / paste a link to connect. Confirm Circle appears for **both** accounts and is not present before the connection.
- [ ] On account A, tap "Share categories with them" (per-friend path). Confirm the copy flips to "Waiting for them to opt in too." Confirm **no** comparison is visible yet.
- [ ] On account B, confirm it shows the opt-in for A but no cards until B also opts in.
- [ ] Opt in on B. Confirm both now see "You both opted in. Tap Compare to look side by side." and "Compare categories" works.
- [ ] Confirm compare shows each ready category's line for You vs Them side by side — and **never** Full Profile axes, trait numbers, or anything not in the cached `peer_category_pack` (title + category lines only).
- [ ] Close Friends pool: on account A, enable Close Friends (`close_friends_share`). Confirm the per-friend toggle becomes "Visible in Close Friends — no per-person toggle in this group" once B is also in the pool.
- [ ] Unfriend from one side. Confirm Circle disappears for both and the connection row is gone.
- [ ] Spot check Supabase: `category_share` / `close_friends_share` rows flip only with consent; `peer_category_pack` returns cached summaries only.

## Box 25 — Thin-profile behavior (live 6/15 rule)

- [ ] **Actual live rule:** thin is `settledCount / TRAIT_AXES.length < 6/15`. With 16 axes today that means **fewer than 7 effective settled report-track axes = thin** (6/16 = 0.375 < 0.4; 7/16 = 0.4375 ≥ 0.4). Stability-weighted, report-track only — gut-call never counts.
- [ ] On a brand-new account (0 settled): open Sage. Confirm the "N of 16 settled" line reads 0/16 and coaching copy is honest/thin (does not invent specifics, does not nag).
- [ ] Confirm a thin account's Talk replies coach more generally and do not invent specifics.
- [ ] Fill exactly one axis with 3+ self-reports so it settles. Confirm Sage still counts it thin.
- [ ] Settle 7 axes. Confirm the account is **no longer** thin: Sage coaching deepens, Full Profile shows `7 of 16 settled`, and The Story fold is allowed to generate (if Gemini is reachable).
- [ ] Confirm a gut-call (`self_game`) answer on an axis does **not** count toward settled (report-track only) — Sage's count stays put.
- [ ] Confirm The Story fold is absent on a thin account even when Gemini is reachable (thin gate holds).

## Box 26 — Tokens, Full Profile depth, trait_history timeline

- [ ] Log a Check. Confirm Notes balance went up by 3 (check-in earn), and the `token_events` ledger shows a +3 row.
- [ ] Play a game round (Gut call). Confirm +5 and a ledger row.
- [ ] Spend 8 Notes on "A closer look from Sage." Confirm a new insight renders, balance drops 8, ledger shows -8, and no trait value changed.
- [ ] With 12+ Notes, spend on Full Profile Depth for one axis. Confirm a real ranking pick or gut-call fires for that axis, the 48h per-axis cooldown blocks a second depth spend on the same axis, and balance drops 12.
- [ ] Confirm you can never buy Notes anywhere in the app (no purchase path).
- [ ] Open You → Full Profile. Confirm every currently-defined axis shows, null axes say "not answered yet", and each filled axis has a 2-letter code and an expandable "How this has shifted" timeline from `trait_history`.
- [ ] Tap a filled axis to edit. Confirm 8s undo works (no persist/history if undone) and re-tapping the same axis immediately after loses undo.
- [ ] Confirm Full Profile stays fully viewable at 0 Notes — spend only gates new depth/insight, never viewing.

## Box 27 — Nav bar customization (edit mode)

- [ ] Confirm the bottom bar shows, by default: **Home / Sage / Explore / You / More** — 5 items, not 6. Around and Circle are in More. Circle appears only after a connection; before that it is not shown anywhere, but Around still is.
- [ ] Long-press a reorderable tab (Explore/Around/You) → "Edit navigation" opens full-screen. Confirm Home and Sage are shown as pinned and there is a **Swap** affordance, not a drag handle.
- [ ] In edit mode, drag the grip on a tab and confirm it reorders live; tap **Done** and confirm the bar reflects the new order after leaving edit mode.
- [ ] In edit mode, tap "More" on a bar item → it moves into More. Tap "Bar" on a More item → it moves back. Confirm Done persists both.
- [ ] Confirm Home and Sage **cannot** be moved into More in edit mode — there is no affordance for it.
- [ ] Confirm **More is always the rightmost** tab and cannot be reordered.
- [ ] Kill the app and relaunch. Confirm the custom order survives the restart (persisted in AsyncStorage).
- [ ] Unfriend the last peer (Circle disappears) then reconnect. Confirm Circle returns to its stored slot (in More by default), not a new random position.
- [ ] Confirm the pixel nav companion stays fixed top-right on every tab and does not remount on tab switch.

## Box 28 — Sage toys pinned above the chat scroll (OTA `0ff16d9d`)

- [ ] Open the Sage tab. Confirm the 8-ball and "What Sage remembers" (facts) card render **above** the message thread and do not scroll away — swipe the message list up/down and confirm the 8-ball/facts card stay fixed in place while only the messages scroll underneath.
- [ ] Tap the facts card to expand it (if you have any stored facts) or tap it open/closed with none. Confirm expanding/collapsing it does **not** jump or scroll the message thread.
- [ ] Send a new message to Sage. Confirm the thread still auto-scrolls to the bottom to show the new message and Sage's reply (this is the behavior that must survive — only the resize-triggered auto-scroll was removed, not the new-message one).
- [ ] Open the keyboard (tap the composer). Confirm the thread still scrolls to keep the latest message visible above the keyboard.
- [ ] Screenshot: Sage tab mid-scroll showing the 8-ball/facts card fixed at top with messages scrolled underneath.

---

**All boxes complete (0–14 plus 6.5, 12.5, 13.1, 21–28).** This checklist is now the full end-to-end device pass — work through every section above in one sitting on a **binary 10+** device (it pulls OTA `0028d5f5`; Box 28 specifically needs OTA `0ff16d9d` or later), not per box.
