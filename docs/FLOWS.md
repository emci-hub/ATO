# FLOWS — how data moves

Line numbers are from 2026-09-02 (commit after Phase 1). Re-grep the function name if a
line has drifted.

## 1. Boot → auth gate

1. `src/app/_layout.tsx:19` — `initSentry()`, splash held.
2. `src/hooks/use-session.ts:19` `resolveSession()` — cached session, if any; then
   `auth.getUser()` proves the user still exists (a deleted account's stale JWT is
   cleared). No client-side auto sign-in of any kind.
3. `src/lib/me-context.tsx:35` `MeProvider` — loads the `me` row + `my_dev_access`.
4. `src/app/_layout.tsx:72-97` — `Stack.Protected`: `!isAuthed` → `auth`,
   `isAuthed && !hasMe` → `onboarding`, else `(tabs)` + pushed screens. Labs behind
   `PRE_LAUNCH_DEV` (`src/lib/dev-mode.ts:14`).

## 2. Signup → `me` row

1. `src/app/onboarding.tsx` collects identity, 8 chips, optional 8 scenarios.
2. `src/lib/me.ts:233` `createMe()` → RPC `complete_signup`
   (`supabase/migrations/founder_access_requests.sql:141`, latest definition) — consumes
   the invite code, enforces 16+, coalesces re-saves.
3. Handle rules: client `RESERVED_HANDLES` (`src/lib/me.ts:749`) mirror the DB
   `me_handle_check` constraint (`supabase/migrations/wave34_root_is_column.sql`).
4. Optional scenarios → one `updateTraits()` call (`src/lib/me.ts:499`).

## 3. Today's card (Dawn / Home)

1. Home mounts: checks (`(tabs)/index.tsx:109`), trait tracks (`:116`), crisis flags
   (`:131`), dev overrides (`:181`), reveal-opened (`:194`).
2. Day window: `src/lib/check-window.ts:90` `checkWindowFor()` → today + up to 2 missed days.
3. Card routing effect `(tabs)/index.tsx:262-287` → `routeVoiceCard()`
   (`src/lib/voice/router.ts:172`): bank copy for days 1–3, generated after; consent,
   crisis, anti-repeat, jargon + phrase guards; `pickVoiceProvider`
   (`src/lib/voice/select-provider.ts:7`).
4. Remote provider `src/lib/voice/providers/remote.ts:13` → `generateText()`
   (`src/lib/ai/generate.ts:57`) → `completeViaEdge()` (`src/lib/ai/edge.ts:15`) →
   Edge Function `ai-generate` (`supabase/functions/ai-generate/index.ts`):
   `auth.getUser()` (:271) → `claim_ai_call` (:312) → vendor (`complete()` :211).
   Gemini failure of any kind retries once on DeepSeek (`generate.ts` catch block).
5. Result persisted: `persistRoutedCard()` (`src/lib/today-card.ts:87`) → AsyncStorage +
   App Group for the widget (`APP_GROUP` `today-card.ts:9`).
6. Primary slot chosen by `resolveTodaySlot()` (`src/lib/today-slot.ts:23`): crisis >
   missed check > reveal (`src/lib/reveal.ts:186`) > weekly Ask (`src/lib/ask.ts:35`) >
   week.

## 4. Check write

1. "Logged it" / "Skip today" → `commitLog()` (`(tabs)/index.tsx:314`).
2. `recordCheck()` (`src/lib/checks.ts:104`) → RPC `record_check`
   (`supabase/migrations/record_check_no_card.sql:8`, latest) — the **only** write path.
   Server enforces window (P0017), one-per-day (P0019), day match (P0018).
3. `emitChecksChanged()` (`src/lib/checks-events.ts`) → Home and You refetch.
4. Notes earned via `earnTokensQuiet()` (`src/lib/tokens-server.ts`).
5. Read/Do/Nudge text pruned after 7 days server-side; did/skip kept forever.

## 5. Trait profile (the backbone)

1. Any answer (Ask, ranking, scenario, questions, settings) →
   `mergeTraitWrite()` (`src/lib/traits.ts:168`): direct sources
   (`self_slider/self_tap/self_confirm/self_settings/self_scenario`) are sticky over
   inferred (`self_situation/self_game`); inferred writes are damped toward prior.
2. `updateTraits()` (`src/lib/me.ts:499`) writes the `me` columns, appends
   `trait_history` (`src/lib/trait-history-store.ts:6`) and upserts EWMA
   `trait_tracks` (`src/lib/trait-tracks-store.ts:57`; α=0.35, stability floor 3,
   60-day idle then 90-day half-life at read — `src/lib/trait-stability.ts`).
3. Readers: `traitStateFromRow()` (`src/lib/traits.ts:215`) for Sage/Ask; report-track
   only for Categories (`src/lib/categories.ts`), Legends (`src/lib/legends/match.ts:91`),
   Full Profile completeness ("N of 16 settled").
4. Dev-only exception: `applyDevArchetypePreset()` (`src/lib/dev-test-user.ts:159`)
   writes columns directly for the dev user (refuses any other account).

## 6. Sage Talk

`(tabs)/sage.tsx` → `routeTalkReply()` (`src/lib/voice/talk.ts:96`): consent gate →
crisis keyword gate (`src/lib/crisis/detect.ts`, static card, zero model calls on a hit) →
client `claimAiCall()` (`src/lib/voice/quota-server.ts:32`, no-op for remote providers
because the Edge Function claims) → `generateText` → output fence (jargon/phrase; retry
once) → `sage_messages`.

## 7. Explore / Questions / Story

- Explore: `routeExplore()` (`src/lib/explore/route.ts:67`) — cadence, cached pack,
  category grounding (`src/lib/explore/prompt.ts:122`), reactions. 25s `withTimeout`
  at every call site.
- Questions: `src/lib/questions/route.ts`; regen 3/UTC-day via `claim_questions_batch`.
  Gate order in `routeQuestions`: consent → crisis → cached pack → **profile
  completeness** → quota claim → generate. An incomplete profile (any axis with
  0 report answers, `isProfileComplete` in `trait-stability.ts`) is served from
  the static bank with its unfilled axes first, and claims **no** quota. Tracks
  reach the route via `(tabs)/intake-sweep.tsx` → `QuestionsFold` → `tracks`;
  the fold is not mounted until `tracksReady`, or a complete profile could be
  locked into a bank-only pack for the rest of the day by the cache. Sage chat
  (`routeTalkReply`, `src/lib/voice/talk.ts`) is a separate path and is never gated.
- Story: `src/lib/sage-story.ts`, own quota `claim_story_generate`
  (`supabase/migrations/wave22_levity_story.sql:30`), no offline fallback.

## 8. Legends

`(tabs)/legends.tsx` → `fetchLegendCatalog()` (`src/lib/legends/store.ts:96`,
`legend_variants` + `legend_figures` embed) + `fetchSeenVariantIds()` (:156) →
`buildLegendView()` (`src/lib/legends/match.ts:91`, ≥2/3 poles per archetype, best
unseen variant per figure) → `logShownVariants()` (:169) into `user_legend_history`.

## 9. Circle / Chat

Scan or paste → `resolvePeerByHandle()` shows who it is → explicit "Add" tap →
`confirmAddPeer()` (`src/lib/circle.ts`) writes `connections`. No auto-connect.
Thread: `getOrCreateThread()` (`src/lib/chat.ts:34`); RLS hides a blocker's counterpart
lines and blocks sends both ways (`src/lib/moderation.ts`). Category compare is
dual-opt-in through `peer_category_pack`
(`supabase/migrations/wave21_playfulness_categories.sql:181`).

## 10. Push

`src/components/push-runtime.tsx` → `syncPushSchedule()` (`src/lib/push.ts:127`): local
morning/evening keyed off `energy_pattern`, Sunday recap from `checks`
(`sundayPayloadFor` :118). Content never generated for push.

## 11. Account deletion

`src/lib/delete-account.ts` → Edge `delete-account` (`supabase/functions/delete-account/index.ts`):
read Apple creds **before** delete (:80) → revoke → `confirmRevoked` proof (:120) →
`auth.admin.deleteUser` (:138) → `count_user_rows` → `account_deletions` audit.

## 12. Root / dev access

`my_dev_access` RPC (`supabase/migrations/dev_access.sql:46`) → `is_root()` reads
`me.is_root` (wave34). Root-only: pause/delete profiles, approve landing signups
(`supabase/functions/review-access/index.ts`). Grantable capabilities:
`src/lib/dev-access.ts:8`.
