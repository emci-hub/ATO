# Screen Map

What data shows on each screen, in plain language, with the DB table/RPC/lib source. Built from `docs/field-inventory.md`'s coverage scan. Batches of 2-3 sections, confirmed with emci between batches.

---

## Auth / Signup

**Signup** (`src/app/auth/index.tsx`)
- Invite code field — only shown when `app_config.signup_mode = 'invite_only'` (checked via `lib/invite.ts`, validated server-side by RPC `assert_invite_usable`)
- Email field, OTP code entry (Supabase `auth.signInWithOtp` / `verifyOtp`)
- Apple Sign-Up button (if available on device) — writes `apple_given_name`/`apple_family_name` into `auth.users.user_metadata`, links `apple_credentials.apple_sub` via the `apple-link` Edge Function

**Login** (`src/app/auth/login.tsx`)
- Identifier field (email or `@handle`), password field with a static hint, Apple button, "email me a code" link

**Not actually part of the auth flow** (despite living in field-inventory's auth/account group — they render on the You/settings tab instead):
- `password-settings-fold` — set/change password, on You tab
- `delete-account-sheet` — static copy list of what gets deleted, opened from settings
- `dev-unlock-gate` (exports `AppVersionDevUnlock`) — the version-number 7-tap dev gate, in-memory only
- `ai-consent-card` — used on Home/Dawn/Talk, not signup

**Built but hard to find:** `src/lib/access-requests.ts` (approve/deny pending access requests) is wired only into `dev-lab.tsx`. If `signup_mode` is ever switched to a public+request-gate mode, there is no user-facing "request access" screen — only devs can act on requests via dev-lab.

---

## Onboarding (`src/app/onboarding.tsx`)

Two phases, one screen:
1. **Account** — invite code (if invite-only), birth year/month/day (`BornOnFields`), name, `@handle` (live availability check), city (`CityPicker`, defaults to `DEFAULT_AROUND_CITY`)
2. **Intake** — 8-9 chip questions (`CoreIntakeSweep`/`ChipGroup`, from `CORE_INTAKE_QUESTIONS` in `lib/intake.ts`): talk style, show-up, what knocks you off, morning cue, evening wind-down, energy pattern, support style, current focus

All of it lands in one `createMe(...)` insert (`lib/me.ts`): `name, handle, show_up, talk_style, knocks_you_off, morning_cue, evening_wind_down, energy_pattern, support_style, current_focus, timezone, invite_code, born_on, city`. No fetched-but-unshown fields on this screen.

**Correction to field-inventory's grouping:** `optional-intake`/`intake-sweep` are NOT part of onboarding — they belong to the separate `(tabs)/intake-sweep` tab. `intake-settings` lives on Explore. `birthday-row`, `crisis-region-picker`, `voice-preset-picker`, `appearance-picker` all live on the You tab (settings), not onboarding — legitimately post-onboarding features, not dead.

---

## Home (`src/app/(tabs)/index.tsx`)

- Today's Read/Do/Nudge text, "Logged for day N" / "Check is closed" status, Logged-it/Skip buttons — from `useTodayCard` (`lib/today-card.ts`)
- `CrisisCard`, `MissedCheckCard`, `RevealCard` (Story teaser), `AskSheet`, week-link row, `SageStoryFold`, `RollHistoryFold` (past Story reveals), `CategoryTeaser`
- Dev-only box (Dev Tools Hub + lab links) — gated by `canSeeDevLab`/`__DEV__`

**Data source:** RPC `home_bootstrap` (`lib/home-bootstrap.ts`) returns `checks`, `trait_tracks`, `crisis_since` in one round trip (replaced 3 separate queries). `trait_tracks` feeds `SageStoryFold`, `CategoryTeaser`, and voice routing.

`CategoryTeaser` also reads `me.sage_knows.last_axis`, `me.sage_title` (cached AI copy), `me.trait_touched_at` via `lib/home-teaser.ts` — renders one category name + one-line reading.

`today-slot.ts` picks one slot by priority: `crisis > missed_check > note > ask > week > none` — no dead branches.

**Corrections to field-inventory's grouping (these are NOT on Home, contrary to the component-list grouping):**
- `running-update-line` — actually on You tab / ai-lab / push-runtime
- `provider-status-dot` — used in `ai-lab.tsx` (dev lab), not Home
- `settings-fold` — used by password-settings-fold and You tab, not Home
- `today-card-events.ts` — exists (`src/lib/today-card-events.ts`), imported by `push-runtime.tsx`, `use-today-card.ts`, `today-card.ts`; not directly on the Home screen but is a real, live data source feeding it indirectly

---

## Dawn (`src/app/dawn.tsx`)

- `card.read` / `card.do` text (from `routeVoiceCard` result; source `checks.read_text`/`checks.do_text`, written by RPC `record_check`)
- Day number (`result.day`), tone label (`result.tone` — lift/even/cut)
- "Logged for day N" state — `checkWindowFor` (`lib/check-window.ts`) using `me.timezone` + `checks[].day`
- `CrisisCard` — `crisisFlagsForWindow` (`lib/crisis/days.ts`)
- AI consent modal — `me.ai_consent` via `aiConsentFor` (`lib/me.ts`)
- Dev trace line (`result.dev.providerLabel`, `checkCount`, `fromBankFile`, `fromModel`) — gated by `PRE_LAUNCH_DEV`

**Data feeds:** `me` row; `fetchChecks(userId)` → `checks` table; `fetchTraitTracks(me.id)` → passed into `routeVoiceCard` but not itself rendered — only shapes generated card text indirectly. `routeVoiceCard` (`lib/voice/router.ts`) is the core generation orchestrator; persists via `persistRoutedCard` (`lib/today-card.ts`) and `recordCheck` (`lib/checks.ts` → `record_check` RPC).

**Loaded, not rendered:** `crisisYesterday` flag (dawn.tsx:73) — fed into `routeVoiceCard` logic, never shown as its own UI element.

**Worth a look later:** the `VoiceCardResult.dev` shape (`providerLabel`, `checkCount`, `fromBankFile`, `fromModel`) is rendered separately on four surfaces — `dawn.tsx`, `dev-lab.tsx`, `ai-lab.tsx`, `voice-lab.tsx` (grep-confirmed, same type used in all four).

---

## Week (`src/app/week.tsx`)

- "You showed up N" count (`week.length`)
- Recap paragraph — `recapFromReads(week.map(read_text))` (`lib/push-copy.ts:59`)
- Per-check card: status label "did"/"skip" + day (`check.status`, `check.day`), `check.read_text` (falls back to "Outcome kept…" copy if null), `check.do_text` (shown only if truthy, no fallback)

**Data feeds:** `fetchChecks(userId)` → `checks` table (same source as Dawn), filtered by `checksInRecapWeek` (`lib/week-window.ts`) using `check.logged_on ?? created_at` + `me.timezone`.

**Loaded, not rendered:** `Check` type carries more fields (`lib/checks.ts:6-14`, e.g. `source`) than week.tsx destructures (`id/status/day/read_text/do_text`) — simply unreferenced on this screen, not flagged as unusual.

**Worth a look later:** none.

---

## Explore (`src/app/(tabs)/explore.tsx`)

- Header: `settledAxisLabel(tracks)` (`lib/trait-stability.ts`) from `fetchTraitTracks(userId)`; `me.current_focus` chip label via `chipLabel(CURRENT_FOCUS_CHIPS, ...)` (`lib/intake.ts`)
- Body (child components, all fed `me`/`tracks`): `SageTitleCard`, `IntakeSettings`, `TraitBandsFold`, `ProfileFillFold`, `FullProfileFold`, `CategoriesFold`, `RollHistoryFold` (types `['legend','category']`), `SageInsightSpend`
- `SageExploreObservations` fold (explore.tsx:264-447) — calls `routeExplore` (`lib/explore/route.ts`), wired to `fetchLatestExplorePack`/`saveExplorePack`/`fetchExploreMissNotes`/`recordExploreReaction` (`lib/explore/store.ts`), reading/writing `explore_packs`, `explore_entries`, `explore_reactions` via RPCs `insert_explore_pack`/`record_explore_reaction`. Renders per entry: `entry.body`, yes/no "landed" buttons, "noted" ack animation, reaction error text.

**Data feeds:** other `explore/` modules (`cadence.ts`, `combine.ts`, `copy.ts`, `generate.ts`, `local.ts`, `prompt.ts`) are consumed indirectly through `routeExplore`/`generateExploreBody`, not called directly by explore.tsx.

**Loaded, not rendered:** `entry.traits`, `entry.chips`, `entry.signalKind`, `entry.sortIndex` — present on `ExploreEntryRow` (`lib/explore/types.ts:47-56`), mapped by `store.ts:52-61`, but explore.tsx only reads `entry.id`/`entry.body`/`entry.landed` (explore.tsx:385-433). `pack.fingerprint`/`pack.trigger`/`pack.createdAt` similarly loaded onto `ExplorePackRow` but not rendered — used for routing logic only.

**Worth a look later:** none — `emptyExploreCopy()` (explore.tsx:202-219) supplies fallback copy only for the no-content states (consent-pending, consent-denied, crisis, locked, quota, empty); `'pack'` and `'cached'` are the states where a real `ExplorePackRow` exists and entries render instead, so `default: return null` is correct by design, not a missing case.

---

## Sage (`src/app/(tabs)/sage.tsx`)

- Header label/lede (`SAGE_COACH_LABEL`/`TALK_LEDE`, `lib/sage-copy.ts`)
- Progressive-unlock gate: `sageUnlocked(tracks)` (`lib/questions/progressive-unlock.ts`) — locked until 25 of the frozen 50-question intake answered (`sage.tsx:299`); shows `PROFILE_LOCKED_COPY`/CTA linking to `/intake-sweep`
- `SageEightBall` (sage.tsx:468) — random-draw component, no props from this screen
- `SageFactsCard` (sage.tsx:469) — reads `me.facts` (`lib/facts.ts:asFactsArray`), delete-only here; teaching happens in chat via `addSageMessage`
- `SageUsageLine` (sage.tsx:470) — AI-call usage strip, keyed by `usageRevision`
- Chat thread: rows from `sage_messages` table (`lib/sage-messages.ts:34,51` — `fetchSageMessages`/`addSageMessage`, columns via `MESSAGE_COLUMNS`), rendered as bubbles; crisis rows never persisted (sage.tsx:387-395, only the flag via `logCrisisFlag`)
- Consent gate (`me.ai_consent` via `aiConsentFor`) — modal `AiConsentCard` context `"talk"`, denied state shows a static "Talk is off" card + `SageSupportTap`
- Quota-empty / try-again states (`QUOTA_EMPTY_MESSAGE` from `lib/voice/quota.ts`, `TALK_TRY_AGAIN`)
- Composer: chips (`CHIPS`/`MORE_CHIPS` constants in sage.tsx:63-72, not from a lib file) → `routeTalkReply` (`lib/voice/talk.ts`, dynamic-imported) — feeds `voiceMeFrom(me)`, `checkCount`/`history` from `fetchTalkHistory` (`lib/checks.ts`), `todayCard` from `useTodayCard`, `tracks`/`answeredCount`/`divergenceNote` from `fetchTraitTracks`+`lib/trait-history.ts`
- `ReportSheet` for reporting a Sage reply or the user themself
- `CrisisCard` — modal support card, also inline for crisis-flagged messages

**Loaded, not rendered:** `checks` (from `fetchTalkHistory`) is passed only into `routeTalkReply`'s `history` arg, never rendered as a list on-screen (same "feeds generation, not UI" pattern as Dawn's `fetchTraitTracks`).

**Grepped but not on this screen:** `sage-insight`, `sage-knows`, `sage-story`, `sage-story-store`, `sage-title`, `sage-title-store` lib modules and `SageKnowsCard`/`SageTitleCard`/`SageInsightSpend`/`SageStoryFold` components do NOT import into `sage.tsx`. They render elsewhere: `SageStoryFold` on Home (screen-map.md:42), `SageTitleCard`/`SageInsightSpend` on Explore (screen-map.md:95), `SageKnowsCard` in `category-teaser.tsx`/`ask-sheet.tsx`. `sage_title_flags` table is written only by `lib/sage-title-store.ts:20`, called from `SageTitleCard`, not from this screen. `ask-sheet` (`AskSheet`) is on Home, not Sage.

**Worth a look later:** the Sage *tab* screen (chat) and the `sage-*` lib/component family (title, knows, story, insight) share a name prefix but are two separate surfaces — "Sage" as a brand name covers chat (this tab) plus AI-generated copy shown on Home/Explore, grep-confirmed no import overlap between `sage.tsx` and those other `sage-*` modules.

---

## You (`src/app/(tabs)/you.tsx`)

- Title row + `me.is_founder` badge
- Share card: `SharePoster` (poster image from `me`), `handleShare`/`handleCopyLink` (`lib/share.ts`), `ScanSheet` → `resolvePeerByHandle`/`confirmAddPeer` (`lib/circle.ts`)
- `MilestoneBadges` — `checkCount`/`factCount` (from `useGrowth` or dev `growthPreview` override, `readGrowthPreview`/AsyncStorage key `ato.dev.growth-preview.v1`, `PRE_LAUNCH_DEV`-gated), `checks` (`fetchChecks`), `me.timezone`
- `QuestGrowthBars` — `presence`/`depth` tiers (`lib/growth.ts`)
- `SettingsFold "How Sage sounds"` → `TalkStylePicker` (`components/intake-settings.tsx`, despite import name being about talk style) + `VoicePresetPicker`, both take `me`
- `CrisisRegionPicker` — standalone, no props shown passed here (reads/writes its own state internally)
- Token balance card — `TOKEN_LABEL`/`TOKEN_LEDE`/`tokenBalanceOf(me)` (`lib/tokens.ts`)
- `RunningUpdateLine` — no props
- `AppearancePicker` — no props
- `CityPicker` — `me.city` → `setCity` (`lib/me.ts`)
- Around visibility toggle — `me.visible` → `setVisible` (`lib/me.ts`), inline copy card
- `YouDevToolsSlot` → `YouDevTools` component, `PRE_LAUNCH_DEV`-gated, lazy `require`d
- Invite codes list — `fetchMyInviteCodes` (`lib/invite.ts`), `invite.code`/`inviteRemaining`/`inviteUsable`, copy-to-clipboard
- Referrals list — `fetchMyReferrals` (`lib/invite.ts`), `person.name`/`person.handle`, wrapped in `SettingsFold`
- `SageUsageFold`, `PasswordSettingsFold`, `KenneyCreditsCard` — no props
- `SettingsFold "Account"`: `me.timezone` (`DetailRow`), `BirthdayRow` (`me`), `AppVersionDevUnlock` (7-tap dev gate), AI-consent row (`me.ai_consent` tri-state On/Off/"Not set yet") → `setAiConsent`
- Sign out (`supabase.auth.signOut`), Delete account link → `DeleteAccountSheet` (`hasAppleIdentity` from `session.user.identities`)
- Modals: `AiConsentCard` context `"dawn"` for the consent-pending case

**Loaded, not rendered:** none found — every state var on this screen (`me`, `growth`, `checks`, `inviteCodes`, `referrals`) is rendered somewhere.

**Worth a look later:** `TalkStylePicker` is imported from `@/components/intake-settings` (the same file Explore's `IntakeSettings`/`intake-settings` component lives in per field-inventory), i.e. the "How Sage sounds" fold on You and Explore's intake-settings fold both source from `intake-settings.tsx` — grep-confirmed single file, two different named exports (`TalkStylePicker` here vs `IntakeSettings` on Explore per screen-map.md:95).

---

## Questions / Intake (`src/app/(tabs)/intake-sweep.tsx`)

Tab screen, distinct from onboarding's `CoreIntakeSweep`/`core-intake-sweep` (screen-map.md:31,35). Renders three question surfaces in one scroll, gated on `checksReady && flagsReady && tracksReady && backfillReady`:

1. **`QuestionsFold`** (intake-sweep.tsx:272-280, from `components/questions-fold.tsx`) — "Infinite Questions" rotating pool. Takes `me`, `history` (from `checks`), `crisisToday`, `tracks`. Internally: `routeQuestions` (`lib/questions/route.ts`) picks next batch; renders via `PagedQuestions` (`components/paged-questions.tsx`); answers go through `applyQuestionAnswer` (`lib/questions/answer.ts:57`) → **`updateTraits(userId, incoming, 'self_situation', allowed)`** (`lib/me.ts:551`, which internally calls `mergeTraitWrite` at `me.ts:551` — confirms CLAUDE.md's described path is what's actually used here). Also earns tokens (`earnTokensQuiet`, `claimOngoingRoundCompleteQuiet`), rerolls (`rerollQuestionItem`), skip (`skipQuestionItem`/`skipRestOfQuestionPack`).
2. **`OptionalIntakeFill`** (`components/optional-intake.tsx`) — "Want to add a bit more?" — takes `me`, `onUpdated=refresh`.
3. **`IntakeSweep`** (`components/intake-sweep.tsx`) — "A faster pass" full sweep — takes `me`, `crisisToday`, `tracks`, `onUpdated=refreshAfterAnswer`, `onDone`.

- Milestone toasts: `crossedMilestonesFor` (intake-sweep.tsx:40-57) computes `bankTotalProgress`, `profile_percent` (via `settledCount`/`TRAIT_AXES`), per-axis `axisComplete:<axis>` (`axisVariant`), `current_streak` (`computeStreak`) — persisted via `persistCelebratedMilestones` (`lib/me.ts`) into `me.celebrated_milestone_ids`
- `focusAxis` from `?axis=` route param — every "answer questions about X" CTA app-wide deep-links here (comment at intake-sweep.tsx:69-73 lists Legends, Explore, Categories, Sage, Story fold, milestone badge, Profile Fill, Insight Spend as the callers)
- `MilestoneToast` — pinned near the NavPixel avatar, not in normal scroll flow (intake-sweep.tsx:230-258)

**Trait-write path confirmed:** both `questions-fold.tsx` (direct `updateTraits` import) and `lib/questions/answer.ts` (`updateTraits`) go through `me.ts`'s `updateTraits`, which calls `mergeTraitWrite` (`lib/traits.ts:168`) internally — matches CLAUDE.md's `mergeTraitWrite → updateTraits` invariant. Other writers of `mergeTraitWrite` found in the wider questions system: `lib/ranking.ts:308,347` (ranking-card taps), `lib/scenario.ts:229` (scenario-card).

**Components confirmed in scope, not directly imported by intake-sweep.tsx (reached through QuestionsFold/IntakeSweep):** `paged-questions.tsx` (via questions-fold), `scenario-card.tsx`/`ranking-card.tsx` (grepped as importing `updateTraits`/`mergeTraitWrite`-adjacent modules `ranking.ts`/`scenario.ts`, and matching `completedAxesFrom`/category-paged plumbing — not traced to a direct import site in this pass, flagged for manual verify), `depth-dive.tsx` (imports `category-paged.ts`). `axis-taps.tsx` exists at `src/components/axis-taps.tsx` — imported by `full-profile-fold.tsx` and `sage-knows-card.tsx` (both Explore-side, screen-map.md:95), not by intake-sweep.tsx directly.

**On Explore, not intake-sweep.tsx (correction to task framing):** `full-profile-fold.tsx` (`FullProfileFold`) and `profile-fill-fold.tsx` (`ProfileFillFold`) both import `explore.tsx:8,10` and render there (screen-map.md:95), not on the Questions tab, despite being part of the same `lib/questions`/trait-completeness system.

**Worth a look later:** none.

---

## Circle (`src/app/(tabs)/circle.tsx`)

- Header: `me.close_friends_share` toggle (`setCloseFriendsShare`, circle.tsx:114-127)
- Per-peer card via `fetchPeerState` → RPC `peer_profile`/`peer_checks` (`lib/circle.ts:136-150`): `me.name`, `me.handle`, `me.show_up`, `me.recipe`; latest `checks.day/status/read_text/do_text` (`PeerCheck`, `lib/circle.ts:30-35`)
- Category-share block: `fetchCategoryShareStatus`/`setCategoryShare` (`lib/category-share-store.ts`) — `share.viaPool`, `share.mine`, `share.allowed`; compare view via `fetchPeerCategoryPack` + `parseSageTitle`, rendered per-axis by `CategoryCompareRow`
- Overflow menu (`ActionMenu`): Message/Mute/Block/Report — `blocks`/`mutes` from `lib/moderation.ts` (`fetchMyBlocks`/`fetchMyMutes`)
- `ReportSheet` (`kind:'user'`), unfriend confirm → `useCircleContext().unfriend` (`lib/circle-context.tsx`)

**Loaded, not rendered:** `PeerMe.talk_style` is fetched by the `peer_profile` RPC (`lib/circle.ts:25`) but not read in circle.tsx (grep-confirmed no reference) — only `handle`/`show_up`/`recipe` are shown.

**Worth a look later:** none — the extra field doesn't affect the screen, it's just unused shape.

---

## Chat (`src/app/chat.tsx`)

- Header: `peerMe.name`/`peerMe.handle` via `peer_profile` RPC
- Messages: `ChatMessage.text`/`sender_id` rendered as bubbles, from `fetchThreadMessages` → `messages` table (`lib/chat.ts:40-48`), realtime via `postgres_changes` on `messages`
- Block/mute banners from `blocks`/`mutes` (`lib/moderation.ts`), symmetric-block / local-mute state
- `ActionMenu` (header): Mute/Block/Report user; (per-message long-press): Teach Sage this / Report message / Delete for me
- "Teach Sage this" → `addFact(userId, text)` (`lib/me.ts`) writing to `me.facts` — the only chat→facts path

**Loaded, not rendered:** `ChatMessage.deleted_for`, `thread_id`, `created_at` (`lib/chat.ts:18-25`) are loaded via `select('*')` but used only for filtering/ordering, not shown as their own UI text.

**Worth a look later:** none.

---

## Around (`src/app/(tabs)/around.tsx`, `around-lab.tsx`)

- Header: `me.city` → `aroundCityBySlug` label
- Per-show card, from `WeekendJson.shows[]` (`lib/around/types.ts:8-17`, `fetchWeekendJson`): `show.date`, `show.ages`, `show.name`, `show.venueName`, `show.artists`, `show.links[].kind/url` via `ticketLabel`
- Going state per show: `night.going` (`going` table via RPC `night_snapshot`/`set_going`, `lib/around/going.ts`) → "I'm going"/"You're going" chip; age gate `showRequires18(show.ages)` + `me.born_on` via `isAtLeastAge`, error copy `GOING_UNDER_18_MESSAGE`
- `night.colors[]` (hues, ≥3-people threshold, no counts) rendered as color blobs
- `night.faces[]` — `NightFace.id/handle/show_up/recipe` rendered via `PixelFace` + `@handle`

**Loaded, not rendered:** `NightFace.name` (`lib/around/going.ts:6`) is loaded but not rendered — grep-confirmed around.tsx only reads `.handle`, no `face.name` reference anywhere in the file. `PeerMe.talk_style`-style situation, doesn't affect UX.

**Dev-lab coverage gap (fact, verified):** `around-lab.tsx` only exercises `fetchWeekendJson`/static JSON (aggregate counts, status/error copy) — grep-confirmed zero references to `fetchNight`, `setGoing`, or `night_snapshot` anywhere in the file. This means the going/colors/faces feature (the `going` table path) has no dev-lab smoke test, only the Edmtrain listing fetch does.

**Worth a look later:** the dev-lab coverage gap above — it's a real gap in what's testable from dev-lab, not a judgment about whether that matters.

---

## Legends (`src/app/(tabs)/legends.tsx`)

Live table confirmed: `legend_generations` (wave58, `lib/legends64/store.ts`). No reference to the dropped wave57 tables (`archetype_defs`/`legend_archetypes`/`legend_variants`/`legend_figures`/`user_legend_history`) anywhere in `legends.tsx` or `lib/legends64/*` — field-inventory's "dropped" note is confirmed correct.

Renders: current legend story (`load.current.code/story`, `fetchCurrentGeneration`), name-per-skin via `archetypeName(code, skin)` (`legend-card.tsx`, `lib/legends64/archetypes.ts`), reroll button gated on `me.ato_tokens` balance, skin picker (`LEGEND_SKINS`), progressive-unlock lock state (`legendsUnlocked(tracks)`), thin-profile/locked/loading/error states, `LegendHistoryFold` (past `legend_generations` rows excluding current), dev-only `DevTestPresetStrip` (dev-test-user only).

**Loaded, not rendered:** none — `me.celebrated_milestone_ids` and `focusAxis` feed logic/routing only (same "feeds logic, not UI" pattern as elsewhere in this doc).

---

## Roll (`src/app/(tabs)/roll.tsx`)

Live tables: `trait_roll_snapshots` and `trait_rolls` (wave46/47, `lib/rolls/store.ts`).

Renders: token balance (`tokenBalanceOf(me)`), roll eligibility (`rollEligible(tracks, snapshot)`, `lib/rolls/compose.ts`), roll/reroll CTA, quota/not-eligible/error outcome states, per-item cards from `fetchRollItems`/`fetchLatestRollId` — title via `itemTitle` (legend/story/category name), reveal-or-locked state via `rollItemResultIsReady`, reveal button priced via `rollItemPrice(item.type)`, revealed body via shared `RollItemBody` (for `type==='legend'`: `item.result.archetypeCode/story`; for category/story: `item.result.body`).

**`RollHistoryFold` distinction (grep-confirmed):** Roll's own screen does NOT use `RollHistoryFold` — it renders its own live-roll items list directly. `RollHistoryFold` is a separate, collapsed-by-default archive of *revealed* items only (`fetchRevealedRollItems`), used on Home (`['story']` types) and Explore (`['legend','category']` types) — same component, different `types` prop, never mounted on Roll's own screen.

**Loaded, not rendered:** none seen in `roll.tsx` itself.

---

## Categories

No dedicated tab/route — `CategoriesFold` imports only into `explore.tsx` (confirms prior-batch finding), a `SettingsFold` embedded there.

Renders (`categories-fold.tsx`): per-category readiness (`readAllCategories(tracks)`, reading `category_defs` via `lib/category-catalog.ts`), spotlight-of-the-week (`me.category_spotlight`, `parseSpotlight`/`saveCategorySpotlight`), cached AI copy (`me.sage_title` via `parseSageTitle`) with fallback (`fallbackCategoryCopies`, `lib/category-bands.ts`), expandable full text + `CategoryVisual` per open category, "Statements" section from `category_statements` table (`fetchCurrentStatements`, `lib/category-statements/store.ts`) with generate/regenerate CTA and per-category `CategoryStatementArchiveFold` (past statement history).

`category_share` table is used by `lib/category-share-store.ts`, consumed on Circle (not the Categories fold itself) — see Circle section above.

**Correction (I misnamed a table when scoping this batch):** there is no `category_bank_pool` table — the wave49 table is `question_bank_pool` (used by `lib/questions/bank-pool.ts` etc., part of the Questions system, not Categories).

**`lib/dawn-category.ts` — grep-verified myself:** it's real and imported, just not by the Categories fold. It's used in `lib/voice/router.ts` and `lib/voice/providers/prompt.ts`/`types.ts` — i.e. it feeds Dawn's card-generation pipeline (shapes AI copy), not the Categories screen directly. No dead code here, just a misplaced assumption in the task scoping.

**Worth a look later:** none.

---

## Public Profile (`src/app/[handle].tsx`)

- RPC `public_profile(p_handle)` returns `id, name, handle, show_up, talk_style, recipe`. Rendered via `SharePoster` (`PosterPerson` = `name, handle, show_up, recipe`) plus a plain-text `{profile.name} on ATO` caption.

**Loaded, not rendered (grep-confirmed myself):** `profile.id` and `profile.talk_style` are on the fetched type but `talk_style` appears only in the type declaration — no `.talk_style` reference anywhere else in the file. Same "loaded shape carries more than one screen renders" pattern as `PeerMe.talk_style` (Circle) and `NightFace.name` (Around).

**Worth a look later:** no `CREATE FUNCTION public_profile` anywhere in `supabase/migrations/` (grep-confirmed, zero matches) — only comments reference it. Same "baseline, unprovable from repo" situation as the 4 baseline tables in field-inventory's Known Gaps §1; worth adding `public_profile` to that gap list since its return shape is only as trustworthy as the TS interface, not schema-verified.

---

## Dev Tools

All gated by `PRE_LAUNCH_DEV || devUnlocked` via `canSeeDevLab` (`lib/dev-access.ts`). Confirmed myself: `PRE_LAUNCH_DEV = true` currently in `src/lib/dev-mode.ts:15`.

- **`dev-lab.tsx`** — hub: today-slot/ask overrides, card simulator, Explore force-regen, trait-value viewer (RLS-limited to own row), growth-preview override, trait-band stepper, intake-stage presets + fresh-signup reset + handle-collision check (all three hard-gated to `me.id === DEV_TEST_USER_ID`), AI-consent reset, crisis-card preview, quota/usage dashboard, framework-echo fence tester, trace-capture toggle, root-only grants/profiles panels, pending access-request review
- **`ai-lab.tsx`** — provider switcher (per-device override) + usage counts; separately gated because it historically had no guard at all
- **`crisis-lab.tsx`** — live `CrisisCard` render + keyword count + region/override state; `PRE_LAUNCH_DEV`-only, no dev-unlock fallback
- **`talk-lab.tsx`** — two fixed personas through `routeTalkReply`, side-by-side tone comparison
- **`theme-lab.tsx`** — static-fixture gallery (AskSheet, AppearancePicker, MilestoneBadges, RevealCard, RankingCard, ScenarioCard, QuestGrowthBars) with hardcoded data, no live DB reads
- **`voice-lab.tsx`** — walks `check_count` 0→4 through `routeVoiceCard` to show bank→generated cutover
- **`pixel-lab.tsx`** — Kenney body/face gallery + growth-tier force + on-demand milestone trigger, bypassing real check/fact data
- **`around-lab.tsx`** — covered above (Around section) — has no dev-lab coverage of the going/colors/faces feature, only the listing fetch

**Release-mode enforcement confirmed myself:** `scripts/release-mode-check.ts` regex-checks the `PRE_LAUNCH_DEV` literal and fails the build if `true` while `RELEASE_MODE=1`, wired to `eas-build-post-install` in `package.json`.

**Worth a look later:** none beyond the Around gap already noted.

---

## Shared / Global

- **Crisis card** — confirmed myself: no `generateText`/`ai-generate` import anywhere in `crisis-card.tsx` (grep, zero matches). Content is pure `crisisCardContent(region)` copy (`lib/crisis/copy.ts`) — the CLAUDE.md "never generated" invariant holds.
- **Push** (`lib/push.ts`) — local notifications (morning/evening/Sunday) built from `today-card`/`push-copy.ts`/`week-window.ts`; permission-ask gated by `push-policy.ts`'s `shouldAskNotificationPermission`
- **Nav** — `nav-more-sheet.tsx`/`nav-edit-overlay.tsx` both read `useNavOrder()` (`lib/nav/nav-context.tsx`) and `NAV_TABS`/`POOL_SLOTS`/`SLOT_COUNT` (`lib/nav/nav-order.ts`); More sheet lists pool tabs not in the 4 bar slots, edit overlay drag-reorders slots 1-4 (Home/Sage locked) and toggles pool tabs on/off, with a "Not unlocked yet" locked-tabs section
- **Sentry** (`lib/sentry.ts`) — DSN from `EXPO_PUBLIC_SENTRY_DSN` (public/ingest-only by design — Sentry DSNs are meant to be public, consistent with the no-vendor-secret invariant, not an exception to it), native+JS test-error senders gated `__DEV__`/DSN-present
- **Milestone toast** — already covered on Questions/Intake (screen-map.md, intake-sweep section)

**Worth a look later:** none.

---

*All sections from field-inventory's proposed list are now covered: Auth/Signup, Onboarding, Home, Dawn, Week, Explore, Sage, You (Settings), Questions/Intake, Circle, Chat, Around, Legends, Roll, Categories, Public Profile, Dev Tools, Shared/Global. Screen map complete.*
