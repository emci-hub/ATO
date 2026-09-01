# ATO IA — device test checklist

Compiled as each box lands. Same file in the repo at `docs/ATO_DEVICE_TESTS.md`. Run this whole list on a real device before TestFlight, not per box. Ordered so earlier items don't depend on later ones.

**JS for this checklist is on production OTA** group `4b669c70-ba79-433b-9f1e-2bde060ff656` (`0387ea9`, nav default 5 items), published Sep 1, 2026. 100% of the production channel — no staged rollout. **You must be on binary 10+** — binary 8 and earlier cannot receive OTA and will show the stale "Dev only." cold-start bug. Binary 10 is in TestFlight (build `1d0d1041`).

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
- [ ] Force each of the six slot kinds via the override one at a time (`crisis`, `missed_check`, `note`, `ask`, `week`, `none`) and confirm Home renders correctly for each, including `none` rendering nothing in the **primary** slot (the category teaser may still appear when it is allowed).
- [ ] Force `crisis` and `missed_check` and confirm the category teaser is absent.
- [ ] With two or more missed checks open on a test account, confirm only the single OLDEST one renders — not one card per missed day.
- [ ] Confirm MilestoneBadges and QuestGrowthBars no longer appear anywhere on Home.
- [ ] Confirm the old always-visible "This week" row is gone from Home — it should now only appear as the Sunday `'week'` slot, and only on Sunday (or via override), labeled exactly "Your week."
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

---

**All boxes complete (0–14 plus 6.5, 12.5, 13.1, 21–27).** This checklist is now the full end-to-end device pass — work through every section above in one sitting on a **binary 10+** device (it pulls OTA `4b669c70`), not per box.
