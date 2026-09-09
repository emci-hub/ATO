# Core Loop Redesign — Mechanical Implementation Plan

Status: **Planning only, nothing built.** Written 2026-09-09 from a finalized product plan (6 items) plus a full investigation of current code. This doc is the source of truth for the build; `PROJECT_CONTEXT.md`'s Snapshot/Decisions Log carries only a pointer + one-paragraph summary, same convention as `docs/archive/TRAIT_SYSTEM_REDESIGN_PLAN.md`.

## 0. Corrections to the finalized plan (read this first)

1. **Item 1 (Unlock) is already shipped, not new work.** `src/lib/questions/progressive-unlock.ts` already gates Sage at `answered >= 25` (`SAGE_UNLOCK_THRESHOLD`) and Legends at `answered >= 50` (`LEGENDS_UNLOCK_THRESHOLD`), both driven by `bankTotalProgress(tracks).answered` — a plain count, order-independent, skips already allowed. Call sites: `src/app/(tabs)/sage.tsx:45,299`, `src/app/(tabs)/legends.tsx:27-28,276,300`. Locked-banner UI (not hidden) is already the pattern on both screens (`PROFILE_LOCKED_COPY`/`PROFILE_LOCKED_CTA`). **Nothing to build here** — T-00 below is a verification-only task, not an implementation task.
2. **Item 3 (Categorize) already has no dedicated tab.** `docs/NOW.md`/nav registry (`src/lib/nav/nav-order.ts:54-67`) confirm there is no `categorize` tab id — category batches already render inside Explore via `src/components/categories-fold.tsx`. The real work is converting that fold's Q&A flow to read-only AI statements, not "moving" anything between tabs.
3. **Item 4 (Legends) is a bigger replacement than "swap the matcher."** The live Legends system is not a static 12-archetype file — it's a DB-backed content catalog (`legend_figures` → `legend_variants` → `legend_archetypes` → `archetype_defs`, `src/lib/legends/store.ts`, migrations wave25/26/28/32/33) of **pre-authored historical/mythical figures** matched to archetypes via `buildLegendView` (`src/lib/legends/match.ts`). The new 64-archetype system with fresh-AI-story-per-generation has no figure/story library at all — it replaces this whole content model, not just the matching function. **This also breaks `src/lib/rolls/compose.ts:132-159`**, which calls `buildLegendView` to build a roll's legend item. The finalized plan doesn't mention the dormant `/roll` mechanic — flagged as an open question in §7.
4. **Item 2's "question bank" is new infrastructure, not a reframing of the existing frozen 50-question bank.** `src/lib/questions/bank.ts`'s `QUESTIONS_BANK` is a static, hand-authored, per-install constant (the frozen intake) — it is not a shared/growing/DB-backed pool. The plan's bank ("generation pulls from the bank first, only calls AI when short") needs a **new shared table**, separate from both `QUESTIONS_BANK` (frozen intake content) and `question_items` (per-user answered instances).
5. **`fetchRecentTexts` has no existing implementation to "wire up"** — it's an uncalled dependency slot (`ComposeOngoingRoundDeps.fetchRecentTexts` in `src/lib/questions/ongoing-round.ts`) with zero callers anywhere in `src/`. Real data source recommendation: **`question_items`** (wave17, already shaped for per-user-instance rounds: `pack_id, sort_index, axis, prompt, options, answered_option, answered_at`) is the correct save target — it already supports exactly a "batch of N tagged-by-axis questions, answered over time" shape via `question_packs`. `category_question_items` is a dead end for this (wave44, being removed per item 3).

## 1. UNLOCK — verification only

**T-00 — Confirm existing gate matches the finalized spec, no code change expected.**
- Files: `src/lib/questions/progressive-unlock.ts`, `src/app/(tabs)/sage.tsx`, `src/app/(tabs)/legends.tsx`.
- Done when: confirm thresholds (25/50) and skip-tolerant counting already match; if a real gap is found (none expected), file it as its own T-card.
- No schema/auth changes.

## 2. QUESTIONS — bank + ongoing round

**Net-new schema (needs emci's approval — schema change):**
- `question_bank_pool` — shared, not user-scoped: `id, axis (16-axis check), category, prompt, options jsonb, source ('authored'|'ai'), created_at, times_served int default 0`. This is the "shared, growing" bank. Seed: bulk-insert `QUESTIONS_BANK`'s 50 items as `source='authored'` starting rows (dedup key on prompt text), or seed empty and let it grow purely from AI — decide with emci; recommend seeding from the existing bank since those prompts are already guard-word-vetted.
- Reuses `question_items`/`question_packs` (wave17, already applied) as the per-user instance/answer table for ongoing rounds — no new table needed there, just a new `pack_id` origin (e.g. `question_packs.kind = 'ongoing_round'`, check whether `question_packs` currently has a `kind`/`source` column; if not, add one to distinguish Infinite-Questions packs from ongoing-round packs — schema change, small).

**Net-new code:**
- `src/lib/questions/bank-pool.ts` — `fetchBankCandidates(axis, excludeIds)` (pulls from `question_bank_pool` where `axis = X` and not already served to this user), `recordBankUsage(ids)` (bumps `times_served`), `addToBankPool(drafts)` (AI-generated new items get written back to the shared pool, not just to the user's instance — this is what makes it "growing").
- `src/lib/questions/fetch-recent-texts.ts` — implements `fetchRecentTexts(userId): Promise<string[]>` against `question_items.prompt` (join `question_packs` on `user_id`) plus the static `QUESTIONS_BANK` prompts already answered, matching the existing `fetchAskedTexts` pattern already proven in `category-batch.ts:140`.
- Wire `src/lib/questions/ongoing-round.ts`'s `composeOngoingRound` to real deps: `fetchRecentTexts` (above), a `fillFromBank` step inserted before `fillAxisCountsChunked`'s AI generation (bank-first, AI-fallback per the plan) — this is a real code change inside `ongoing-round.ts`/`chunked-generate.ts`, not just supplying the stub.
- New AI call-site metadata in `src/lib/ai/call-sites.ts`, e.g. `ONGOING_ROUND_META` (personalized: true — prompt is grounded in this user's current axis profile + history, matching `ROLL_META`'s shape but not bucket-shareable).
- Save path: `saveOngoingRoundBatch(userId, drafts)` → new `question_packs` row (`kind='ongoing_round'`) + 25 `question_items` rows, mirroring `category-batch-store.ts`'s existing save pattern.

**UI:**
- New fold/section on the Questions tab (`src/app/(tabs)/intake-sweep.tsx`) that only renders once `bankTotalProgress(tracks).answered >= 50` (post-Full-Profile state currently renders... — confirm with T-00 what shows today past Q50; likely nothing, since `ongoing-round.ts` has zero callers). Manual-tap trigger, copy "are you ready for questions related to you?" per the plan, no auto-fire. On round submit: axis updates via the existing `mergeTraitWrite`/`updateTraits` path (unchanged, already the sole write path per CLAUDE.md), then award 21 ATO tokens (§5) and re-show the trigger for the next round.

## 3. CATEGORIZE → Explore read-only statements

**Removed (needs emci's approval — RPC/schema removal):**
- `answer_category_question_item`, `finalize_category_batches` RPCs — defined `supabase/migrations/wave44_category_question_batches.sql:137-219`. New migration to `drop function` both (cannot edit wave44 in place per this repo's convention of new migrations over live-applied ones — same pattern as wave47 patching wave46).
- Client callers: `src/lib/questions/category-batch.ts`, `category-batch-store.ts` (whole Q&A composition path — `composeCategoryBatch`, `categoryBatchAxisPlan`, `tallyAxisPlan`, `categoryBatchProgressFrom`, `allCategoryBatchesLocked`) — either deleted or repurposed; recommend deleting once the new statement path is proven, since none of it applies to a read-only statement model.
- `category_question_items`, `category_question_batches` tables (wave44) — either dropped or left in place but unused (dropping is cleaner but is a real destructive schema change; flag explicitly for emci — recommend leaving the tables in place, unused, rather than dropping, to avoid an irreversible migration for zero benefit).
- `src/components/categories-fold.tsx`'s current Q&A rendering — replaced with a read-only statement renderer.

**Net-new:**
- `src/lib/categories/generate-statements.ts` — one AI call producing all 11 `CATEGORY_DEFS` statements together (`src/lib/categories.ts:45+`, mapping unchanged per the plan). New call-site metadata `CATEGORY_STATEMENTS_META` (personalized: true).
- New table `category_statements`: `id, user_id, category_id text, statement text, created_at, superseded_at` (nullable — set when a reroll or the archive-cap pushes it out of the visible set; mirrors the archive mechanic in §6). Needs emci's approval (new schema).
- `src/lib/categories/store.ts` — `fetchCurrentStatements(userId)` (latest per category), `fetchStatementHistory(userId, categoryId)` (archive read, same shape as `fetchRevealedRollItems`).
- UI: statement display lives inside `src/app/(tabs)/explore.tsx` (already hosts `categories-fold.tsx` — no tab move needed, confirmed in §0.2), reroll button per category (§5 pricing/caps), archive fold per category (§6).

## 4. LEGENDS — 64-archetype replacement

**Classification (net-new, small, no schema):**
- `src/lib/legends64/classify.ts` — `midpointHighLow(value): 'H'|'L'` (straight `>= 0.5` split, a NEW helper, deliberately not reusing `traitBand`'s 0.67/0.33 bands per the plan — those stay as-is for existing Legends/Explore/Sage Title consumers). `coreCode(tracks)` from conscientiousness × extraversion × openness (8 combos), `modifierCode(tracks)` from agreeableness × conflict_assertiveness × relatedness (8 combos). `archetypeCode(tracks)` = the concatenation, e.g. `HLH-LHL` (8×8=64 total, deterministic, always exactly one match — no "hits" ambiguity like the old 3-axis matcher).

**Net-new content (static file, no schema, but real authoring work):**
- `src/lib/legends64/archetypes.ts` — 64 entries keyed by code, each with 6 name sets (`real, gaming, godType, anime, funny, dark`) — 384 total name strings to author. Same one-time-content convention as `QUESTIONS_BANK`/`ArchetypeDef` (AI-assisted authoring, hand-reviewed, guard-word-checked). No story text lives here — story is generated fresh per §4's AI step below, per the plan ("not pulled from a pre-authored library").

**Net-new schema (needs emci's approval):**
- `legend_generations` table: `id, user_id, archetype_code, story text, generated_at`. One row per generation (manual tap trigger, not auto) — this is what makes the archive ("if/how a user's archetype changed over time") possible, since code+story are snapshotted together per the plan. Replaces `trait_rolls`-as-legend-storage for the live Legends screen; does NOT touch `user_legend_history` (that table stays, orphaned, tied to the old figure-catalog system — recommend leaving in place unused, same reasoning as §3's category tables).

**Net-new code:**
- `src/lib/legends64/generate-story.ts` — one AI call for flavor text given `archetypeCode` + axis values. New call-site metadata `LEGEND_STORY_META` (personalized: true, not bucket-shareable — archetype code alone determines the classification but the plan calls for "fresh story per generation," implying per-user grounding, not a bucketed/cached story).
- `src/lib/legends64/store.ts` — `saveGeneration(userId, code, story)`, `fetchCurrentGeneration(userId)`, `fetchGenerationHistory(userId)` (archive read).

**Removed/replaced:**
- `src/lib/legends/match.ts` (`buildLegendView`, `countPoleHits`, `parseAxisCombo`) — replaced by `classify.ts` for the live Legends screen. Do not delete outright yet — `src/lib/rolls/compose.ts` still imports it (see §0.3 open question, §7).
- `src/app/(tabs)/legends.tsx` — rewired from `buildLegendView`/catalog-fetch to `archetypeCode()` + manual-tap `generate-story` + `legend_generations` read, with the theme-skin tap-switcher as pure client-side state (swapping which of the 6 name sets renders — no regeneration). Copy: "let's search your legend?" trigger per the plan. Confirm with emci whether switching skins re-shows the SAME generated story under a different title, or story text also varies by skin — plan text implies one story per generation, skin only changes the displayed name; flagged as an assumption to confirm, not decided unilaterally.
- Archive fold: reuse the `RollHistoryFold` pattern (`src/components/roll-history-fold.tsx`) generalized or duplicated for `legend_generations`, latest ~3 visible per the plan.

## 5. TOKENS — new "ATO tokens" currency

**Net-new schema (needs emci's approval):**
- `profiles.ato_tokens int not null default 0` (mirrors `me.tokens`, the existing Sage-token balance column — confirm exact table name for `me`, likely `profiles` or `users`; verify at build time, not guessed here).
- `ato_token_events` — new ledger table, same shape as `token_events` (`user_id, delta, reason, created_at`), but a **separate table**, not a shared reason string on `token_events` — the existing `token_events_reason_known` check constraint (wave46) is specific to the Sage economy and mixing currencies into one ledger would make balance queries ambiguous. New reasons: `full_profile_complete` (+21, once-ever — mirrors `claim_intake_complete`'s pattern), `ongoing_round_complete` (+21, once-per-round — this is exactly the "round_complete" concept wave45 deliberately deferred pending real round-tracking state; that state now exists once §2's `question_packs.kind='ongoing_round'` rows land, so this is buildable, not still-blocked), `legend_reroll` (-10), `category_reroll` (-1, needs `category_id` on the ledger row or in a JSON detail column to distinguish per-category caps), `question_reroll` (-1, needs a `question_item_id` reference similarly).
- Daily caps: **reuse the ledger-partial-unique-index pattern** already proven in wave45 (`token_events_earn_once_per_day`), not `app_config` columns (those suit single global caps like `rolls_daily_cap`; per-category/per-question caps need a `(user_id, reason, category_id, date)`-scoped uniqueness, which is a ledger constraint, not a config value). One partial unique index per reroll reason, scoped by local calendar day (timezone-aware, matching `localYmd` usage elsewhere).

**Net-new RPCs** (new migration, mirrors `wave45`/`wave46`'s `earn_tokens`/`claim_*`/`spend_tokens` exactly):
- `claim_full_profile_complete()`, `claim_ongoing_round_complete(pack_id)`, `spend_ato_tokens_legend_reroll()`, `spend_ato_tokens_category_reroll(category_id)`, `spend_ato_tokens_question_reroll(question_item_id)` — each atomic (advisory-lock pattern from `reveal_roll_item`), each checking its own daily-cap unique index before crediting/debiting.

**Client:**
- `src/lib/ato-tokens.ts` — mirrors `src/lib/tokens.ts`'s shape (`ATO_TOKEN_EARN`, `ATO_TOKEN_PRICE`, wrapper functions), kept as a fully separate module (not merged into `tokens.ts`) since the plan is explicit these are separate currencies with separate displays.
- Reroll buttons (Legends, per-category, per-question) each call their spend RPC, then re-trigger the relevant generation (§3/§4/§2's question-level reroll — note: item 5 also implies individual QUESTIONS can be rerolled 1 token each, which is new scope not covered in §2 above; needs a per-question regenerate action wired into whichever question surface allows it — likely the ongoing-round display, confirm with emci whether frozen-intake (pre-50) questions are also rerollable or only post-50 ongoing-round ones, since the plan doesn't say).

## 6. ARCHIVE

- Legends: `legend_generations`, latest 3 visible (exact count adjustable — make it a named constant, not hardcoded 3 in multiple places), rest behind an expandable archive fold (reuse `RollHistoryFold` pattern).
- Categorize: `category_statements`, same latest-N-visible + archive-fold pattern, per category (11 independent archive folds, or one combined archive view grouped by category — recommend one combined view to avoid 11 separate UI folds; confirm with emci).
- Reroll button hides once the day's cap is spent — read via the same ledger-unique-index check used to enforce the cap server-side (client does a lightweight "did I already use today's reroll" read, not a separate flag column).

## 7. Open questions for emci (before or during build)

1. **`/roll`'s legend item breaks when `buildLegendView`/the old catalog is replaced.** `compose.ts:132-159` needs either: (a) rewire to the new 64-archetype system too (duplicating the live Legends generation inside a roll), or (b) roll's legend item is dropped/degrades to `{ready:false}` permanently, or (c) `/roll` itself is out of scope / already dead and this is moot. `/roll` is currently a hidden, unlaunched tab (`HIDDEN_TAB_ROUTES`) — recommend (c)-adjacent: leave `/roll` broken/unwired for legend items until a decision is made, since it's not user-reachable today, but flag it so it doesn't silently ship half-working if `/roll` is ever surfaced.
2. **Legend skin switching: same story text under 6 titles, or does story vary per skin too?** Plan text reads as the former; assumed but not decided.
3. **Category archive: 11 separate folds or one combined view?**
4. **Should `question_bank_pool` seed from the existing 50-question `QUESTIONS_BANK`, or start empty?**
5. **Are pre-50 (frozen intake) questions ever individually rerollable for 1 ATO token, or is per-question reroll only a post-50 ongoing-round feature?** The plan's §5 reroll pricing doesn't scope this.
6. **Dropping `category_question_items`/`category_question_batches`/`answer_category_question_item`/`finalize_category_batches` outright, vs. leaving the tables/RPCs in place unused.** Recommend leaving in place (non-destructive) unless emci wants them fully removed.
7. **Exact column/table name for the user's token balance** (`me.tokens` — confirm actual table, likely `profiles`) before writing the `ato_tokens` migration.

## 8. Build order (dependencies)

```
T-00  Verify unlock gate (no-op expected)                         [no deps]
T-01  question_bank_pool schema + seed                             [needs emci: schema]
T-02  fetchRecentTexts + bank-pool fill wired into ongoing-round.ts [depends: T-01]
T-03  Ongoing-round UI trigger + save path (question_items reuse)  [depends: T-02]
T-04  ato_tokens schema + ledger + RPCs                             [needs emci: schema]
T-05  claim_ongoing_round_complete wired into T-03's submit path   [depends: T-03, T-04]
T-06  claim_full_profile_complete wired into existing Q50 crossing  [depends: T-04]
T-07  category_statements schema + generate-statements AI call     [needs emci: schema]
T-08  Explore statement UI (replaces categories-fold Q&A)          [depends: T-07]
T-09  Remove answer_category_question_item/finalize_category_batches RPCs (or leave unused per emci's call) [depends: T-08 proven working]
T-10  category reroll (spend RPC + UI) + daily cap + archive        [depends: T-04, T-07]
T-11  Archetype classify.ts + archetypes.ts content (64×6 names)   [no deps, can start anytime]
T-12  legend_generations schema + generate-story AI call            [needs emci: schema]
T-13  Legends screen rewire (manual trigger, skin switch, archive)  [depends: T-11, T-12]
T-14  Legend reroll (spend RPC + UI) + daily cap                    [depends: T-04, T-12]
T-15  Resolve open question #1 (/roll's legend item)                [depends: T-13, decision from emci]
```

Smallest useful vertical slice first: **T-11 (archetype content, zero risk, no schema) → T-01/T-02/T-03 (questions, since the bank concept and ongoing-round wiring unblock the token round-completion event) → T-04 (tokens, needed by both remaining features) → T-07/T-08 (categorize) → T-12/T-13 (legends)**, with reroll/archive (T-09/10/14) as a final pass once the primary content generation for each area works end-to-end.
