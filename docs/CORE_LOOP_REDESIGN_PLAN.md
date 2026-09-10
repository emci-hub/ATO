# Core Loop Redesign — Mechanical Implementation Plan

Status: **Planning only, nothing built.** Written 2026-09-09 from a finalized product plan (6 items) plus a full investigation of current code. Updated 2026-09-09 with emci's answers to all 7 open questions (see §7) — those decisions are now load-bearing on §2-§6 below. This doc is the source of truth for the build; `PROJECT_CONTEXT.md`'s Snapshot/Decisions Log carries only a pointer + one-paragraph summary, same convention as `docs/archive/TRAIT_SYSTEM_REDESIGN_PLAN.md`.

## STANDING POLICY (2026-09-10) — clean slate, not staged migration. Read this before touching anything below.

**Every remaining card in this plan replaces its old system outright — delete first (or as part of the same pass), don't preserve, don't build coexistence/compatibility logic, don't stage "add new → verify → drop old" across multiple sessions.** This app is pre-launch with no real user data (confirmed, §7 Q11) — the caution baked into earlier cards' sequencing (never a window with neither system, verify-before-drop) was protecting against a risk that doesn't exist. It cost real, avoidable work: reroll UI/RPCs got built against `category_question_items` and the old `legend_figures`/`legend_variants`/`archetype_defs` matcher (both scheduled for deletion in this same doc), and a whole unplanned "legend candidates" content-authoring tool got built for a content library the new 64-archetype system was never going to use. None of that should have happened, and every remaining card should actively avoid repeating it.

**What this means concretely for whoever builds the rest of this plan:**
- Don't investigate how to reuse, migrate, or transition old data/content into the new system. There is nothing to preserve.
- When you find something that imports or depends on a file/table being deleted (e.g. `/roll`'s `compose.ts`/`run.ts` importing the old Legends matcher), the answer is almost always: **stub it out to degrade gracefully**, matching whatever "not ready" pattern already exists nearby — not rewire it to the new system (that's separate, unrequested scope) and not preserve the old dependency (that's exactly the thing being removed).
- Drop old tables/RPCs/components as part of the SAME build pass as the new system, not a later, separately-approved cleanup step — unless the investigation turns up a real reason a live window matters (it currently doesn't for anything left in this plan).
- This applies to everything still open as of this note: the Legends rewrite (old T-12/T-13, including fully deleting the legend-candidates tool from wave55/56) and anything else discovered later that still touches an old system this plan replaces.
- Schema changes (including drops) still need emci's explicit approval and a look at the exact migration before it's written — that rule doesn't change. What changes is not staging the drop as its own separately-approved-later card.

## 0. Corrections to the finalized plan (read this first)

1. **Item 1 (Unlock) is already shipped, not new work.** `src/lib/questions/progressive-unlock.ts` already gates Sage at `answered >= 25` (`SAGE_UNLOCK_THRESHOLD`) and Legends at `answered >= 50` (`LEGENDS_UNLOCK_THRESHOLD`), both driven by `bankTotalProgress(tracks).answered` — a plain count, order-independent, skips already allowed. Call sites: `src/app/(tabs)/sage.tsx:45,299`, `src/app/(tabs)/legends.tsx:27-28,276,300`. Locked-banner UI (not hidden) is already the pattern on both screens (`PROFILE_LOCKED_COPY`/`PROFILE_LOCKED_CTA`). **Nothing to build here** — T-00 below is a verification-only task, not an implementation task.
2. **Item 3 (Categorize) already has no dedicated tab.** `docs/NOW.md`/nav registry (`src/lib/nav/nav-order.ts:54-67`) confirm there is no `categorize` tab id — category batches already render inside Explore via `src/components/categories-fold.tsx`. The real work is converting that fold's Q&A flow to read-only AI statements, not "moving" anything between tabs.
3. **Item 4 (Legends) is a bigger replacement than "swap the matcher."** The live Legends system is not a static 12-archetype file — it's a DB-backed content catalog (`legend_figures` → `legend_variants` → `legend_archetypes` → `archetype_defs`, `src/lib/legends/store.ts`, migrations wave25/26/28/32/33) of **pre-authored historical/mythical figures** matched to archetypes via `buildLegendView` (`src/lib/legends/match.ts`). The new 64-archetype system with fresh-AI-story-per-generation has no figure/story library at all — it replaces this whole content model, not just the matching function. **This also breaks `src/lib/rolls/compose.ts:132-159`**, which calls `buildLegendView` to build a roll's legend item. The finalized plan doesn't mention the dormant `/roll` mechanic — flagged as an open question in §7.
4. **Item 2's "question bank" is new infrastructure, not a reframing of the existing frozen 50-question bank.** `src/lib/questions/bank.ts`'s `QUESTIONS_BANK` is a static, hand-authored, per-install constant (the frozen intake) — it is not a shared/growing/DB-backed pool. The plan's bank ("generation pulls from the bank first, only calls AI when short") needs a **new shared table**, separate from both `QUESTIONS_BANK` (frozen intake content) and `question_items` (per-user answered instances).
5. **`fetchRecentTexts` has no existing implementation to "wire up"** — it's an uncalled dependency slot (`ComposeOngoingRoundDeps.fetchRecentTexts` in `src/lib/questions/ongoing-round.ts`) with zero callers anywhere in `src/`. Real data source recommendation: **`question_items`** (wave17, already shaped for per-user-instance rounds: `pack_id, sort_index, axis, prompt, options, answered_option, answered_at`) is the correct save target — it already supports exactly a "batch of N tagged-by-axis questions, answered over time" shape via `question_packs`. `category_question_items` is a dead end for this (wave44, being removed per item 3).
6. **The intake already has a skip mechanic — it is axis-level, not question-level, and is unrelated to the new post-50 reroll.** `src/lib/questions/deferral.ts` (`normalizeDeferredAxes`/`mergedDeferral`) already implements intake skip: a skipped axis is added to `me.question_deferred` (jsonb array on the user row) and the axis resurfaces in the rotation until it gets a stored trait value, at which point it's auto-pruned. This is existing, shipped behavior — **nothing to build for "skip."** The new post-50 **reroll** (§7 Q4/Q5, resolved) is a completely different, net-new mechanic: question-instance-level (not axis-level), permanent (not "resurfaces later"), and paid (1 token). Do not route reroll through `deferral.ts` — it needs its own exclusion list (§2 below).

## 1. UNLOCK — verification only

**T-00 — Confirm existing gate matches the finalized spec, no code change expected.**
- Files: `src/lib/questions/progressive-unlock.ts`, `src/app/(tabs)/sage.tsx`, `src/app/(tabs)/legends.tsx`.
- Done when: confirm thresholds (25/50) and skip-tolerant counting already match; if a real gap is found (none expected), file it as its own T-card.
- No schema/auth changes.

## 2. QUESTIONS — bank + ongoing round

**Resolved (emci, 2026-09-09):** bank pool seeds from the existing 50-question `QUESTIONS_BANK`, grows toward **~100 total** via AI top-up, and must stay evenly distributed across all 16 axes per the **existing tiered allocation** (`AXIS_TIER_COUNTS`/`tieredAxisCounts()` in `tiered-axis-plan.ts` — tier1/2 axes 6, tier3 4, tier4×10 2, same ratios the frozen intake already uses) for every 25-question round drawn from it. Skip and reroll are two distinct mechanics — do not conflate them (see §0 item 6): skip is intake-only, axis-level, already shipped (`deferral.ts`); reroll is post-50-only, question-instance-level, paid, and creates a **permanent per-user exclusion** (stronger than ordinary never-repeat/history-window logic — a rerolled-away question must never resurface for that user again, even after the general history window would otherwise allow it).

**Net-new schema (needs emci's approval — schema change):**
- `question_bank_pool` — shared, not user-scoped: `id, axis (16-axis check), category, prompt, options jsonb, source ('authored'|'ai'), created_at, times_served int default 0`. Seed migration: bulk-insert `QUESTIONS_BANK`'s 50 items as `source='authored'` rows (dedup key on prompt text). ~100 is a soft steady-state target, not a hard ceiling (Q10, resolved) — no total-count guard needed; the pool simply keeps growing past 100 for as long as real per-axis shortfalls keep generating new AI drafts, and every AI draft always gets written into this table (Q9, resolved — see below) rather than only sometimes.
- `question_bank_reroll_exclusions` — new table, **not** a reuse of `me.question_deferred`: `user_id, question_bank_item_id (fk question_bank_pool), excluded_at`, unique `(user_id, question_bank_item_id)`. This is the permanent per-user "never resurface" list a reroll writes to. Any bank-draw query (for this user's ongoing rounds) must exclude rows in this table in addition to the normal recently-served exclusion.
- Reuses `question_items`/`question_packs` (wave17, already applied) as the per-user instance/answer table for ongoing rounds — no new table needed there, just a new `pack_id` origin (e.g. `question_packs.kind = 'ongoing_round'`, check whether `question_packs` currently has a `kind`/`source` column; if not, add one to distinguish Infinite-Questions packs from ongoing-round packs — schema change, small).

**Net-new code:**
- `src/lib/questions/bank-pool.ts` — `fetchBankCandidates(axis, userId)` (pulls from `question_bank_pool` where `axis = X`, excluding both this user's recently-served set AND their permanent `question_bank_reroll_exclusions` rows), `recordBankUsage(ids)` (bumps `times_served`), `addToBankPool(drafts)` (AI-generated new items get written back to the shared pool, gated on the axis being genuinely short of its tiered target out of the ~100 soft cap — this is what makes it "growing" without unbounded sprawl).
- `src/lib/questions/reroll.ts` — `rerollQuestion(userId, questionItemId)`: spends 1 ATO token (§5), inserts into `question_bank_reroll_exclusions` for the outgoing question's `question_bank_item_id` (**always present** — see the Q9 resolution below, every ongoing-round question has a bank row by the time it's shown to a user, whether it was drawn from the pool or freshly AI-generated), draws one replacement via `fetchBankCandidates` (bank-first, AI-fallback, same as initial round composition), and writes the replacement into the same `question_items` row/slot. Exclusion is strictly per-user: it never hides the bank item from other users, only from the one account that rerolled it away, and it never expires.
- `src/lib/questions/fetch-recent-texts.ts` — implements `fetchRecentTexts(userId): Promise<string[]>` against `question_items.prompt` (join `question_packs` on `user_id`) plus the static `QUESTIONS_BANK` prompts already answered, matching the existing `fetchAskedTexts` pattern already proven in `category-batch.ts:140`.
- Wire `src/lib/questions/ongoing-round.ts`'s `composeOngoingRound` to real deps: `fetchRecentTexts` (above), a `fillFromBank` step inserted before `fillAxisCountsChunked`'s AI generation (bank-first, AI-fallback per the plan), drawing per-axis counts from the SAME `tieredAxisCounts()` allocation the frozen intake uses — this is a real code change inside `ongoing-round.ts`/`chunked-generate.ts`, not just supplying the stub.
- New AI call-site metadata in `src/lib/ai/call-sites.ts`, e.g. `ONGOING_ROUND_META` (personalized: true — prompt is grounded in this user's current axis profile + history, matching `ROLL_META`'s shape but not bucket-shareable).
- Save path: `saveOngoingRoundBatch(userId, drafts)` → new `question_packs` row (`kind='ongoing_round'`) + 25 `question_items` rows, mirroring `category-batch-store.ts`'s existing save pattern. Every row carries a `question_bank_item_id` reference (new FK column on `question_items`, **not nullable for ongoing-round rows** — see the Q9 resolution below: AI-generated drafts are written into `question_bank_pool` before being drawn into a user's round, so a bank row always exists to reference) so `reroll.ts` always has something to exclude.

**UI:**
- New fold/section on the Questions tab (`src/app/(tabs)/intake-sweep.tsx`) that only renders once `bankTotalProgress(tracks).answered >= 50` (post-Full-Profile state currently renders... — confirm with T-00 what shows today past Q50; likely nothing, since `ongoing-round.ts` has zero callers). Manual-tap trigger, copy "are you ready for questions related to you?" per the plan, no auto-fire. Each displayed question gets a reroll control (1 ATO token, calls `rerollQuestion`) — intake questions (pre-50) do NOT get this control, only their existing skip affordance. On round submit: axis updates via the existing `mergeTraitWrite`/`updateTraits` path (unchanged, already the sole write path per CLAUDE.md), then award 21 ATO tokens (§5) and re-show the trigger for the next round.

## 3. CATEGORIZE → Explore read-only statements

**Resolved (emci, 2026-09-09): remove entirely, nothing left dormant.** Both RPCs AND their underlying tables get dropped — no "leave unused" compromise.

**Removed (needs emci's explicit approval at build time — destructive schema change, irreversible):**
- `answer_category_question_item`, `finalize_category_batches` RPCs — defined `supabase/migrations/wave44_category_question_batches.sql:137-219`. New migration: `drop function` both (cannot edit wave44 in place per this repo's convention of new migrations over live-applied ones — same pattern as wave47 patching wave46).
- `category_question_items`, `category_question_batches` tables (wave44) — same migration, `drop table` both, after the RPCs are dropped. **Sequencing matters:** drop only after §3's read-only statement path (`category_statements`) is live and proven (T-08 before T-09 in §8's build order) — do not drop the old tables/RPCs and the new statement path in the same deploy, so there's no window where Categorize has neither.
- Client callers: `src/lib/questions/category-batch.ts`, `category-batch-store.ts` (whole Q&A composition path — `composeCategoryBatch`, `categoryBatchAxisPlan`, `tallyAxisPlan`, `categoryBatchProgressFrom`, `allCategoryBatchesLocked`) — deleted, not repurposed, once the new statement path is proven.
- **Precision correction:** the actual Q&A component to remove, `CategoryBatchFold`, is physically defined inside `src/components/questions-fold.tsx:540` (a file shared with `QuestionsFold`, the unrelated Infinite Questions component) — `categories-fold.tsx` only imports and renders it. Delete `CategoryBatchFold` (and its now-dead imports: `composeCategoryBatch`, `categoryBatchProgressFrom`, etc.) out of `questions-fold.tsx` specifically, without touching `QuestionsFold` in the same file. `categories-fold.tsx` itself then gets the new read-only statement renderer in place of its `CategoryBatchFold` usage.

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
- `src/app/(tabs)/legends.tsx` — rewired from `buildLegendView`/catalog-fetch to `archetypeCode()` + manual-tap `generate-story` + `legend_generations` read, with the theme-skin tap-switcher as pure client-side state (swapping which of the 6 name sets renders — no regeneration, no new fetch). **Resolved (emci, 2026-09-09):** the same generated story is shown under all 6 titles — story text does not vary by skin, only the displayed name/title changes. `legend_generations.story` is generated and stored exactly once per generation, independent of which skin is currently selected client-side; `generate-story.ts` takes no skin parameter. Copy: "let's search your legend?" trigger per the plan.
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
- Categorize: **Resolved (emci, 2026-09-09): 11 separate folds, one per category — not a combined view.** Each category gets its own independent reroll button AND its own independent archive fold (reusing the `RollHistoryFold`-style latest-N-visible + expandable-archive pattern, scoped by `category_id`), matching the per-category daily-cap independence already specified in §5 (up to 11 rerolls/day, one per category). `src/lib/categories/store.ts`'s `fetchStatementHistory(userId, categoryId)` is called once per fold, not once for all 11 combined.
- Reroll button hides once the day's cap is spent — read via the same ledger-unique-index check used to enforce the cap server-side (client does a lightweight "did I already use today's reroll" read, not a separate flag column).

## 7. Open questions for emci — all resolved 2026-09-09

1. **RESOLVED — `/roll`'s legend item stays unwired/broken for now.** Confirmed acceptable since `/roll` is hidden/unlaunched (`HIDDEN_TAB_ROUTES`). `compose.ts:132-159`'s `buildLegendView` call is left as-is (will start failing/degrading once `legend_figures`/`archetype_defs` content stops being maintained, but nothing reads it in production today). T-15 in §8 tracks resolving this later if `/roll` is ever surfaced.
2. **RESOLVED — same generated story shown under all 6 titles; story text does not vary per skin.** See §4.
3. **RESOLVED — 11 separate archive folds, one per category, not a combined view.** Each with its own reroll button and its own archive. See §3/§6.
4. **RESOLVED — `question_bank_pool` seeds from the existing 50-question `QUESTIONS_BANK`, grows toward ~100 total via AI top-up, kept evenly distributed across all 16 axes per the existing tiered allocation.** See §2.
5. **RESOLVED — no reroll on the intake, only skip.** Skip (intake, axis-level, already shipped via `deferral.ts`) and reroll (post-50 ongoing rounds only, question-instance-level, paid, permanent-exclusion) are two separate mechanics with separate storage — see §0 item 6 and §2.
6. **RESOLVED — remove `category_question_items`/`category_question_batches`/`answer_category_question_item`/`finalize_category_batches` entirely.** Nothing left dormant. See §3.
7. **DEFERRED to build time, no plan change needed now.** Exact column/table name for the user's token balance (`me.tokens` — confirm actual table, likely `profiles`) gets confirmed as the first step of T-04, not guessed here.

### Q8-Q11 — resolved 2026-09-09

- **Q8 — RESOLVED: permanent-forever, not time/round-bounded.** `question_bank_reroll_exclusions` stays keyed `(user_id, question_bank_item_id)`, no expiry. If a user's exclusion list eventually starves a given axis for them personally, the existing "AI tops up when short" mechanism (§2) is what covers it — no separate handling needed. **Explicitly per-user, not global**: other users still see and can be served a question that a different user rerolled away; only that one user's own account carries the exclusion. (`question_bank_pool` rows are never deleted or hidden globally by a reroll — only the per-user join table changes.)
- **Q9 — RESOLVED: same durable exclusion regardless of source (bank-drawn or freshly AI-generated).** This changes the design from the previous draft: rather than giving AI-generated-fresh questions a weaker guarantee (relying on the history window), **every ongoing-round question — bank-drawn or freshly generated — now always has a `question_bank_pool` row before it's ever shown to a user.** Concretely: when `fillFromBank` needs to AI-generate because an axis is short, `addToBankPool` writes the new draft into `question_bank_pool` FIRST, and only then is it drawn into that user's `question_items` row referencing it. This means `question_items.question_bank_item_id` is **always populated for ongoing-round questions**, never null (revising §2's earlier "AI-generated-fresh leaves it null" note) — `reroll.ts` no longer needs a special case for "no bank row to attach an exclusion to." This also directly serves item 2's "shared, growing" bank goal (Q10) — nothing generated is ever thrown away after just one use.
- **Q10 — RESOLVED: soft steady-state target, not a hard ceiling.** ~100 is a seed goal to reach, not a cap — the pool keeps growing past it whenever AI generates to fill a real per-axis shortfall (now guaranteed to happen for every ongoing-round generation, per Q9's revised design). `addToBankPool` needs no total-count guard, only the per-axis-shortfall check already planned.
- **Q11 — RESOLVED: drop outright, no data-preservation step.** Confirmed pre-launch with no real user data — nothing to export. §3's "remove entirely" stands as originally written, no changes needed there.

### Real gaps found during this pass (not questions — concrete corrections, applied below)

- **`question_items.axis`'s check constraint is missing `playfulness`** (`wave17_infinite_questions.sql:181-187` lists only 15 of the 16 `TRAIT_AXES` — `playfulness` is absent). This is a pre-existing bug, not something the redesign introduces, but the ongoing-round loop (§2) will hit it immediately the first time it tries to save a `playfulness`-tagged question, since `tieredAxisCounts()` covers all 16 axes. **Fix folded into T-02** (§8): a small migration widening the check constraint to all 16 axes before `question_items` is used as the ongoing-round save target.
- **The category-batch Q&A component that actually needs replacing, `CategoryBatchFold`, is physically defined inside `src/components/questions-fold.tsx`** (line 540), not in `categories-fold.tsx` — `categories-fold.tsx` only imports and renders it (`import { CategoryBatchFold } from '@/components/questions-fold'`). `questions-fold.tsx` also defines `QuestionsFold` (Infinite Questions) in the same file. §3 and T-08/T-09 (§8) now note this explicitly: removing the category-batch UI means deleting `CategoryBatchFold` out of `questions-fold.tsx` specifically, without disturbing `QuestionsFold` in the same file. Checked `src/lib/milestones.ts` for any milestone keyed on category-batch completion/finalization — none found, so dropping the old tables/RPCs is confirmed safe with respect to milestones.

## 8. Build order (dependencies)

```
T-00  Verify unlock gate (no-op expected)                         [no deps]
T-01  question_bank_pool schema + seed                             [needs emci: schema]
T-02  fetchRecentTexts + bank-pool fill wired into ongoing-round.ts [depends: T-01]
      (CORRECTED 2026-09-09, mid-T-02, caught by this session's own review
      before push: the note that used to be here — "also fixes the
      pre-existing question_items.axis check constraint, missing
      'playfulness', wave17" — was wrong. That check was already replaced by
      `question_items_axis_known` in wave21_playfulness_categories.sql, with
      wave27_drop_stale_question_items_axis_check.sql dropping the old
      15-axis constraint by name specifically so the two can't coexist.
      wave49's "re-verified — confirmed stale, no fix needed" comment was
      correct all along. No axis-check change was needed in wave50; the
      earlier draft of wave50 that re-added it was reverted before push.)
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

### Session boundaries

Each T-card above is scoped as one complete, independently checkable deliverable (its own files, its own Done-when/Check) — none of them leave mid-edit work in a file for the next card to pick up. That means **every card in this list is a clean breakpoint: run each as its own fresh chat session by default**, not chained in one long session. A fresh session re-reads this doc plus the relevant file(s) named in the card, which is cheap and gets a clean context window per card rather than one long session accumulating unrelated history across areas.

The one thing that changes this: if, when actually building a card, real work turns out to spill into a second file mid-task in a way not anticipated here (e.g. T-02's bank-pool wiring turns out to require an unplanned change inside T-01's just-written migration because a column was missed), finish that spillover in the SAME session rather than closing and reopening — only start a fresh session at an actual card boundary, not mid-fix. Absent that, no pair of cards in this plan requires shared session context to be correct; the dependency arrows above (`[depends: ...]`) mean "must be done and pushed first," not "must be done in the same session."

Two soft groupings where running consecutively in one session is a convenience (not a requirement) since they're small and touch the same small area back-to-back: **T-05 + T-06** (both trivial claim-RPC wiring into existing UI once T-04 lands) and **T-01 + T-02** (bank schema immediately followed by wiring it, while the exact column names are fresh) — but neither needs to happen this way; splitting them is equally correct.
