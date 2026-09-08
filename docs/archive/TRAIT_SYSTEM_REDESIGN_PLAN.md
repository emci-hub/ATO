# Trait system redesign — FINAL agreed design, ready for task-card planning

**Read this whole file before doing anything.** This is a complete handoff of a long
design conversation — every number, formula, and decision below was deliberated and
confirmed, not guessed. Nothing in this file has been built, migrated, or turned into
task cards yet. Companion file: `LEGENDS_ARCHETYPES_DRAFT.md` (the 64-archetype
naming system, 6 selectable themes — referenced below, not repeated here).

**Process for building this**: this is large — 9 phases, each touching schema, AI
generation, or core measurement code. Per this repo's own CLAUDE.md rules: schema
changes need the exact change shown and explicit approval before writing, every time,
no exceptions. Recommended approach (agreed with emci): build through all 9 phases
continuously without stopping to ask "should I proceed" after each one, but still run
the full automated check suite + a reviewer pass after every phase before starting the
next — and still pause specifically for schema approval each time a phase needs new
tables. One final OTA deploy once every phase is built and individually verified, not
9 separate deploys. See the manual test checklist at the very end for after deploy.

**Kickoff instructions for whoever builds this**: investigate the actual current
code before touching anything — don't assume a file's shape from this document, read
it first. Reuse what already exists everywhere this plan says to reuse it; do not
introduce a new pattern, abstraction, or library where an existing one in this repo
already does the job. Stay inside the scope this plan actually describes — no
unrelated refactors, no "while I'm in here" cleanup, no features not listed here. This
repo's own CLAUDE.md already enforces all of this (investigate first, smallest safe
change, preserve existing patterns) — this note is just making it explicit for this
specific handoff, since the scope is large enough that drift is the real risk.

---

## 1. The core split

**Axes measure. Categories explain. Never mixed again.**

- **Asking questions** goes straight through the 16 axes directly, weighted by
  priority — never routed through categories. Categories overlap on purpose (real
  psychological pairings like the Love/closeness attachment map, and deliberate
  double-narrative axes like extraversion appearing in 2 categories). Routing
  question-selection through that overlap causes axes to get over/under-sampled with
  zero human intent — proven with real numbers: asking 1 question per category across
  all 11 gave 12 of 16 axes 2 hits, 4 axes only 1, purely from category structure.
- **Reading results back to the user** already works exactly right, today, with zero
  changes needed — `readCategory` (`src/lib/categories.ts`) already builds bars/maps
  purely from whatever axis values exist, regardless of how they were answered. This
  redesign does not touch that function.

## 2. Axis priority tiers

Ranked by how often each axis is already used across the app's existing 12-archetype
catalog (real internal signal — 4 of the top 6 also happen to be actual Big Five
dimensions, an independent confirmation):

| Tier | Axes | Questions/round |
|---|---|---|
| 1 | conscientiousness, extraversion | 3 each |
| 2 | openness | 3 |
| 3 | agreeableness, conflict_assertiveness, relatedness | 2 each |
| 4 | steadiness, attachment_anxiety, attachment_avoidance, conflict_cooperativeness, autonomy, competence, growth_mindset, locus_of_control, self_efficacy, playfulness | 1 each |

Total per round: 6 + 3 + 6 + 10 = **25 questions**.

## 3. The question structure ("Plan A")

1. **Round 1**: 25 questions, tiered allocation above, straight per-axis. Reuses the
   generation infra already built this session for the 5-per-category batch feature
   (`buildQuestionsPrompt`'s existing `count`/`axisCounts`/`excludeText` params) —
   just fed a tier-derived `axisCounts` map instead of a category-derived one.
2. **Round 2**: the same 25-question tiered allocation, run again. After both rounds,
   every axis has at least 2 answers (tier 4: 1+1=2, up to tier 1: 3+3=6).
3. **50 total = the new Full Profile.** Submission/completion point. Also the point
   where progressive unlock finishes (see §6) and rolling becomes available (§7).
4. **After Full Profile is complete**: an ongoing round keeps generating more
   questions the same way Infinite Questions already works today, grounded in the
   completed profile (same pattern the app already uses for grounding in known
   facts/recent moments), not a fixed second batch.

**Chunking**: 25 in one generation call is unsafe — already proven this session that
the shared `ai-generate` function's 1024-token server cap makes anything past ~5
questions per call unreliable. Reuse the exact "save what comes back immediately,
retry only for the remainder, cap each call at ≤5" pattern already built (and then
reverted to a simpler form) for the category-batch feature — this restructure
actually needs that original multi-call chunking version, not the simplified one.

**Static intake generation**: run this new tiered generator **once**, save the
50-question output, reuse that frozen set for every new user (same content-creation
pattern as the 64 archetype names — AI-assisted authoring, not live-per-user
generation). This avoids per-signup AI cost/reliability risk and replaces the current
hand-authored 48-question bank (`bank.ts`, flat 3/axis, no priority). Reuses 100% of
the existing bank read-side code (`bankByAxis`, `bankDraftFor`, `bankProgressForAxis`)
— just different (AI-authored, unevenly-weighted-per-axis) content in the same shape.
**A check script must assert the frozen intake still covers every axis in
`TRAIT_AXES`** (required, not optional), failing the OTA gate if they ever diverge —
e.g. a future 17th axis gets added and nobody remembers to regenerate the intake.
Same convention as every other invariant this app already encodes as `check:*`
scripts; a documentation reminder alone is not enough.
```ts
for (const axis of TRAIT_AXES) {
  assert.ok(frozenIntake.some(q => q.axis === axis), `intake missing coverage for ${axis}`);
}
```

**Repeat prevention — final 3-layer design (real item for this redesign, not deferred):**
1. **Exact-text matching** against a *bounded* recent window (~25-30 questions, roughly
   one round) — not the user's entire lifetime history. Grounded in real memory
   research (Ebbinghaus forgetting curve: ~70% of unreinforced content forgotten
   within a day, ~90% within a month) — a repeat outside this window is very unlikely
   to be noticed, and it keeps the prompt small and safely under the token ceiling
   already hit twice this session. Same architectural shape as the existing
   `recentAskedAxes` window (size 3, for axis variety) — this is that same pattern,
   sized for question text instead of axis labels.
2. **Verify-and-retry after generation** — don't just instruct the model not to
   repeat (that's already in the prompt today and can still be ignored); actually
   check the output against the recent window afterward, and if something slips
   through as a near-duplicate, retry just that item. Reuses the existing
   generate-check-retry-remainder pattern already built for chunked generation.
3. **Ground new questions in past *answers*, not just avoid past question *text*** —
   feed recent answers into the same "grounding" mechanism the app already uses for
   personal facts/recent moments. A question that's actually about the specific
   person is naturally less likely to feel repetitive than one that's merely
   avoiding a blacklist — this is the strongest lever of the three, and it's not new
   infrastructure, just a new input into something that already exists.

**Display**: `CategoryPagedQuestions` (the paginated, position-remembering component
built earlier this session) can likely be reused as-is for rendering, fed axis tiers
as its "groups" instead of categories — confirm this during implementation, don't
assume without checking the component's actual prop shape first.

## 4. Trait-value updates — Kalman-style, replacing fixed EWMA

**Problem this solves**: today (`trait-stability.ts`, `applyEwmaAnswer`), every new
answer moves an axis's value by the same fixed weight (`EWMA_ALPHA = 0.35`) no matter
how many prior answers exist — a person's 50th answer swings the number exactly as
much as their 2nd. Real-world example that exposed this: 10 straight consistent
answers settle a value near 0.1, then one contradicting answer still jumps it to
~0.38 — same jump size it would cause on the very first re-answer.

**Fix**: replace the fixed `EWMA_ALPHA` constant with a computed Kalman gain. This is
the real, named, industry-standard formula for "precision-weighted sequential
estimation" (the formal version of Item Response Theory's confidence-weighted
approach) — not invented for this app, a well-established technique.

**Full, final formula (includes a variance floor and a first-few-answers exception —
both required, found during red-teaming the naive version):**

```
if answerCount < STABILITY_FLOOR_N (3):
  new_value = simple_average(old_value, new_answer)   # gentle start, no Kalman yet
  new_stability = 0                                    # matches existing floor rule
else:
  kalman_gain   = prior_variance / (prior_variance + measurement_noise)
  new_value     = old_value + kalman_gain * (new_answer - old_value)
  new_variance  = max(MIN_VARIANCE, (1 - kalman_gain) * prior_variance)
  new_stability = 1 - new_variance
```

- `prior_variance` starts high (low confidence, early answers) and shrinks with every
  update — this is what makes later answers move the value less than earlier ones,
  automatically, without any special-casing.
- `measurement_noise` is a tunable constant representing "how noisy is one raw
  answer" — needs a real starting value decided during implementation (a reasonable
  default to start testing with, then tune).
- **`MIN_VARIANCE` floor is required, not optional** — without it, a well-established
  axis's variance can shrink toward zero and the axis becomes permanently unable to
  move again, ever, even from genuine future change. Same failure class the existing
  `STABILITY_INCONSISTENT_FLOOR` already exists to prevent for the current system.
  The existing 60-90 day stability decay mechanism already provides the natural
  "loosen back up over time" recovery path on top of this floor — no new decay logic
  needs inventing.
- **The `answerCount < STABILITY_FLOOR_N` branch is required, not optional** — Kalman
  gain starts near 1 (low confidence trusts new signal fully), which would otherwise
  give someone's very first few answers outsized permanent influence. Reuses the
  existing `STABILITY_FLOOR_N` (3) constant rather than inventing a new number.
- Small, contained code change overall: lives inside `applyEwmaAnswer`. Same function
  signature, same inputs/outputs, same downstream consumers (Categories, Full
  Profile, Story — everything reading `value`/`stability` keeps working unchanged,
  since those field names and shapes don't change).

**Implementation note (2026-09-08, T-01 build) — two deviations from the spec above,
found necessary by real test breakage, not by choice:**
1. **No separate `answerCount < STABILITY_FLOOR_N` branch was built.** It turned out
   redundant: `prior_variance` is derived from `1 - stability` every time, and
   `stability` itself already starts at 0 and only grows once real agreement is
   established — so `prior_variance` is already at its ceiling (~1, gain near 1) for
   an axis's first answers without a hardcoded branch forcing it. A first attempt
   *did* build the literal branch and it broke `stableReport`-style "3 identical
   answers = settled" fixtures used across many existing check scripts (delayed
   confidence ramp-up by one answer). Dropping the branch fixed that.
2. **`stability` was NOT changed to the Kalman-variance formula
   (`new_variance = max(MIN_VARIANCE, (1-K)*prior_variance)`, `new_stability = 1 -
   new_variance`) the spec above calls "required, not optional."** It keeps the
   *original* pre-redesign agreement-based formula (delta/agreement blended at
   `EWMA_ALPHA`), completely untouched. Reason: a pure Kalman-variance stability
   update has no disagreement term, so it climbs every answer regardless of whether
   answers keep contradicting each other — this would have silently disabled
   `isInconsistentAnswerer`'s trap detection (`STABILITY_FLOOR_OVERRIDE_N`,
   `trait-stability.ts`), which specifically depends on raw stability staying pinned
   at exactly 0 under maximal disagreement, and is proven by an existing test
   (`trait-stability-check.ts`'s adversarial-answerer fixture). `KALMAN_MEASUREMENT_NOISE`
   was calibrated to `(1 - EWMA_ALPHA) / EWMA_ALPHA` specifically so the Kalman gain
   used for `value` equals `EWMA_ALPHA` exactly whenever `stability === 0` — i.e.
   `value`'s update is mathematically equivalent to the old fixed-EWMA formula for
   any not-yet-settled axis, diverging (moving less) only once real stability has
   built up.
   - **Consequence for §5 below:** the claim that RCI's `standard_error` and this
     section's `variance` are "in sync by construction" is **no longer literally
     true** — there is no persisted/derived Bayesian variance separate from
     `stability`; `standard_error` for RCI must be derived from `stability` the same
     way `prior_variance` is here (`1 - stability`, or an equivalent transform), not
     from a distinct tracked quantity. Whoever builds §5/T-06 needs to re-derive
     `standard_error` from `stability` directly, not assume a separate variance
     field exists anywhere.
   - Real code: `src/lib/trait-stability.ts` (`applyEwmaAnswer`, `KALMAN_MEASUREMENT_NOISE`,
     `KALMAN_MIN_VARIANCE`). Verified via `check:kalman`, `check:trait-stability`, and
     the full `check:ota-gate` (all pre-existing checks stayed green, including two
     that briefly broke during development and were root-caused, not weakened).

## 5. RCI — the re-roll trigger (separate from §4, but consumes its output)

**Problem this solves**: once someone has an unlocked Legend/Category/Story roll sitting
unrevealed, when should the system decide their profile has changed enough to throw
that stale roll away and generate a fresh one? A fixed threshold (e.g. "any axis moved
by X") doesn't work well — see the two worked examples below.

**Fix**: Reliable Change Index (RCI), a real, established clinical-psychometrics
method for exactly this — "did this score change for real, or is it just noise."
**RCI is a comparison/trigger tool only — it does not update any value itself.** It
consumes the `stability`/variance number that §4's Kalman update already produces, so
the two are already in sync by construction, not by coincidence.

```
RCI = (current_value - snapshot_value) / standard_error
```

where `standard_error` derives from the *current* stability (from §4) — meaning the
same size of movement counts as "real change" differently depending on how
well-established the axis already is. Standard clinical cutoff: **|RCI| > 1.65** =
reliable change (a widely-used real-world threshold, not invented for this app).

**Worked examples** (already validated together):

*Normal day-to-day fluctuation — should NOT trigger a re-roll:*
openness moves 0.72 → 0.75 → 0.78 over several days while stability stays high — RCI
stays under 1.65 throughout. No re-roll, even though the person keeps answering
questions and the number keeps nudging.

*A real, sustained change — SHOULD trigger a re-roll:*
conflict_assertiveness starts at 0.30 ("steps back in a disagreement"), and over weeks
of consistent contrary answers moves to 0.68 ("puts their own point on the table") —
crossed to the opposite pole entirely, stability stayed high the whole time (a
consistent new pattern, not noise). RCI comes out around 9.5, far past 1.65 — clearly
real. This is what triggers a re-roll.

**What's needed to implement this**: a stored snapshot of each axis's `value` and
`stability` taken at the moment of the last roll (see §7's schema) — RCI compares
*current* value/stability against that *stored* snapshot. No changes needed to how
axes are answered/stored otherwise — this is a read-only comparison layered on top.

## 6. Progressive unlock (first 50 questions only)

- Questions 1-24: Sage and Legends both hidden.
- **Question 25 answered**: unlock Sage. Show a congrats banner explaining what Sage
  is, and mention that 25 more unlocks Legends.
- Questions 26-49: Sage now usable, Legends still hidden.
- **Question 50 answered**: unlock Legends. Show a congrats banner explaining what
  Legends is, plus a separate "you are now fully unlocked" banner.
- This gating applies **only** to the first-50 intake. Once complete, everything
  stays unlocked permanently — no re-locking on the ongoing post-Full-Profile
  question loop.

## 7. Tokens, rolls, and reveals

**Token economy (testing-phase values, deliberately generous — tighten later)**:
- +20 tokens on completing the 50-question intake.
- +13 tokens per completed 25-question round after that.
- These are **new, dedicated earn events** — do NOT reuse the existing `game_round`
  bucket in `tokens.ts`/`wave19_trait_history_tokens.sql`, which is capped once per
  day flat (5 tokens) regardless of how many questions are answered, and would not
  give the payout described above.
- Design earning as reason-extensible (a `reason` field per earn event row), same
  shape the existing Notes economy already uses — this lets future sources (e.g.
  games) plug in later by adding a new reason string, no schema change needed then.
- **Grants must be server-side idempotent — a required part of the design, not a
  later hardening pass.** A client "I finished" call must never be trustable alone.
  Same pattern already proven for `game_round` (`token_events_earn_once_per_day`),
  scoped differently here: `intake_complete` is once-ever per user; `round_complete`
  is once per round number (rounds repeat forever, each one only pays out once).
  ```sql
  create unique index token_events_intake_once
    on token_events (user_id) where reason = 'intake_complete';
  create unique index token_events_round_once
    on token_events (user_id, round_number) where reason = 'round_complete';
  ```

**Roll mechanic** — one "roll" computes everything together, not three separate
actions:
- A roll triggers one backend pass that generates/matches **all of it at once**:
  the Legend match (reuses existing `src/lib/legends/match.ts` scoring against the
  current full profile — deterministic, NOT random/gacha), all 11 category reads (new
  AI-generated narrative text per category, see below), and a Story. All results are
  computed and stored immediately, even though the user hasn't seen them yet.
- The user spends tokens to **reveal** individual pieces from that already-computed
  set, one at a time — revealing doesn't trigger new generation, it just unhides
  already-stored content. Costs (testing-phase): 5 tokens for the legend, 1 token per
  category.
- **Revealed items stay visible forever**, regardless of what happens to the
  person's profile afterward, and **must always show their reveal date prominently on
  screen** (e.g. "revealed 3 months ago") every time they're viewed — not just stored
  in `revealed_at`. Old content stays frozen forever by design; without a visible
  date it can misread as a current description of someone it no longer describes. A
  stronger "this was true of you on [date]" disclaimer for older content is good
  future polish, not required for this to ship correctly.
- **Unrevealed items are tied to the profile snapshot from when they were rolled.**
  If RCI (§5) detects a real profile change before all items from a roll are
  revealed, the unrevealed leftovers are discarded and a **fresh full set** (legend +
  categories + story) is generated and cached against the new profile. This is the
  entire point of the backfill design: most reveals cost zero extra AI calls (already
  computed at roll time), and regeneration only happens when the profile has
  genuinely, reliably changed — not on every reveal, not on every tiny fluctuation.
- **Rolling itself — not just revealing — must be gated server-side, or it's free
  unlimited AI cost.** The RCI comparison that decides "is a new roll warranted" must
  run inside the RPC itself, never trusted from the client, plus a blunt daily-cap
  backstop in case that logic ever has a bug — same layered-defense style the
  existing quota RPCs already use.
  ```
  function try_roll(user_id):
    if rolls_today(user_id) >= 1: return "already rolled today"      # backstop
    snapshot = get_last_roll_snapshot(user_id)
    if snapshot is null: proceed()                                    # first ever
    elif max(|RCI| across axes) < 1.65: return "not eligible yet"
    else: proceed()  # generates fresh set, stores new snapshot
  ```
- **Reveal (check balance, deduct, set revealed_at) must be one atomic transaction** —
  two simultaneous reveal requests must not both succeed. Reuse the exact
  `pg_advisory_xact_lock` pattern already trusted in `claim_ai_call`/
  `claim_questions_batch`.
  ```sql
  perform pg_advisory_xact_lock(hashtext(uid::text || ':reveal'));
  -- balance check, deduct, and revealed_at update all happen inside this lock
  ```

**Category reads**: new, personalized narrative text per category (Costar-app style —
e.g. "Love / closeness" produces a written read about the person's attachment
style), generated from that category's `stableAxes`/`texture` values. **Cannot reuse
Story directly** — Story (`src/lib/sage-story.ts`) is explicitly built to never name a
specific category (a hard rule in its own prompt) and is whole-profile-scoped, not
per-category. Needs its own new prompt function, following the same pattern as
`buildStoryPrompt` (reads `readAllCategories` output) but scoped to one category and
without the "never name it" rule. Content not yet drafted.

**Schema shape for rolls** (agreed structure — separate rows per item, not one nested
blob, specifically to support independent per-item reveal state):

```
{ roll_id: "r1", type: "legend",   result: {...}, revealed_at: null }
{ roll_id: "r1", type: "category", category_id: "cat_love",   result: {...}, revealed_at: "2026-09-08T14:32Z" }
{ roll_id: "r1", type: "category", category_id: "cat_agency", result: {...}, revealed_at: null }
... (one row per category, 11 total)
{ roll_id: "r1", type: "story",    result: {...}, revealed_at: null }
```

`revealed_at: null` = generated but hidden, still costs a token to unhide.
`revealed_at: <timestamp>` = already revealed, free to view forever after.

All of this (unlock tier, tokens, roll/reveal records) is **synced via Supabase** —
none of it is cosmetic, it's real progress and real currency, unlike the earlier
category-page-position feature (which is legitimately fine as device-local).

## 8. History / archive views (new UI, low technical risk)

Since revealed items are stored permanently with a `revealed_at` timestamp, add a
history/archive view showing every past revealed result, not just the latest:
- **Explore tab**: past category reads and past legends, each showing when they were
  revealed.
- **Home tab**: past Story reveals, same pattern, alongside the current one.

Low risk because the data model already supports this — it's a list view over data
that's already being stored, no new schema needed beyond what §7 already specifies.

## 9. Story placement (new work, not a copy-paste move)

Story currently lives on the **Explore tab** (`src/app/(tabs)/explore.tsx:172`, via
`SageStoryFold`) and has **no locked-state UI today at all** — when not ready it
renders nothing (`src/components/sage-story-fold.tsx:126`, `if (!story?.body) return
null;`). Moving it to Home (next to the daily check-in) and building a real locked
state ("please answer more questions") is new work on both counts.

## 10. Explicitly decided NOT to build

- **Contradiction/"you're divided on this" surfacing.** Dropped on purpose — verified
  every mainstream personality instrument (Big Five, 16PF, MBTI) ships without this,
  and MMPI (the one system that does detect it) uses it to discard results, not
  explain them kindly — not this app's tone either way.
- **Category-level even coverage.** Checked with real numbers — category point totals
  range 4 to 12 (a 3x spread) once axes are weighted by priority, and forcing that
  even would quietly undo the deliberate axis-priority weighting in §2. Categories
  are allowed to look uneven; that's expected, not a bug.
- **Full 16-axis archetype match weighting, more archetypes, LDA-learned weights.**
  Real, correct next steps for archetype-matching accuracy, but blocked on more
  approved/researched figures existing first (see `LEGENDS_ARCHETYPES_DRAFT.md`). Not
  blocking this redesign, which is independent.

## 11. Schema, all pieces (none written yet — every one needs its exact form shown
and approved before migration, per standing rule)

1. Progressive unlock state — per-user tier/flags.
2. New token earn events — reason-extensible rows (`intake_complete`, `round_complete`,
   room for future reasons).
3. Roll/reveal records — the `{roll_id, type, result, revealed_at}` shape in §7, one
   row per item (13 rows per roll: 1 legend + 11 categories + 1 story).
4. Snapshot storage for RCI — value + stability per axis at time of last roll.
5. Category-read generated text — stored in the roll record's `result` field per §7,
   no separate table needed.
6. Static intake content — the frozen 50-question output, same shape as today's
   `bank.ts` (may not need a new table at all, could be a regenerated content file).

## 12. Suggested build order

1. Kalman-style value update (§4) — foundational, small, contained change to
   `applyEwmaAnswer`. Do this first since everything else reads `value`/`stability`.
2. Tiered axis-priority generator (§2-3, pure logic + prompt changes) — **build both
   generation contexts in this phase, not just the fixed intake rounds**: the 25/25
   intake rounds AND the ongoing post-Full-Profile loop (§3 point 4) are the same
   underlying generator, just triggered differently (fixed rounds vs. grounded in
   the completed profile). Easy to silently drop the ongoing-loop half if it's not
   called out explicitly — it's not a separate phase, but it must not be forgotten
   inside this one, and step 5 depends on it existing (see below).
3. Static intake regeneration (one-time content creation, frozen output) — replaces
   the 48-question bank.
4. Full Profile / progressive-unlock UI (§6) on top of the new 50-question intake.
5. Token economy changes (§7 — new earn events for intake-complete / round-complete).
   `round_complete` specifically pays out on the *ongoing* loop's rounds, not the two
   initial intake rounds — this step has nothing to attach to unless step 2 included
   the ongoing-loop generator, per the note above.
6. RCI snapshot + trigger logic (§5) — needed before rolls can decide when to
   regenerate.
7. Legend roll + category-read generation + reveal mechanic (§7) — the biggest single
   phase, build last among the "core" items since it depends on 1, 4, 5, and 6 all
   being in place first.
8. History/archive views (§8) — low-risk, depends only on §7's data existing.
9. Story: move to Home, build the locked state (§9) — genuinely independent of
   everything else here, no dependency forces it last — placed last purely as a
   prioritization choice (lowest product risk, safest to defer), not a requirement.
   Fine to build earlier if convenient.

Each numbered item here is itself several real task cards, not one — matches how the
category-batch and category-paged-questions features were broken down and built
earlier this session.

## 13. Manual test checklist (after full deploy)

- [ ] Answer questions 1-24 of intake — Sage/Legends stay hidden
- [ ] Answer question 25 — Sage unlock banner appears, explains Sage, mentions 25
      more for Legends
- [ ] Answer questions 26-49 — Legends stays hidden, Sage now usable
- [ ] Answer question 50 — Legends unlock banner + "fully unlocked" banner both appear
- [ ] Confirm 20 tokens granted exactly once at 50/50, not per-question
- [ ] Confirm a completed 25-question round after that grants 13 tokens
- [ ] Roll once — confirm legend + all 11 categories + story generate together in one
      pass
- [ ] Reveal one category — confirm a token is spent, `revealed_at` is set, content
      stays visible on reopen
- [ ] Don't reveal the rest — answer enough new questions to trigger a real RCI
      change on one axis (per §5's worked example) — confirm unrevealed items get
      replaced by a fresh roll, but the already-revealed category is untouched
- [ ] Check the Explore history view shows past revealed categories/legends with
      timestamps; check Home shows past revealed stories the same way
- [ ] Confirm nothing here regresses the existing Full Profile / Infinite Questions /
      Categories tab behavior already live
- [ ] Spot-check a few early-vs-late answers on the same axis to confirm the Kalman
      update actually swings less once stability is high (§4's worked example)
- [ ] Try replaying the intake-complete / round-complete grant call twice — confirm
      tokens are only credited once (§7)
- [ ] Attempt to trigger a roll without a real RCI-qualifying change — confirm it's
      refused server-side, not just discouraged client-side (§7)
- [ ] Fire two reveal requests for the same item at once (or as close to at once as
      testing allows) — confirm only one succeeds, no token overdraft (§7)
- [ ] Confirm an axis that's had many consistent answers can still move at all from
      new evidence, not frozen solid (§4)
- [ ] Confirm `check:` gate fails on purpose if a test axis is temporarily removed
      from the frozen intake's coverage (§3)
- [ ] Confirm a revealed item's date is visibly shown on screen, not just present in
      the database (§7)
