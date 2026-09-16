# Judgment Pass

**Date:** 2026-09-12 · **Model:** Opus 5 · **Input:** `docs/field-inventory.md`, `docs/screen-map.md`, `docs/dead-weight.md`, `docs/built-not-connected.md`

The cataloging pass produced facts and deliberately withheld opinions. This doc is the opinions. Nothing here has been built — it is for emci to approve, reject, or park.

**Headline calls, up front:**
1. **Dead weight: agree, nothing actionable yet.** One thing to do first: get a live schema dump. Until then a real audit of `me`'s ~70 columns isn't possible.
2. **access-requests.ts: leave it dev-only.** Building a screen now is building for a mode the app isn't in.
3. **The notification idea: not as described — but a better version of it is worth building.** ATO already sends ~15 notifications/week, which is *triple* the level where research shows users start switching them off. The fix isn't more notifications at random times; it's replacing the weakest existing notification with the category insight, and giving users a preferences screen (which the app currently has none of). Details in §5.

---

## 1. Research notes

### Personalized / daily-insight apps

**Co-Star** — the daily push *is* the product. One notification a day, "your day at a glance," written by human writers from templated planetary data, deliberately short and voicey. Two lessons, one positive and one cautionary:
- The notification is the whole daily surface for most users. They open the app far less than they read the push. ([Inverse](https://www.inverse.com/article/54991-costar-astrology-app-how-it-works))
- Co-Star's tone shift to aggressive/random-feeling copy became a meme *and* a backlash, including a notification that landed badly during the 2020 protests. Randomized, unreviewed, voicey copy going out unattended is a real reputational risk, not a theoretical one. ([Daily Dot](https://www.dailydot.com/unclick/co-star-astrology-app-push-notifications-memes/), [Jezebel](https://www.jezebel.com/why-are-co-stars-daily-notifications-so-rude-1833747335))

**The Pattern** — the model closest to ATO's. Profile is split into three standing sections (instincts / growth / relationships), each broken into subsections. On top of the stable profile sits **"Your Timing"** — time-bounded cycles personal to the user, with a stated phase and a stated duration. Daily notifications push into the cycle currently active ("Go Deeper"), not into a random part of the profile. The insight surfaced is the one the app thinks is *live right now*. ([Options/The Edge](https://www.optionstheedge.com/topic/machines/pattern-astrology-app-offers-hyper-personalised-insights-about-your-personality), [Newsweek](https://www.newsweek.com/what-pattern-everything-you-need-know-about-app-channing-tatum-freaking-out-over-1449099))

**CHANI** — rhythm is explicit and published: Affirmation of the Week, Tarot Card of the Week, and the week-ahead podcast all drop **Sunday 6:00am PT**, every week. Users know when content arrives. Depth lives in an on-demand library (meditations, affirmations) that is never pushed. ([CHANI support](https://chaninicholas.zendesk.com/hc/en-us/articles/4406728790419-How-often-is-the-content-updated))

**Pattern across all three:** the *profile* is deep and browsable; the *push* is one thing a day, chosen for relevance, not sampled at random. Depth is pulled, not pushed.

### Habit / check-in apps

**Way of Life** — the most directly useful finding in this whole research pass. It **adapts reminder frequency to the user's own answer history**: consistent "Yes" answers gradually *reduce* reminder frequency; frequent "Skip" answers increase them. It also prompts proactively — "You're consistent! Want to reduce reminder frequency?" And its primary nudge is a passive in-app badge count, not a push. ([wayoflifeapp.com](https://wayoflifeapp.com/), [Cohorty](https://www.cohorty.app/blog/best-habit-tracker-apps-with-reminders-smart-notifications-2025))

**Streaks / streak-freeze pattern** — the widely-copied answer to a missed day is a *freeze*: earn one by being consistent, and a single miss auto-consumes it instead of resetting to zero. The framing in the category is explicit — what happens on a missed day is the make-or-break UX detail, and a hard reset makes people abandon the app entirely. ([Strik](https://play.google.com/store/apps/details?id=com.hugocodes.strik), [HabitIt](https://habitit.app/blog/why-streaks-are-a-trap))

Note: ATO already sits on the right side of this. `record_check` accepts today *or up to 2 days back*, and `push-copy.ts` has a hard regex (`copyHasFakeUrgency`) banning streak/loss language. ATO's version of "forgiveness" is already built in at the data layer. That's a genuine strength and an argument *against* importing streak mechanics later.

### Notification timing & frequency (the decisive numbers)

- **46% of users disable notifications after receiving just 2–5 per week.** Frequency and churn visibly diverge past ~5 sends/week. Apps sending 2–3 targeted pushes/week beat apps sending 7+ on click-through *in aggregate*, not just per-push. Rule of thumb in the sources: cap at ~5/week. ([PushPilot frequency/churn data](https://pushpilot.ai/blog/push-notification-frequency-churn-data), [Pushwoosh](https://www.pushwoosh.com/blog/best-time-to-send-push-notifications/))
- **If you are above 4–5 sends/week, reduce frequency *before* optimizing timing** — users who've mentally tuned you out won't engage regardless of send time.
- **Per-user send-time optimization earns roughly 3x the open rate of fixed timezone scheduling**, but it requires knowing when the user is actually active.
- **A single "Allow notifications?" toggle is considered inadequate UX as of 2026.** Apps with a per-category preferences page show consistently lower total opt-out rates than apps with one on/off switch — people mute a category instead of killing everything. ([Pushwoosh strategy](https://www.pushwoosh.com/blog/push-notification-strategy/), [MoEngage](https://www.moengage.com/learn/push-notification-best-practices/), [Braze](https://www.braze.com/resources/articles/push-notifications-best-practices))

**Technical constraint that shapes everything below:** ATO uses **local** notifications only (`expo-notifications`, three fixed identifiers in `push.ts`). There is no push server and no Expo push token. iOS caps an app at **64 pending local notifications**, and anything scheduled locally must have its text decided *at scheduling time* — the app cannot generate copy while it is closed. ([Apple Developer Forums](https://developer.apple.com/forums/thread/811171), [Expo docs](https://docs.expo.dev/versions/latest/sdk/notifications/))

---

## 2. Dead weight — final call

**Agreed: nothing is confirmed dead, and nothing should be deleted in this state.** The cataloging pass checked each "loaded, not rendered" field against the rest of `src/` and every one turned out to be live. I'd add that the recurring pattern it found — `PeerMe.talk_style`, `NightFace.name`, `public_profile.talk_style` all loaded but not shown on peer-facing screens — reads to me as **deliberate privacy design, not sloppiness**: your own talk style is yours (set on You), other people's isn't shown to you. That's a good default. Don't "fix" it by rendering them.

**The one thing worth doing, and it's a prerequisite, not a cleanup:**

> Run `supabase db dump` and commit the schema for the 4 baseline tables (`me`, `checks`, `crisis_flags`, `connections`) plus the `public_profile` RPC.

Why this matters beyond tidiness: `me` has ~70 columns and 81 `ALTER TABLE` references, it is the table every AI surface reads from, and **there is no file in the repo that says what's in it.** Right now the only description of `me`'s shape is a TypeScript interface — which is a *claim* about the database, not the database. If those two ever drift, nothing catches it. Everything downstream of this doc (a real per-column audit, any future migration, any new AI surface) is guessing until this exists.

**One lower-confidence item I would check, but only after the dump:** `entry.chips` / `entry.signalKind` / `entry.sortIndex` on `explore_entries` — the cataloging pass could not trace a second call site beyond `explore/store.ts`'s own row mapping. That's the only genuine "maybe unused" in the whole inventory. It is three fields on one table, so the payoff is small; treat it as a five-minute check during the post-dump column pass, not a task of its own.

**Do not run a delete pass on `me` before the dump.** There is no upside and the downside is a column that some AI prompt quietly depends on.

---

## 3. Built-not-connected — final call

### access-requests.ts — **leave it dev-only. Don't build a screen.**

The reasoning is simple and I have high conviction on it: `app_config.signup_mode` is `invite_only`, so `access_requests` receives **zero rows in production today**. A user-facing request-access screen would be a screen that no user can reach, for a state the app is not in. That's not connecting a buried feature; that's building speculatively.

The genuinely useful thing here is much smaller. Right now the day `signup_mode` flips, the app silently has no submit path and no non-dev review path — and nobody would notice until requests started piling up invisibly. So:

> Add one line to `docs/GOTCHAS.md`: *"Switching `app_config.signup_mode` off `invite_only` requires building a user-facing request-access screen and a non-dev review surface first. `src/lib/access-requests.ts` is wired only into `dev-lab.tsx`."*

That converts a landmine into a checklist item for the cost of one sentence. Build the screen when the mode change is actually on the roadmap, not before.

### The "worth a look later" items — my read on each

| Item | Call | Why |
|---|---|---|
| `VoiceCardResult.dev` rendered on 4 dev surfaces | **Leave it.** | Four dev labs each showing the same trace line is mild duplication in code that never ships to users (`PRE_LAUNCH_DEV`-gated, and `check:release-mode` enforces the flag). Consolidating is pure refactor with zero user-facing benefit and nonzero risk. Not worth touching. |
| `around-lab.tsx` has no coverage of `going`/colors/faces | **Worth fixing — small, real.** | This is the one dev-tooling gap with actual teeth. The going/colors/faces path writes to a live table (`going`) via `set_going`/`night_snapshot`, involves an **age gate** (`showRequires18` + `me.born_on`), and has no smoke test anywhere. An age gate that silently breaks is a compliance problem, not a cosmetic one. Adding a `fetchNight`/`setGoing` exerciser to `around-lab.tsx` is maybe an hour. |
| Sage tab vs the `sage-*` component family being two different things | **Not a bug — but rename the *files*, not the brand.** | Grep confirmed zero import overlap between `sage.tsx` (chat) and `sage-title`/`sage-knows`/`sage-story`/`sage-insight`. "Sage" as a user-facing brand covering both chat and AI copy is fine and good. The problem is purely for whoever reads the codebase next: eight `sage-*` files that have nothing to do with the Sage tab. Low priority, but if anyone touches that area, a `sage-copy-*` prefix for the non-chat ones would pay for itself. Not urgent. |
| `TalkStylePicker` and `IntakeSettings` sharing `intake-settings.tsx` | **Leave it.** | Two named exports from one file is normal. No action. |
| `RollHistoryFold` on Home and Explore with different `types` props | **Leave it — this is the pattern working correctly.** | Same component, two configurations, no duplication. Textbook. |

---

## 4. Information architecture — the calls I actually have conviction on

I'm deliberately listing three, not ten. Most of the screen map is fine.

### A. Explore is doing too much. It is the real IA problem in this app.

Look at what's stacked in one scroll on Explore: `SageTitleCard`, `IntakeSettings`, `TraitBandsFold`, `ProfileFillFold`, `FullProfileFold`, **`CategoriesFold`** (which itself contains per-category readiness, spotlight, AI copy, expandable text, visuals, the Statements section *and* a per-category archive fold), `RollHistoryFold`, `SageInsightSpend`, plus the whole `SageExploreObservations` fold. That is nine top-level surfaces, several of them multi-level.

This is the direct cause of the incident that started this whole exercise: **emci did not know category statements had shipped.** They shipped. They work. They render on Explore — buried under a fold, inside another fold. The research backs the diagnosis: The Pattern and CHANI both keep the deep profile *browsable and shallow-to-reach*, and push only the live thing. ATO has the depth and has buried it.

**Recommendation:** give Categories its own route. `CategoriesFold` is already a self-contained component reading `category_defs` + `me.category_spotlight` + `me.sage_title` + `category_statements` — it does not depend on Explore for anything. Moving it to `src/app/categories.tsx` and leaving a one-line teaser row on Explore that links to it is a small, low-risk change. The nav infrastructure to support it already exists (`lib/nav/nav-order.ts` has a pool-slot system with tabs that aren't in the 4-slot bar, plus a More sheet and a "not unlocked yet" section).

This one change is also the precondition for the notification recommendation in §5 — a category notification needs somewhere to land.

### B. There is no notification settings screen anywhere in the app.

Grep-confirmed: `syncPushSchedule` / `maybeAskNotificationPermission` are called only from `push-runtime.tsx`, and `notificationsAreGranted` only from `push-test-card.tsx` (a dev component). **There is no user-facing control over notifications at all** — a user's only option is the iOS system toggle, which is all-or-nothing.

Given ATO currently sends ~15 notifications a week (daily morning + daily evening + weekly Sunday), and the research says 46% of users kill notifications at 2–5/week, the realistic outcome today is that a meaningful share of users have silently turned ATO off at the OS level — and the app has no way to know, because there's no per-category signal to read.

**Recommendation:** a `SettingsFold "Notifications"` on the You tab, with one toggle per kind. The You tab is already the settings home (it holds appearance, city, crisis region, voice preset, AI consent, password, timezone), and `SettingsFold` already exists. This is the single highest-value small addition in this document, and it's also the thing that makes §5 safe to ship.

### C. Home is at capacity. Nothing new goes there.

Home already carries the card (Read/Do/Nudge + status + buttons) plus `CrisisCard`, `MissedCheckCard`, `RevealCard`, `AskSheet`, week-link, `SageStoryFold`, `RollHistoryFold`, and `CategoryTeaser`. The `today-slot.ts` priority chain (`crisis > missed_check > note > ask > week > none`) is well-designed and should be treated as the *rule*: **one thing at a time, by priority.** My note here is a constraint rather than a change — any future feature that wants "a spot on Home" should be competing for a `today-slot` priority, not adding a tenth fold to the scroll. Explore is what happens when that rule isn't applied.

---

## 5. The notification question

**Short answer: not as described — but yes to a tighter version of it, and only after the preferences screen from §4B exists.**

### What's wrong with "random category insight throughout the day"

Three things, in order of severity.

**1. ATO is already massively over the frequency line.** Current volume: 7 morning + 7 evening + 1 Sunday = **~15/week**. The research threshold where nearly half of users disable notifications is **2–5/week**. The explicit guidance is: *if you're above 4–5/week, cut frequency before you optimize anything else.* Adding a new random stream to a schedule that is already 3x over the line is the single worst available move. The version of this idea that works starts by *removing* sends.

**2. "Random" is the wrong word for what ATO is good at.** ATO's entire premise is a 16-axis trait profile that every AI surface reads from. `trait_tracks` knows each axis's value, stability, answer count, and last-touched time. `category_defs` knows which axes each category weighs and its `min_axes_required_stable`. `me.category_spotlight` already picks a category of the week. The app can say *which* insight is live for this person right now — which is exactly what The Pattern does with its cycles. Choosing at random throws away the one asset that makes ATO different from a fortune-cookie app. Random is what you do when you don't know the user; ATO knows the user.

**3. Random timing + unreviewed AI copy is Co-Star's exact failure mode.** Co-Star's random-feeling voicey pushes became a meme and then a backlash, including one that landed catastrophically during a national news event. ATO is diagnosis-adjacent by its own admission — `CLAUDE.md` already flags Story and Levity copy as not shippable-as-reviewed without emci's read. Copy that fires unattended at an unpredictable moment gets *less* review than copy on a screen, not more. That's backwards.

### What I'd build instead

**The swap: replace the daily evening push with a smart-picked category statement, three days a week.**

The evening push is the weakest of the three. It's the same generic line every single day (`eveningPush()` produces one of exactly two strings, varying only on whether `evening_wind_down` is set). It fires 7x/week. It is pure reminder with zero content. That is the notification users learn to ignore — and it's the one that makes them disable the lot.

Concretely:

| | Now | Proposed |
|---|---|---|
| Morning | daily, the Read | **unchanged** — this is the product, same as Co-Star's daily |
| Evening | daily, generic check reminder | **3x/week** (Tue/Thu/Sun), and only if today's Check isn't logged |
| **New: insight** | — | **2x/week** (Mon/Fri), a category statement, at the existing evening hour |
| Sunday | weekly recap | **unchanged** |
| Crisis | *(none — correct)* | **unchanged. Do not touch. See below.** |

Net: ~15/week → **~12/week**, with more of it being actual content. Still above the ideal 5, but moving the right direction, and the §4B preferences screen lets users trim further without nuking everything.

**How "smart-random" works, using only what's already built:**

The pick is deterministic-then-varied, not a dice roll. In priority order:
1. `me.category_spotlight` — the category of the week already exists and is already user-facing (`parseSpotlight`/`saveCategorySpotlight` in `categories-fold.tsx`). The notification should reinforce the spotlight, not contradict it.
2. If no spotlight: the category whose weighted axes have the **highest stability** in `trait_tracks` — i.e. the one ATO actually has enough signal to speak confidently about. `readAllCategories(tracks)` in `lib/category-catalog.ts` already computes readiness.
3. Tie-break by **oldest `last_touched`** — surface something the user hasn't seen recently. This is where the "feels random" comes from, and it's cheap variety rather than actual randomness.

The body text is the existing **current** `category_statements` row for that category — `fetchCurrentStatements(userId)`, `superseded_at is null`. Nothing new is generated for the notification.

**Why that last point is non-negotiable (the architectural constraint):** ATO uses *local* notifications. There is no push server. A local notification's text must be decided when it's scheduled, and the app cannot run AI generation while it's closed. So "generate an insight and push it" is **not buildable on the current architecture** — it would need a real push backend plus server-side generation, which also collides with the quota invariant (`claim_ai_call` lives inside `ai-generate`; the client never decides whether a paid call happens). Shipping *already-generated, already-stored, already-user-visible* statements sidesteps all of that: no new AI calls, no quota implications, no unreviewed copy — a user can only be notified with a statement they could already read on the Categories screen. That property is worth protecting even if a push backend is built later.

**Files this touches** (for scoping, not instruction — nothing should be built until emci approves):
- `src/lib/push-copy.ts` — add an `insight` kind + `PUSH_PATHS.insight` deep link. The existing `copyHasFakeUrgency` guard applies automatically.
- `src/lib/push-policy.ts` — add day-of-week selection for evening/insight. Keep `pushWindowForEnergy` as the hour source; no new time logic.
- `src/lib/push.ts` — one more identifier in `PUSH_IDS`, one more `scheduleRepeating` in `syncPushSchedule`. **Watch the iOS 64-pending-notification cap** — weekly triggers keep the count in single digits; a "several per day" design would blow through it and go silent, which is the classic bug here.
- `src/lib/category-statements/store.ts` — reuse `fetchCurrentStatements` as-is.
- Deep link: `/categories` (from §4A) or `/explore` if that move isn't made.
- `push-test-card.tsx` — add the new kind to `fireTestPush` so it's testable before it ships.

### What must NOT change

- **Crisis notifications: there are none today, and none should be added.** Crisis is a *card*, rendered on Home/Dawn/Sage from static `crisisCardContent(region)` copy, with zero AI involvement (grep-confirmed). It must never enter any rotation, randomization, scheduling, or category system. A crisis surface appears because the user's own state called for it — not on a timer. Do not create a crisis push kind, and do not let the insight picker read `crisis_flags`.
- **`copyHasFakeUrgency` stays, and applies to the new kind.** No streak language, no loss framing, ever.
- **`shouldAskNotificationPermission` stays exactly as-is** — asked once, only after the first real Check, never re-prompted. That's already better than most of the category.
- **No new AI calls from the notification path.** Statements are read, never generated, at schedule time.

### Order of operations

1. §4B — notification preferences fold on You. *(Ship this first regardless of everything else in §5. It's valuable alone, and it's the safety net.)*
2. Cut evening to 3x/week. *(Ship and observe. This alone may be the whole win.)*
3. §4A — Categories gets its own route.
4. Then, and only then, the insight notification.

Doing step 4 before step 1 means adding volume to an over-saturated channel with no way for users to respond except turning everything off.

---

## 6. Ideas to park

Not now. Recorded so they aren't lost.

| Idea | Why it's parked |
|---|---|
| **Way of Life's adaptive frequency** — reduce reminders for consistent users, raise for inconsistent ones, and *ask* before changing ("You're consistent — want fewer reminders?"). The best single pattern found in this research, and `checks` already has the did/skip history to drive it. | Needs the §4B preferences screen to exist first, plus a few weeks of real usage data to tune against. Revisit after invite-only opens up. |
| **The Pattern's "Your Timing" — time-bounded cycles with a stated phase and duration.** ATO has `trait_history`, `trait_tracks.last_touched`, and `trait-stability.ts`; it could plausibly say "you've been in a X phase for ~3 weeks." | A significant new product surface, not an IA fix. Needs a real product decision from emci, and lands close to diagnosis-adjacent copy — would need the `*_COPY_REVIEWED` treatment. |
| **In-app badge count instead of a push** (Way of Life's quietest nudge). Would let ATO *reduce* push volume without losing the reminder. | Small but needs a design decision about where the badge lives — nav bar, tab icon, or NavPixel. |
| **Streak-freeze mechanics.** | Actively recommended against, not just deferred. `record_check`'s 2-day backfill window is already a gentler version of the same forgiveness, and `copyHasFakeUrgency` bans streak language on purpose. Importing streaks would contradict a deliberate design stance. Parked as "considered and declined." |
| **Per-user send-time optimization** (~3x open rates vs. fixed scheduling). | Requires knowing when each user is actually active — i.e. session-time telemetry that doesn't exist. `pushWindowForEnergy`'s self-reported `energy_pattern` chip is a decent cheap proxy and is already shipped. Revisit only if real telemetry is ever added. |
| **Renaming the non-chat `sage-*` files** to a distinct prefix. | Pure readability; touches eight files for zero user-facing change. Do it opportunistically if someone is already in that code, never as its own task. |
| **Consolidating the `VoiceCardResult.dev` trace line** into one shared dev component. | Refactor-only, dev-gated code, nonzero risk, no benefit. Declined rather than deferred. |
| **Reverse per-column audit of `me`'s ~70 columns.** | Genuinely worth doing and blocked on exactly one thing: the live schema dump from §2. The moment that exists, this becomes a straightforward mechanical pass. |
| **Non-dev review surface for access requests.** | Blocked on a product decision — it only matters if `signup_mode` changes. See the `GOTCHAS.md` line recommended in §3. |

---

*No source code was modified in this pass. Everything above is a recommendation pending emci's approval.*
