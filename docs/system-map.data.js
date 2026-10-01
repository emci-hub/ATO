/*
 * ATO system map — THE FACTS.
 *
 * docs/system-map.html draws whatever is in this file. To change the map, edit
 * this file only. Rule (PROJECT_CONTEXT.md, House conventions): after any change
 * to axes, questions, AI calls, storage or screens, update this file in the
 * same commit.
 *
 * How it is shaped:
 *   statuses  the five colours.
 *   columns   the six lanes, left to right.
 *   axes      the 16 trait axes (each also becomes a box in the first lane).
 *   nodes     every other box. Fields:
 *               id       unique name, used by links
 *               col      which lane
 *               title    text on the box
 *               status   live | notwired | parked | dead | notbuilt
 *               flag     true = the code differs from the intended flow (shows a warning mark)
 *               parent   id of a box to sit inside (used for the 11 categories)
 *               axes     "all", or a list of axis keys this box carries. Leave out
 *                        for plumbing that carries no trait data.
 *               summary  one plain sentence
 *               facts    [label, text] rows shown in the side panel
 *               differs  list of ways the code differs from the intended flow
 *               files    where it lives in the repo
 *   links     [from, to] or [from, to, "save"]. "@axes" means every axis box.
 *             "save" marks an arrow that runs backwards (an output being stored).
 *   redteam   the Red-team tab.
 *
 * Audited 2026-09-30 against commit f75bd61. Divecore / Play is out of scope.
 */
var SYSTEM_MAP = {
  meta: {
    title: "ATO system map",
    audited: "2026-09-30",
    commit: "f75bd61",
    scope: "Whole app except Divecore / Play. Read-only audit: static read of src/, supabase/ and docs/. Nothing was run against the live database.",
    intendedSource: "PROJECT_CONTEXT.md (ACTIVE PLAN sections) plus the token economy emci confirmed on 2026-09-30.",
    caveats: [
      "'No importer' claims come from searching the code, not from running the app. Check before deleting anything.",
      "The tables me, checks, connections, crisis_flags and around were created before migrations were tracked, so their full column lists and security rules cannot be confirmed from the repo.",
      "Whether wave71 (drop sage_messages) has been applied to the live database was not checked."
    ]
  },

  statuses: {
    live:     { emoji: "🟢", label: "LIVE",            meaning: "A user can reach it in the app today and it runs." },
    notwired: { emoji: "🟡", label: "BUILT-NOT-WIRED", meaning: "The code exists but nothing a user can reach calls it." },
    parked:   { emoji: "⏸️", label: "PARKED",          meaning: "Deliberately switched off behind a 'Rebuilt' notice. Still reachable, nothing runs behind it." },
    dead:     { emoji: "🔴", label: "DEAD-OR-DROPPED", meaning: "Deleted, replaced, or left over with no way back in." },
    notbuilt: { emoji: "⚪", label: "NOT-BUILT-YET",   meaning: "Part of the intended flow, but no code exists yet." }
  },

  columns: [
    { id: "axes",      title: "16 Axes",            sub: "what ATO measures" },
    { id: "questions", title: "Questions",          sub: "how answers come in" },
    { id: "storage",   title: "Scoring & Storage",  sub: "where it is kept" },
    { id: "ai",        title: "AI calls",           sub: "what costs money" },
    { id: "outputs",   title: "Outputs",            sub: "what the user gets" },
    { id: "screens",   title: "Screens",            sub: "where they see it" }
  ],

  /*
   * bank   = questions for this axis in the 50-question intake
   * round  = questions for this axis in each 25-question round
   * legend = "core" / "modifier" if the Legends code reads it, else null
   * pair   = the axis it shares a question with in the 8 two-axis scenarios
   */
  axes: [
    { key: "openness",                 code: "OP", name: "Openness",                 low: "prefers a known path",              high: "curious about the untried",          bank: 6, round: 3, legend: "core",     pair: "conscientiousness" },
    { key: "conscientiousness",        code: "CO", name: "Conscientiousness",        low: "loose plans, drops dull stretches", high: "follows through even when boring",   bank: 6, round: 3, legend: "core",     pair: "openness" },
    { key: "extraversion",             code: "EX", name: "Extraversion",             low: "quiet time resets them",            high: "people energise them",               bank: 6, round: 3, legend: "core",     pair: "playfulness" },
    { key: "agreeableness",            code: "AG", name: "Agreeableness",            low: "holds ground",                      high: "goes along to keep it easy",         bank: 4, round: 2, legend: "modifier", pair: "conflict_cooperativeness" },
    { key: "steadiness",               code: "ST", name: "Steadiness",               low: "a knock lingers",                   high: "shakes off a bad start",             bank: 2, round: 1, legend: null,       pair: "locus_of_control" },
    { key: "attachment_anxiety",       code: "AX", name: "Attachment anxiety",       low: "a slow reply is just slow",         high: "a pause feels like pulling away",    bank: 2, round: 1, legend: null,       pair: "attachment_avoidance" },
    { key: "attachment_avoidance",     code: "AV", name: "Attachment avoidance",     low: "stays close",                       high: "keeps distance",                     bank: 2, round: 1, legend: null,       pair: "attachment_anxiety" },
    { key: "conflict_assertiveness",   code: "CA", name: "Conflict assertiveness",   low: "steps back",                        high: "puts own point forward",             bank: 4, round: 2, legend: "modifier", pair: "autonomy" },
    { key: "conflict_cooperativeness", code: "CC", name: "Conflict cooperativeness", low: "protects own outcome",              high: "looks for a workable middle",        bank: 2, round: 1, legend: null,       pair: "agreeableness" },
    { key: "autonomy",                 code: "AU", name: "Autonomy",                 low: "glad for a set path",               high: "wants it their own way",             bank: 2, round: 1, legend: null,       pair: "conflict_assertiveness" },
    { key: "competence",               code: "CM", name: "Competence",               low: "doubts they can do a hard task",    high: "feels they can handle it",           bank: 2, round: 1, legend: null,       pair: "self_efficacy" },
    { key: "relatedness",              code: "RE", name: "Relatedness",              low: "fine without connection",           high: "needs real connection",              bank: 4, round: 2, legend: "modifier", pair: "growth_mindset" },
    { key: "growth_mindset",           code: "GM", name: "Growth mindset",           low: "a miss feels final",                high: "looks at what to change",            bank: 2, round: 1, legend: null,       pair: "relatedness" },
    { key: "locus_of_control",         code: "LC", name: "Locus of control",         low: "it was bound to happen",            high: "looks at own part",                  bank: 2, round: 1, legend: null,       pair: "steadiness" },
    { key: "self_efficacy",            code: "SE", name: "Self-efficacy",            low: "unsure they are the one",           high: "can figure it out",                  bank: 2, round: 1, legend: null,       pair: "competence" },
    { key: "playfulness",              code: "PL", name: "Playfulness",              low: "the day is a job",                  high: "looks for the lighter take",         bank: 2, round: 1, legend: null,       pair: "extraversion" }
  ],

  axesNote: {
    summary: "Each axis is a number from 0 to 1 between two plain-English poles. The key is also the column name on the me table.",
    files: ["src/lib/traits.ts:16-33 (TRAIT_AXES)", "src/lib/axis-poles.ts:15-80 (pole sentences)", "src/lib/axis-codes.ts:7-24 (2-letter codes)"],
    differs: ["Pole copy is still marked unreviewed (POLE_COPY_REVIEWED = false, axis-poles.ts:8).", "docs/NOW.md says '15 axes' in places. There are 16."]
  },

  nodes: [
    /* ───────────── QUESTIONS ───────────── */
    {
      id: "q-bank50", col: "questions", title: "50-question intake", status: "live", axes: "all",
      summary: "The fixed set of 50 multiple-choice questions every new user answers. No AI, no cost, no consent needed.",
      facts: [
        ["How a user reaches it", "More → Questions, or Home's 'Answer a few questions' row. Shown 5 per page."],
        ["Questions per axis", "Openness, Conscientiousness, Extraversion: 6 each. Agreeableness, Conflict assertiveness, Relatedness: 4 each. The other ten: 2 each. Total 50."],
        ["Format", "2 or 3 options per question, each option carries a number (0.2 / 0.5 / 0.8)."],
        ["Order", "One axis at a time, in a fixed order. The app does not store which question was answered — it counts answers per axis and works out the rest."],
        ["When it is finished", "Every question answered = 'full profile done'. That one signal unlocks Insight, Story and the 25-question rounds."],
        ["Skip / reroll", "Neither. An intake question cannot be skipped or rerolled."],
        ["Tokens", "Design: +21 for finishing. Code: the payout exists on the server but nothing calls it — see ATO tokens."]
      ],
      differs: ["Finishing the 50 should pay +21 ATO tokens. It never does: claimFullProfileComplete has no caller.", "Each page of answers still pays the OLD currency (+5 'notes', once a day)."],
      files: ["src/lib/questions/bank.ts:32-545", "src/lib/questions/local.ts:127", "src/lib/questions/answer.ts:44", "src/lib/full-profile-gate.ts", "src/components/questions-fold.tsx", "src/components/paged-questions.tsx"]
    },
    {
      id: "q-full48", col: "questions", title: "48-question Full Profile (old)", status: "dead", axes: "all",
      summary: "The older flat bank of 48 questions, 3 per axis. Replaced by the 50-question intake. No code for it remains.",
      facts: [
        ["What replaced it", "The 50-question intake (bank.ts:4-6 says so)."],
        ["Watch out", "The words 'Full Profile' now mean two other things: the unlock signal (full-profile-gate.ts) and the Explore fold where you re-tap your axes (FullProfileFold)."],
        ["Known gap", "There is no migration path for anyone who finished the old 48. Accepted: zero live users."]
      ],
      files: ["src/lib/questions/bank.ts:4-6 (comment only)"]
    },
    {
      id: "q-pool", col: "questions", title: "Shared question bank pool", status: "live", flag: true, axes: "all",
      summary: "One global table of questions shared by every user. The 25-question rounds draw from it, and AI-written questions are added to it.",
      facts: [
        ["Table", "question_bank_pool (plus question_bank_reroll_exclusions)."],
        ["Who reads it", "Every user, through fetch_bank_candidates. The only filter is 'not one you have already seen'."],
        ["Who writes it", "Any signed-in user's app, through insert_bank_pool_items, after an AI batch comes back."],
        ["Server checks on a write", "Signed in, at most 25 items, prompt not empty and cut to 400 characters, 2 to 3 options. Nothing else."],
        ["Size", "Lives in the database — not countable from the code."]
      ],
      differs: ["SECURITY #1: text one user typed (their name, a saved fact, their last Check) goes into the AI prompt, and the AI's output is saved here where other users are served it. No content filter was found on the way in, and the server does not check content or axis."],
      files: ["src/lib/questions/bank-pool.ts:60-123", "supabase/migrations/wave49*.sql", "supabase/migrations/wave63_fix_insert_bank_pool_items_ambiguous_prompt.sql:26-72", "supabase/migrations/wave68_bank_pool_dedup_and_depth.sql:63-84"]
    },
    {
      id: "q-round25", col: "questions", title: "25-question rounds (after the 50)", status: "live", axes: "all",
      summary: "Once the 50 are done, the user can tap 'Next 25 questions' as many times as they like. Each round is 25 fresh questions.",
      facts: [
        ["Trigger", "Only the tap on 'Next 25 questions'. Nothing starts a round automatically."],
        ["Per axis in each round", "Openness, Conscientiousness, Extraversion: 3 each. Agreeableness, Conflict assertiveness, Relatedness: 2 each. The other ten: 1 each. Total 25."],
        ["Where the questions come from", "First the shared pool. If the pool is short, AI writes the rest. Then the pool once more for anything still missing."],
        ["Prewarm", "Right after a round starts, the app may quietly ask AI to top up the shared pool for next time (6-hour cooldown per device). It only fires as part of that same tap."],
        ["Finishing", "All 25 must be answered. Then the server pays +21 ATO tokens, once per round."],
        ["Reroll", "Yes — 1 ATO token, once per question per day."],
        ["Skip", "None."]
      ],
      differs: ["Each page of answers also pays the OLD currency (+5 'notes', once a day), which is outside the designed economy."],
      files: ["src/components/questions-fold.tsx:190-360", "src/lib/questions/ongoing-round.ts:129-186", "src/lib/questions/tiered-axis-plan.ts:19-38", "src/lib/questions/run-ongoing-round.ts", "src/lib/questions/run-prewarm.ts:81-103"]
    },
    {
      id: "q-reroll", col: "questions", title: "Question reroll", status: "live", axes: "all",
      summary: "Swap one unanswered round question for a different one on the same axis. Costs 1 ATO token.",
      facts: [
        ["Where", "The 'reroll' control beside each unanswered question in a 25-question round."],
        ["Cost", "1 ATO token. Matches the design."],
        ["Limit", "Once per question per day, enforced by the server."],
        ["Order of events", "Check a replacement exists → spend the token → swap the question. If there is no replacement, nothing is spent."],
        ["Intake questions", "No reroll control is shown on the 50. Matches the design."]
      ],
      differs: ["The replacement can be a question this user already saw in an earlier round (documented in reroll.ts:135-146, left on purpose).", "The spend function checks only that the question is yours, not what kind it is. The 'no reroll on intake' rule is held by the screen and by the swap function, not by the spend."],
      files: ["src/components/questions-fold.tsx:377-420, 503-520", "src/lib/questions/reroll.ts:148-163", "supabase/migrations/wave51_ato_tokens.sql:450-481", "supabase/migrations/wave54*.sql (reroll_question_item)"]
    },
    {
      id: "q-skip", col: "questions", title: "Skip a question", status: "notwired", axes: "all",
      summary: "Skipping exists in code but no live question can be skipped. It only appears in the optional scenarios, which are dev-only.",
      facts: [
        ["Where the buttons are", "'Skip this one' and 'Skip the rest' in the optional two-axis scenarios."],
        ["What a skip does", "Costs nothing. The axis is noted on me.question_deferred so it could be asked again later."],
        ["Why it is not wired", "The feed that was meant to bring skipped axes back was removed on 2026-09-16."],
        ["Skip vs reroll, in one line", "Skip = 'not now', free, nothing live uses it. Reroll = 'give me a different one', 1 token, live on rounds only."]
      ],
      differs: ["Server functions skip_question_item and skip_rest_question_pack exist but nothing calls them."],
      files: ["src/components/optional-intake.tsx:203-209", "src/lib/questions/deferral.ts:43", "src/lib/questions/store.ts:145"]
    },
    {
      id: "q-infinite", col: "questions", title: "Infinite Questions", status: "dead", axes: "all",
      summary: "The old endless feed of AI questions, 5 at a time. Removed from the app on 2026-09-16. Some of its code is still used by the rounds.",
      facts: [
        ["What is left", "generate.ts, prompt.ts, parse.ts and rotation.ts stay because the 25-question rounds reuse them."],
        ["Truly dead pieces", "composeLocalQuestionBatch (local.ts:81) and generateQuestionBatch have no caller. 'routeQuestions' survives only in comments."],
        ["Deep links", "Ten places in the app still link to /intake-sweep?axis=... The axis part is now ignored."],
        ["Docs", "docs/NOW.md still describes Infinite Questions as live."]
      ],
      files: ["src/app/(tabs)/intake-sweep.tsx:33-47", "src/lib/questions/local.ts:81", "src/lib/questions/generate.ts"]
    },
    {
      id: "q-scenario8", col: "questions", title: "8 two-axis scenarios", status: "notwired", axes: "all",
      summary: "Eight optional scenario questions that each measure two axes at once. Built, but only reachable from the dev lab.",
      facts: [
        ["Pairs", "Openness + Conscientiousness, Extraversion + Playfulness, Agreeableness + Conflict cooperativeness, Conflict assertiveness + Autonomy, Steadiness + Locus of control, Attachment anxiety + Attachment avoidance, Competence + Self-efficacy, Growth mindset + Relatedness."],
        ["Strength", "Answers count as a 'direct' source, so they overrule the 50-question answers on that axis."],
        ["Status", "intake-sweep.tsx:48 marks it parked. The only importer is the dev lab."]
      ],
      files: ["src/lib/vibe-check.ts:22-90", "src/components/optional-intake.tsx:314"]
    },
    {
      id: "q-axistaps", col: "questions", title: "Axis taps ('How you're currently leaning')", status: "live", axes: "all",
      summary: "On Explore the user can tap to set any axis by hand. A hand-set axis sticks: later question answers no longer move it.",
      facts: [
        ["Where", "Explore → FullProfileFold."],
        ["Strength", "A 'direct' source. It replaces the number outright."],
        ["Side effect", "After a tap, intake and round answers on that axis are still counted but stop changing the score."]
      ],
      files: ["src/components/full-profile-fold.tsx:78", "src/lib/traits.ts:48-54, 184"]
    },
    {
      id: "q-coreintake", col: "questions", title: "Onboarding's nine intake taps", status: "dead",
      summary: "The nine preference taps new users used to get at sign-up (talk style, morning cue, and so on). Deleted — sign-up now goes straight to Home.",
      facts: [
        ["Did they feed the 16 axes?", "No. They wrote context columns on me, and no trait code reads those."],
        ["Leftovers", "core-intake-sweep.tsx has no importer. updateIntake in me.ts has no caller. The eight columns stay on me, empty for new users."]
      ],
      files: ["src/components/core-intake-sweep.tsx", "src/lib/intake.ts:176-227", "src/app/onboarding.tsx:175"]
    },

    /* ───────────── SCORING & STORAGE ───────────── */
    {
      id: "s-score", col: "storage", title: "Scoring: answer → score", status: "live", axes: "all",
      summary: "Turns one answer into a new number for one axis. Recent answers count more than old ones.",
      facts: [
        ["Path", "applyQuestionAnswer → updateTraits → mergeTraitWrite → the per-axis track → saved to me."],
        ["First answer on an axis", "The score simply becomes that answer's value."],
        ["Later answers", "The score moves part of the way toward the new answer (a running average, weight 0.35). A 'stability' number rises when answers agree."],
        ["Direct vs inferred", "Direct = you set it yourself (slider, tap, scenario). Inferred = worked out from question answers. Direct always wins and sticks."],
        ["Bands", "Low below 0.35, high above 0.65, middle between. One band system for the whole app."],
        ["Two tracks", "'Report' (what you said) and 'game' (what you did in Play). Every output on this map reads the report track only."]
      ],
      differs: ["The comment on mergeTraitWrite describes a 0.12 blend, but for question answers the stored number comes from the track instead. The comment is misleading, the behaviour is fine."],
      files: ["src/lib/questions/answer.ts:44-79", "src/lib/me.ts:459-602", "src/lib/traits.ts:133-199", "src/lib/trait-stability.ts:14-213"]
    },
    {
      id: "s-me", col: "storage", title: "me (profile + 16 scores)", status: "live", axes: "all",
      summary: "One row per user. Holds the 16 current scores plus almost everything else about the account.",
      facts: [
        ["Trait columns", "One number column per axis, named exactly like the axis key, plus trait_sources and trait_touched_at."],
        ["Also holds", "name, handle, born_on, ai_consent, is_root, nav_layout, facts, sage_knows, current_focus, question_deferred, sage_story, sage_title, tokens (old), ato_tokens (new)."],
        ["Orphan columns", "milestones_celebrated (no code reads it), the eight onboarding-intake columns, close_friends_share and category_spotlight (read only by dead components)."],
        ["Risk", "lib/me.ts is one big shared file. A mistake there can break every screen at once."]
      ],
      differs: ["me was created before migrations were tracked, so its full shape and security rules cannot be checked from the repo."],
      files: ["src/lib/me.ts", "supabase/migrations/stage11_trait_backbone.sql:8-16", "supabase/migrations/wave15_extra_trait_axes.sql:8-13", "supabase/migrations/wave21_playfulness_categories.sql:6"]
    },
    {
      id: "s-tracks", col: "storage", title: "trait_tracks", status: "live", axes: "all",
      summary: "Per user, per axis: the running score, how stable it is, and how many answers went into it. This is what decides if an axis is 'settled'.",
      facts: [
        ["Columns", "value, stability, answer_count, last_depth_at — one row per user + axis + track (report or game)."],
        ["Who reads it", "Insight, Story, Category reads, the round planner, Explore's trait bands, and intake progress."]
      ],
      files: ["src/lib/trait-tracks-store.ts:47-96", "supabase/migrations/wave20*.sql:4"]
    },
    {
      id: "s-history", col: "storage", title: "trait_history", status: "live", axes: "all",
      summary: "A never-edited log of every score write: axis, value, source, time.",
      facts: [["Also used for", "The +21 intake payout counts rows here (needs at least 50 from question answers)."]],
      files: ["src/lib/trait-history-store.ts:11-24", "supabase/migrations/wave19*.sql:8"]
    },
    {
      id: "s-packs", col: "storage", title: "question_packs / question_items", status: "live", axes: "all",
      summary: "Each 25-question round is one pack with 25 items. Stores which option was picked.",
      facts: [["Written by", "insert_ongoing_round_pack, answer_question_item, reroll_question_item."]],
      files: ["src/lib/questions/store.ts:74-132", "supabase/migrations/wave17_infinite_questions.sql:164-176"]
    },
    {
      id: "s-insights", col: "storage", title: "daily_insights", status: "live", axes: "all",
      summary: "One saved insight per user per day (five short fields). Only the owner can read it.",
      facts: [
        ["Written by", "insert_daily_insight only."],
        ["Applied?", "Yes — confirmed live on 2026-09-14 per PROJECT_CONTEXT.md. The migration file's own header still says 'not applied yet'."]
      ],
      differs: ["The save trusts the date the phone sends. Accepted: limited to your own rows and costs nothing."],
      files: ["src/lib/insight/store.ts:61-89", "supabase/migrations/wave69_daily_insights.sql:24"]
    },
    {
      id: "s-catstore", col: "storage", title: "category_defs / category_statements", status: "live", axes: "all",
      summary: "The catalogue of 11 categories, and the saved AI read for each category per user.",
      facts: [["Dead sibling", "category_share: a table with no code reading or writing it."]],
      files: ["src/lib/category-catalog.ts:40", "src/lib/category-statements/store.ts:37-58", "supabase/migrations/wave21*.sql:66-113", "supabase/migrations/wave59*.sql:4"]
    },
    {
      id: "s-story", col: "storage", title: "me.sage_story", status: "live", axes: "all",
      summary: "The user's saved Story, kept on their me row.",
      files: ["src/lib/sage-story-store.ts:13", "supabase/migrations/wave22*.sql:18"]
    },
    {
      id: "s-aiusage", col: "storage", title: "ai_usage + app_config caps", status: "live",
      summary: "The meter. Counts each user's AI calls per day and holds the limits.",
      facts: [
        ["Shared limit", "20 AI calls a day, 200 a month, per user. Every AI feature draws from this one pool."],
        ["Extra limits", "Story 1 a day. Legend story 5 a day. Roll 1 a day (15 generations)."],
        ["Who decides", "The server (claim_ai_call), never the phone. No exemption for root or dev accounts."]
      ],
      files: ["supabase/migrations/stage8_ai_quota.sql:6-16", "supabase/migrations/wave17_infinite_questions.sql:19-95", "src/lib/voice/quota-server.ts:38-75"]
    },
    {
      id: "s-atotokens", col: "storage", title: "me.ato_tokens + ato_token_events", status: "live", flag: true,
      summary: "The NEW token balance and its ledger. Five reasons exist: two earns and three spends.",
      facts: [
        ["Earn reasons", "full_profile_complete (+21, once ever), ongoing_round_complete (+21, once per round)."],
        ["Spend reasons", "legend_reroll (10), category_reroll (1), question_reroll (1)."],
        ["Daily limits", "Enforced by unique indexes on the ledger: question = once per question per day, category = once per category per day, legend = once per user per day."]
      ],
      differs: ["Only two of the five reasons can actually happen today (round earn, question reroll). See the token table on the Red-team tab."],
      files: ["src/lib/ato-tokens.ts:15-22", "src/lib/ato-tokens-server.ts:5-49", "supabase/migrations/wave51_ato_tokens.sql:54-481", "supabase/migrations/wave52_ato_tokens_fixes.sql:63-221"]
    },
    {
      id: "s-oldtokens", col: "storage", title: "me.tokens + token_events (old 'notes')", status: "live", flag: true,
      summary: "The OLD token balance, called 'notes'. It was meant to be retired but it is still being earned and spent.",
      facts: [
        ["Still earning", "+5 'game_round' once a day, from answering intake or round questions, and from the picks inside a Depth dive."],
        ["Still spending", "12 notes for a Depth dive on Explore."],
        ["Dead paths", "+3 'check_in' (the Check is parked), +20 claim_intake_complete (no caller), 8 for a Sage insight (no screen)."]
      ],
      differs: ["Not part of the designed economy at all. Any signed-in user can also claim these earns straight from the server without proof a round happened."],
      files: ["src/lib/tokens.ts:8-16", "src/lib/tokens-server.ts:9-40", "supabase/migrations/wave45*.sql:87-183", "supabase/migrations/wave19*.sql:64-289"]
    },
    {
      id: "s-legendstore", col: "storage", title: "legend_generations", status: "notwired", axes: ["conscientiousness", "extraversion", "openness", "agreeableness", "conflict_assertiveness", "relatedness"],
      summary: "Would cache the AI flavour text for a Legend. Nothing reaches it while Legends is parked.",
      facts: [["Dropped earlier", "legends, legend_variants, legend_archetypes, legend_figures, archetype_defs and user_legend_history were all dropped in wave32 / wave57."]],
      files: ["src/lib/legends64/store.ts:44-78", "supabase/migrations/wave58*.sql:6"]
    },
    {
      id: "s-rollstore", col: "storage", title: "trait_rolls / trait_roll_snapshots", status: "notwired", axes: "all",
      summary: "Storage for Rolls (reveal a legend, category or story). No screen imports the roll code.",
      files: ["src/lib/rolls/store.ts:22-147", "supabase/migrations/wave46*.sql:88-133"]
    },
    {
      id: "s-titlestore", col: "storage", title: "sage_title_flags + me.sage_title", status: "notwired", axes: "all",
      summary: "Storage for a short AI 'title' for the user. The card that used it is no longer shown anywhere.",
      files: ["src/lib/sage-title-store.ts:20-31", "supabase/migrations/wave20*.sql:88-93"]
    },
    {
      id: "s-checks", col: "storage", title: "checks", status: "parked",
      summary: "One row per day: did / skipped, plus the old Read and Do text. Still read; nothing writes it any more.",
      facts: [
        ["Write path", "record_check — the only allowed way to write a Check. It has zero callers in the app (parked on purpose)."],
        ["Still read by", "home_bootstrap, the growth glow on the buddy, and push scheduling."]
      ],
      files: ["src/lib/checks.ts:24-133", "supabase/migrations/*record_check*.sql"]
    },
    {
      id: "s-crisis", col: "storage", title: "crisis_flags", status: "notwired", flag: true,
      summary: "A flag-only log of 'this user had a crisis moment today'. Read by Home. Nothing ever writes to it.",
      differs: ["No code or server function inserts a row, so 'crisis today' is always false."],
      files: ["src/lib/crisis/days.ts:17", "supabase/migrations/wave35_home_bootstrap.sql:59"]
    },
    {
      id: "s-explorestore", col: "storage", title: "explore_packs / entries / reactions", status: "parked", axes: "all",
      summary: "Storage for Explore's AI observations. The fold that showed them is parked.",
      files: ["src/lib/explore/store.ts:67-142", "supabase/migrations/explore.sql:45-78"]
    },
    {
      id: "s-circlestore", col: "storage", title: "connections / going / around", status: "parked",
      summary: "Storage for Circle (friends) and Around (local shows). Both screens are parked.",
      facts: [["Still running", "The refresh-around server job still fetches show listings on a schedule."]],
      files: ["src/lib/circle.ts:45-159", "src/lib/around/going.ts:20-31", "supabase/functions/refresh-around"]
    },
    {
      id: "s-chatstore", col: "storage", title: "threads / messages / blocks / mutes / reports", status: "dead",
      summary: "Tables for peer chat and moderation. They still exist in the database but no app code touches them.",
      facts: [["Also", "sage_messages (old Sage conversations): a drop migration (wave71) is written. Whether it has been applied was not checked."]],
      files: ["supabase/migrations/stage7_chat_report.sql:20-264", "supabase/migrations/wave71_drop_sage_messages.sql"]
    },
    {
      id: "s-local", col: "storage", title: "On-device storage", status: "live",
      summary: "Small things kept on the phone. No trait scores or answers are stored on the device.",
      facts: [
        ["Login", "Access and refresh tokens in the phone's secure store."],
        ["Caches", "Today's insight (also feeds the lock-screen widget), which option you picked on a page, your page position, the prewarm cooldown."],
        ["Settings", "Push preferences, appearance, crisis region, AI provider override (dev)."],
        ["Cleared", "Everything is wiped on sign-out and on delete account, except a few device-level keys."]
      ],
      files: ["src/lib/local-account-data.ts:41-66", "src/lib/insight/today-insight.ts:30", "src/lib/auth-storage.ts:13-14"]
    },

    /* ───────────── AI CALLS ───────────── */
    {
      id: "ai-gateway", col: "ai", title: "ai-generate (the one gate)", status: "live",
      summary: "Every AI call in the app goes through this one server function. The phone never holds an AI key.",
      facts: [
        ["Order of checks", "Signed in → allowed provider → prompt cut to 24,000 characters → output capped at 1,024 tokens → AI consent must be yes → claim one call from the daily pool → call the model."],
        ["Model", "Chosen on the server. Default Gemini (gemini-3.7-flash). If Gemini fails, the app retries once on DeepSeek (deepseek-v4-flash)."],
        ["Keys set", "Gemini and DeepSeek. Anthropic, xAI, NVIDIA and Perplexity are unset and answer 'key missing'."],
        ["Cost cap", "20 calls a day and 200 a month per user, 1,024 output tokens per call."],
        ["Timeout", "8 seconds per call to the AI vendor."]
      ],
      differs: ["A failed Gemini call is not refunded, and the DeepSeek retry claims again — one tap can use 2 of the 20 daily calls.", "docs/NOW.md says the live model is 'Grok 4.6'. The code says Gemini with a DeepSeek fallback."],
      files: ["supabase/functions/ai-generate/index.ts:28-377", "src/lib/ai/generate.ts:84-110", "src/lib/ai/config.ts:18-34", "src/lib/ai/edge.ts:24"]
    },
    {
      id: "ai-insight", col: "ai", title: "Daily insight", status: "live", axes: "all",
      summary: "Writes today's five-part insight for Home from the user's settled axes.",
      facts: [
        ["Trigger", "The user taps 'Load insight' on Home. Never automatic."],
        ["Inputs", "Settled axes as plain pole phrases (no numbers, no axis names), the user's 'current focus' text, the house style guide."],
        ["Model", "Gemini (DeepSeek on failure). 1,024 tokens, temperature 0.9."],
        ["Prompt file", "src/lib/insight/generate-insight.ts:80 (buildDailyInsightPrompt)"],
        ["Cost caps", "Shared pool only (20 a day)."],
        ["Output saves to", "daily_insights (one per day) and a copy on the phone for the widget."],
        ["Shown on", "Home."]
      ],
      differs: ["'Recent tone' is hard-coded to empty (index.tsx:233), so yesterday never shapes today.", "The 'For Sage' library no longer reaches any daily content — a dropped capability, awaiting emci's call.", "Copy is still marked unreviewed (DAILY_INSIGHT_COPY_REVIEWED = false)."],
      files: ["src/lib/insight/generate-insight.ts:26-171", "src/hooks/use-daily-insight.ts", "src/app/(tabs)/index.tsx:204-264"]
    },
    {
      id: "ai-story", col: "ai", title: "Sage Story", status: "live", axes: "all",
      summary: "Writes a longer 'story of you' from the categories that are ready.",
      facts: [
        ["Trigger", "A tap in the Story fold on Home. Locked until the 50 are done."],
        ["Inputs", "Each ready category and which way it leans, plus a note on told-versus-played."],
        ["Model", "Gemini (DeepSeek on failure). 1,024 tokens."],
        ["Prompt file", "src/lib/sage-story.ts:141 (buildStoryPrompt)"],
        ["Cost caps", "1 Story a day (claim_story_generate) on top of the shared pool. Free in tokens."],
        ["Output saves to", "me.sage_story."],
        ["Shown on", "Home."]
      ],
      differs: ["One tap can run 2 passes, each of which can retry on DeepSeek — up to 4 of the 20 daily calls for one Story.", "Copy is still marked unreviewed (STORY_COPY_REVIEWED = false). It ships anyway with a draft badge."],
      files: ["src/lib/sage-story.ts:23-170", "src/components/sage-story-fold.tsx:118-130", "supabase/migrations/wave22*.sql:24"]
    },
    {
      id: "ai-catread", col: "ai", title: "Category read (Categorize)", status: "live", axes: "all",
      summary: "Writes a short read for one category when the user taps it.",
      facts: [
        ["Trigger", "A tap on a category row on Explore."],
        ["Inputs", "That one category: its settled axes and which way each leans."],
        ["Model", "Gemini (DeepSeek on failure). 1,024 tokens."],
        ["Prompt file", "src/lib/category-statements/generate-statements.ts:46"],
        ["Cost caps", "Shared pool only. No limit of its own."],
        ["Output saves to", "category_statements."],
        ["Shown on", "Explore."]
      ],
      differs: ["Design says a category reroll costs 1 ATO token. There is no reroll button and nothing calls the spend.", "Copy is still marked unreviewed (CATEGORY_STATEMENTS_COPY_REVIEWED = false)."],
      files: ["src/lib/category-statements/generate-statements.ts:24-146", "src/components/categories-fold.tsx:151-175"]
    },
    {
      id: "ai-round", col: "ai", title: "Round questions + prewarm", status: "live", flag: true, axes: "all",
      summary: "Writes new questions when the shared pool cannot fill a 25-question round, and tops the pool up for next time.",
      facts: [
        ["Trigger", "The 'Next 25 questions' tap. Prewarm runs once inside that same tap."],
        ["Inputs", "The user's name, talk style, plain trait phrases, questions to avoid, and one 'grounding' detail: their last Check's text, or else the first fact they saved."],
        ["Model", "Gemini (DeepSeek on failure). Asks for 2,048 tokens; the server caps it at 1,024."],
        ["Prompt file", "src/lib/questions/prompt.ts:34-136 (buildQuestionsPrompt)"],
        ["Cost caps", "Shared pool, plus a 6-hour prewarm cooldown per device."],
        ["Output saves to", "question_packs for this user AND the shared question_bank_pool for everyone."],
        ["Shown on", "Questions."]
      ],
      differs: ["SECURITY #1: user-typed text goes in, and the output is saved to a pool other users are served from."],
      files: ["src/lib/questions/prompt.ts:34-136", "src/lib/questions/context.ts:7-27", "src/lib/questions/generate.ts:39-47", "src/lib/questions/chunked-generate.ts", "src/lib/questions/run-prewarm.ts:35-103"]
    },
    {
      id: "ai-legendstory", col: "ai", title: "Legend story", status: "notwired", axes: ["conscientiousness", "extraversion", "openness", "agreeableness", "conflict_assertiveness", "relatedness"],
      summary: "Would write flavour text for the user's Legend. Unreachable while Legends is parked.",
      facts: [
        ["Trigger", "rerollLegend — which nothing calls."],
        ["Inputs", "Only the six-letter archetype code."],
        ["Cost caps", "5 a day, plus the shared pool."],
        ["Output saves to", "legend_generations."]
      ],
      files: ["src/lib/legends64/generate-story.ts:36-55", "src/lib/questions/reroll.ts:90"]
    },
    {
      id: "ai-roll", col: "ai", title: "Roll generation", status: "notwired", axes: "all",
      summary: "Would generate the contents of a Roll. runRoll has no importer.",
      facts: [["Cost caps", "1 roll a day, 15 generations a day."]],
      files: ["src/lib/rolls/run.ts:52", "src/lib/rolls/generate.ts:32"]
    },
    {
      id: "ai-title", col: "ai", title: "Sage title", status: "notwired", axes: "all",
      summary: "Would write a short title for the user. SageTitleCard is not rendered anywhere.",
      differs: ["Still listed as a live AI call site in call-sites.ts:140."],
      files: ["src/components/sage-title-card.tsx", "src/lib/sage-title.ts:26"]
    },
    {
      id: "ai-explore", col: "ai", title: "Explore observations + Sage insight spend", status: "parked", axes: "all",
      summary: "AI observations on Explore, and a paid 'Sage insight'. Both folds are parked; the generator is reachable only from the dev lab.",
      files: ["src/lib/sage-insight.ts", "src/app/dev-lab.tsx:261-277"]
    },
    {
      id: "ai-talk", col: "ai", title: "Sage Talk (chat)", status: "dead",
      summary: "The chat backend was deleted on 2026-09-14. When it is rebuilt it must go through ai-generate like everything else.",
      files: ["src/app/(tabs)/sage.tsx:12-30"]
    },
    {
      id: "ai-card", col: "ai", title: "Daily card (Read + Do) and Dawn", status: "dead",
      summary: "The old daily card generator and the Dawn screen. Deleted and replaced by the daily insight.",
      differs: ["CLAUDE.md still describes ATO as 'one daily card (Read + Do)'."],
      files: ["(deleted) src/app/dawn.tsx, src/lib/voice/router.ts, src/lib/today-card.ts"]
    },

    /* ───────────── OUTPUTS ───────────── */
    {
      id: "o-insight", col: "outputs", title: "Insight", status: "live", axes: "all",
      summary: "Today's insight on Home: a title, a reflection, something to try today and something to watch for.",
      facts: [
        ["Unlocks when", "The 50-question intake is finished and AI consent is yes."],
        ["If consent is no", "No daily content at all. There is no non-AI fallback."],
        ["Also feeds", "The lock-screen widget and the daily push."]
      ],
      files: ["src/app/(tabs)/index.tsx:495-551", "src/lib/insight/today-insight.ts:81"]
    },
    {
      id: "o-story", col: "outputs", title: "Story", status: "live", axes: "all",
      summary: "A longer written portrait, shown under the insight on Home. Free in tokens.",
      files: ["src/components/sage-story-fold.tsx", "src/app/(tabs)/index.tsx:578"]
    },
    {
      id: "o-categorize", col: "outputs", title: "Categorize (11 categories)", status: "live", axes: "all",
      summary: "Eleven everyday themes, each built from 2 or 3 axes. Shown on Explore; tap one for an AI read.",
      facts: [
        ["Bars vs maps", "A 'bar' category averages its axes and needs at least 2 settled. A 'map' category plots two axes against each other and needs both settled."],
        ["No AI needed for", "The bar or map itself. Only the written read costs an AI call."],
        ["Reroll", "Design: 1 ATO token per category, once a day. Not built in the app."]
      ],
      differs: ["No category reroll button exists.", "Category copy is still marked unreviewed (CATEGORY_COPY_REVIEWED and CATEGORY_BAND_COPY_REVIEWED = false)."],
      files: ["src/lib/categories.ts:45-318", "src/components/categories-fold.tsx"]
    },
    { id: "cat_steadiness",   col: "outputs", parent: "o-categorize", title: "Steadiness",                  status: "live", axes: ["conscientiousness", "agreeableness", "steadiness"],                          summary: "Bar. How even and reliable you are day to day.",                 files: ["src/lib/categories.ts:50"] },
    { id: "cat_openness",     col: "outputs", parent: "o-categorize", title: "Openness to life",            status: "live", axes: ["openness", "extraversion"],                                                 summary: "Bar. How much you reach for new things and people.",              files: ["src/lib/categories.ts:59"] },
    { id: "cat_drive",        col: "outputs", parent: "o-categorize", title: "Drive",                       status: "live", axes: ["autonomy", "competence", "relatedness"],                                    summary: "Bar. What moves you: your own way, mastery, connection.",         files: ["src/lib/categories.ts:68"] },
    { id: "cat_agency",       col: "outputs", parent: "o-categorize", title: "Agency",                      status: "live", axes: ["growth_mindset", "locus_of_control", "self_efficacy"],                      summary: "Bar. How much you feel you can change things.",                   files: ["src/lib/categories.ts:77"] },
    { id: "cat_social",       col: "outputs", parent: "o-categorize", title: "Everyday social energy",      status: "live", axes: ["extraversion", "agreeableness", "playfulness"],                             summary: "Bar. How you are around people on an ordinary day.",              files: ["src/lib/categories.ts:86"] },
    { id: "cat_communication",col: "outputs", parent: "o-categorize", title: "Communication",               status: "live", axes: ["conflict_assertiveness", "conflict_cooperativeness"],                       summary: "Bar. How you handle disagreement.",                               files: ["src/lib/categories.ts:95"] },
    { id: "cat_love",         col: "outputs", parent: "o-categorize", title: "Love / closeness",            status: "live", axes: ["attachment_anxiety", "attachment_avoidance"], summary: "Map of the two attachment axes. The two conflict axes add wording texture only — they are not counted as feeding it.", files: ["src/lib/categories.ts:104-107"] },
    { id: "cat_independence", col: "outputs", parent: "o-categorize", title: "Independence & closeness",    status: "live", axes: ["autonomy", "relatedness"],                                                  summary: "Map. Your own way versus needing connection.",                    files: ["src/lib/categories.ts:113"] },
    { id: "cat_levity",       col: "outputs", parent: "o-categorize", title: "Levity",                      status: "live", axes: ["playfulness", "conflict_assertiveness", "conflict_cooperativeness"],        summary: "Bar. How lightly you carry things. Diagnosis-adjacent — needs emci's read before it counts as reviewed.", files: ["src/lib/categories.ts:122"] },
    { id: "cat_structure",    col: "outputs", parent: "o-categorize", title: "Structure vs. spontaneity",   status: "live", axes: ["openness", "conscientiousness"],                                            summary: "Map. Planning versus going with it.",                             files: ["src/lib/categories.ts:131"] },
    { id: "cat_resilience",   col: "outputs", parent: "o-categorize", title: "Resilience under pressure",   status: "live", axes: ["competence", "growth_mindset", "steadiness"],                               summary: "Bar. How you hold up when it is hard.",                           files: ["src/lib/categories.ts:140"] },
    {
      id: "o-profile", col: "outputs", title: "Trait profile (bands + fill)", status: "live", axes: "all",
      summary: "The user's 16 axes shown on Explore as low / middle / high bands, plus 'N of 16 settled'.",
      facts: [
        ["Three folds", "TraitBandsFold (the bands), ProfileFillFold (how many are settled), FullProfileFold (re-tap your axes)."],
        ["No radar chart", "None found in the app."],
        ["Depth dive", "Inside FullProfileFold. Costs 12 of the OLD 'notes'."]
      ],
      differs: ["Depth dive is priced in the old currency that was meant to be retired."],
      files: ["src/app/(tabs)/explore.tsx:91-103", "src/components/full-profile-fold.tsx:39-239", "src/components/depth-dive.tsx:48-111"]
    },
    {
      id: "o-legends", col: "outputs", title: "Legends / archetypes (64)", status: "parked", axes: ["conscientiousness", "extraversion", "openness", "agreeableness", "conflict_assertiveness", "relatedness"],
      summary: "Sorts the user into one of 64 archetypes from six axes. No AI picks it — it is a fixed rule. The screen is parked.",
      facts: [
        ["How it is picked", "Each of six axes is split at 0.5 into High or Low. An unanswered axis counts as Low."],
        ["Core (first 3 letters)", "Conscientiousness, Extraversion, Openness."],
        ["Modifier (last 3 letters)", "Agreeableness, Conflict assertiveness, Relatedness."],
        ["Ten axes are ignored", "Steadiness, both attachment axes, Conflict cooperativeness, Autonomy, Competence, Growth mindset, Locus of control, Self-efficacy, Playfulness."],
        ["Unlock", "Designed to unlock at 50 answers."],
        ["Reroll", "Design: 10 ATO tokens. Price matches in code, but unreachable."]
      ],
      differs: ["Legends uses a plain 0.5 split while the rest of the app uses 0.35 / 0.65 bands.", "The legend reroll limit is once per user per day, not once per item per day.", "LegendCard has no importer.", "Copy is still marked unreviewed (LEGENDS64_COPY_REVIEWED = false)."],
      files: ["src/lib/legends64/classify.ts:19-70", "src/lib/legends64/archetypes.ts:56", "src/components/legend-card.tsx", "src/app/(tabs)/legends.tsx:34"]
    },
    {
      id: "o-roll", col: "outputs", title: "Roll (reveals)", status: "parked", axes: "all",
      summary: "A once-a-day reveal of a legend, a category read or a story. Screen parked, code disconnected.",
      files: ["src/app/(tabs)/roll.tsx", "src/lib/rolls/*"]
    },
    {
      id: "o-sage", col: "outputs", title: "Sage (talk)", status: "parked",
      summary: "The chat with Sage. The tab shows a 'Rebuilt' notice and the backend behind it has been deleted.",
      facts: [
        ["Designed unlock", "25 answers (progressive-unlock.ts:21)."],
        ["Sage facts", "The card that lists and deletes the facts Sage has saved about you (SageFactsCard) is not shown on any screen."]
      ],
      differs: ["Saved facts still feed the question prompt, but the user has no way to see or delete them."],
      files: ["src/app/(tabs)/sage.tsx:12-45", "src/components/sage-facts.tsx:25", "src/lib/questions/progressive-unlock.ts:21-22"]
    },
    {
      id: "o-tokens", col: "outputs", title: "ATO tokens", status: "live", flag: true,
      summary: "The designed economy: earn 21 for the intake and 21 per round; spend 10 on a Legend reroll, 1 on a category reroll, 1 on a question reroll.",
      facts: [
        ["Works today", "Earn +21 per finished round. Spend 1 on a question reroll."],
        ["Does not work today", "Earn +21 for the intake (never paid). Legend reroll (parked). Category reroll (no button)."],
        ["Balance", "Not shown anywhere. The number is only used to switch the reroll button on or off."],
        ["Full comparison", "See 'Token economy: design vs code' on the Red-team tab."]
      ],
      differs: ["+21 for finishing the intake is never paid.", "No category reroll in the app.", "Legend reroll is unreachable, and its daily limit is per user rather than per item.", "No balance shown to the user.", "The old 'notes' currency is still running alongside."],
      files: ["src/lib/ato-tokens.ts", "src/lib/ato-tokens-server.ts", "src/components/questions-fold.tsx:229-420"]
    },
    {
      id: "o-oldtokens", col: "outputs", title: "Old tokens ('notes')", status: "live", flag: true,
      summary: "The earlier currency. Should be gone under the designed economy, but still pays out on Questions and is spent on Explore.",
      facts: [
        ["Live earn", "+5 once a day for answering questions (questions-fold.tsx:109, 334) and for the picks inside a Depth dive (me.ts:806, 823, called from depth-dive.tsx:65, 88)."],
        ["Live spend", "12 for a Depth dive (depth-dive.tsx:48)."],
        ["Shown as", "'12 notes' on the Depth dive price line."]
      ],
      differs: ["Entirely outside the designed economy. Retire it, or reprice Depth dive in ATO tokens."],
      files: ["src/lib/tokens.ts", "src/lib/tokens-server.ts", "src/components/depth-dive.tsx:48-111"]
    },
    {
      id: "o-balance", col: "outputs", title: "Token balance + history view", status: "notbuilt",
      summary: "A place where the user can see how many ATO tokens they have and how they earned or spent them. Nothing like it exists.",
      files: ["src/lib/ato-tokens.ts:28-29 (ATO_TOKEN_LABEL / ATO_TOKEN_LEDE defined, never rendered)"]
    },
    {
      id: "o-milestones", col: "outputs", title: "Milestones", status: "notwired",
      summary: "Celebration toasts and badges for reaching a goal. The toast has no importer, so a user never sees one.",
      facts: [["Leftovers", "me.celebrated_milestone_ids is live storage with nothing celebrating into it; me.milestones_celebrated is an orphan column."]],
      files: ["src/components/milestone-toast.tsx", "src/components/check-milestone-badge.tsx", "src/lib/badges.ts"]
    },
    {
      id: "o-buddy", col: "outputs", title: "Buddy icon (top-right)", status: "live",
      summary: "The small pixel character fixed at the top-right of every tab. Today it only plays a random animation when tapped.",
      facts: [
        ["Component", "NavPixel, mounted once for all tabs."],
        ["On tap", "A random mood animation. Suppressed during a crisis."],
        ["On the Sage tab only", "A growth glow / sparkle based on how much of the profile is filled."],
        ["What it does not do", "No badge, no count, no notifications, no navigation."]
      ],
      files: ["src/components/nav-pixel.tsx:42-76", "src/app/(tabs)/_layout.tsx:17-18"]
    },
    {
      id: "o-buddyhub", col: "outputs", title: "Buddy as notification hub", status: "notbuilt",
      summary: "The buddy as the one place the app tells you things: a dot when something is waiting, a short list when tapped. Not built. See the Red-team tab for the proposal.",
      files: []
    },
    {
      id: "o-push", col: "outputs", title: "Push notifications", status: "live", flag: true,
      summary: "Scheduled local reminders: morning, evening, insight and Sunday.",
      facts: [["Permission ask", "Timed off the user's Check count — and Checks are parked, so the count no longer grows."]],
      differs: ["The Sunday push opens /week, which is a 'Rebuilt' placeholder.", "The category-insight push is held back by an unreviewed-copy flag."],
      files: ["src/lib/push.ts:33-293", "src/lib/push-copy.ts:13", "src/app/_layout.tsx:83"]
    },
    {
      id: "o-widget", col: "outputs", title: "Lock-screen widget", status: "live",
      summary: "Shows today's insight on the phone's home or lock screen.",
      differs: ["Still writes the old card-era names ('read', 'do', 'hasCard') because the installed widget reads those. Fixing it needs a new app build, not an over-the-air update (T-H3)."],
      files: ["src/lib/insight/today-insight.ts:81"]
    },
    {
      id: "o-crisis", col: "outputs", title: "Crisis card", status: "notwired", flag: true,
      summary: "A fixed safety card with real helpline details — never AI-written. It is on Home, but nothing can ever trigger it.",
      facts: [
        ["Why it cannot show", "Home shows it when 'crisis today' is true. That comes from crisis_flags, which nothing writes."],
        ["The detector", "detectCrisis (a keyword check, no AI) exists and has no caller."],
        ["Where you can see it", "Only in the crisis lab and the dev lab preview."]
      ],
      differs: ["Intended: the crisis card stays Active on Home. Actual: it can never render."],
      files: ["src/lib/crisis/detect.ts:152", "src/lib/crisis/days.ts:17", "src/app/(tabs)/index.tsx:420"]
    },
    {
      id: "o-consent", col: "outputs", title: "AI consent + disclosure", status: "live",
      summary: "The yes/no for AI use. A model call needs a yes; opening a screen never does.",
      facts: [
        ["When it is asked", "After the 50 are finished, inline on Home — never an early pop-up."],
        ["Enforced where", "On the server (ai-generate refuses without consent) as well as in the app."],
        ["Disclosure", "The AI-use notice shows on Home always, whatever the answer (Apple 5.1.2)."]
      ],
      files: ["src/app/(tabs)/index.tsx:362-392", "src/app/(tabs)/you.tsx:129-149", "supabase/functions/ai-generate/index.ts:358-366"]
    },
    {
      id: "o-check", col: "outputs", title: "Daily Check (did / skip) + streaks", status: "parked",
      summary: "Logging whether you did today's thing. Parked knowingly; it returns when the loop is rebuilt.",
      files: ["src/lib/checks.ts:111-133", "src/app/week.tsx:31"]
    },
    {
      id: "o-circle", col: "outputs", title: "Circle + Around", status: "parked",
      summary: "Friends you have scanned in, and local live music. Both parked and hidden from the tab bar.",
      differs: ["CircleProvider still runs its background fetch under the parked screens (tabs/_layout.tsx:13)."],
      files: ["src/app/(tabs)/circle.tsx:32", "src/app/(tabs)/around.tsx:31"]
    },

    /* ───────────── SCREENS ───────────── */
    {
      id: "sc-home", col: "screens", title: "Home", status: "live", axes: "all",
      summary: "Tab 1. Greeting, the AI consent ask, today's Insight, Story, and the way into Questions.",
      facts: [
        ["Before the 50 are done", "An 'Answer a few questions' row with how many are left."],
        ["After", "The Insight card with a 'Load insight' button, then the Story fold."],
        ["Also here", "AI on/off row, the always-on AI disclosure, the (never-shown) crisis card, a dev links box in dev builds."]
      ],
      files: ["src/app/(tabs)/index.tsx"]
    },
    {
      id: "sc-explore", col: "screens", title: "Explore", status: "live", axes: "all",
      summary: "Tab 2. Categories, trait bands, profile fill and the full-profile fold — plus five 'Rebuilt' placeholders.",
      facts: [
        ["Live", "Categories, Trait bands, Profile fill, Full profile (with Depth dive)."],
        ["Parked placeholders", "Today's Read, How you show up, Past reads, Insight spend, Observations."]
      ],
      differs: ["Five of nine sections on a live screen are placeholders."],
      files: ["src/app/(tabs)/explore.tsx:91-103"]
    },
    {
      id: "sc-sage", col: "screens", title: "Sage", status: "parked",
      summary: "Tab 3, pinned. Shows only a 'Talk is being rebuilt' notice.",
      differs: ["A placeholder holds a permanent slot in the tab bar."],
      files: ["src/app/(tabs)/sage.tsx"]
    },
    {
      id: "sc-legends", col: "screens", title: "Legends", status: "parked", axes: ["conscientiousness", "extraversion", "openness", "agreeableness", "conflict_assertiveness", "relatedness"],
      summary: "Tab 4 by default. Shows only a 'Rebuilt' notice.",
      differs: ["PROJECT_CONTEXT.md says the bar reads Home / Explore / You / More. The code's default is Home / Explore / Sage / Legends / More."],
      files: ["src/app/(tabs)/legends.tsx:34", "src/lib/nav/nav-order.ts:140-142"]
    },
    {
      id: "sc-more", col: "screens", title: "More", status: "live",
      summary: "The fixed fifth slot. A sheet listing whatever is not in the bar: You, Questions, and (while pre-launch) Divecore.",
      facts: [["Editing", "Long-press the bar to reorder tabs."]],
      files: ["src/components/nav-more-sheet.tsx:60-124", "src/components/app-tabs.tsx:29-147"]
    },
    {
      id: "sc-you", col: "screens", title: "You", status: "parked",
      summary: "Lives in More. Mostly a 'Rebuilt' notice, but the account essentials still work.",
      facts: [
        ["Still live", "AI consent, send feedback, sign out, delete account, build info."],
        ["Hidden door", "Tap the build line 5 times to open the AI lab (while pre-launch mode is on)."]
      ],
      files: ["src/app/(tabs)/you.tsx:118-194", "src/components/running-update-line.tsx:93-121"]
    },
    {
      id: "sc-questions", col: "screens", title: "Questions", status: "live", axes: "all",
      summary: "Lives in More (and behind Home's main button). The 50-question intake, then the 25-question rounds.",
      differs: ["The core loop of the app is not a visible tab."],
      files: ["src/app/(tabs)/intake-sweep.tsx", "src/lib/nav/nav-order.ts:65"]
    },
    {
      id: "sc-parked", col: "screens", title: "Roll · Around · Circle · Week · Chat", status: "parked",
      summary: "Five routes that still open but show only a 'Rebuilt' notice.",
      facts: [
        ["Around, Circle", "Hidden from the bar and from More."],
        ["Roll", "Hidden route with a Back button. Nothing links to it."],
        ["Week", "Reached only by tapping the Sunday push."],
        ["Chat", "Nothing links to it."]
      ],
      files: ["src/app/(tabs)/roll.tsx", "src/app/(tabs)/around.tsx", "src/app/(tabs)/circle.tsx", "src/app/week.tsx", "src/app/chat.tsx"]
    },
    {
      id: "sc-dev", col: "screens", title: "Dev tools (labs)", status: "live", flag: true,
      summary: "dev-lab, ai-lab, crisis-lab, pixel-lab, theme-lab, around-lab, plus a floating DEV button over every screen that opens a panel (screen, access, AI usage, update) without leaving the screen. Open to more people than intended while pre-launch mode is on.",
      differs: ["PRE_LAUNCH_DEV is true, and over-the-air updates do not run the release check — so every update ships with dev tooling un-gated.", "The 7-tap password unlock (dev-unlock-gate.tsx) is not mounted anywhere.", "theme-lab and around-lab were flagged for deletion on 2026-09-08 and are still there."],
      files: ["src/components/play-dev-fab.tsx", "src/lib/dev-fab-model.ts", "src/lib/dev-mode.ts:15", "src/app/play.tsx", "src/app/dev-lab.tsx", "src/app/ai-lab.tsx", "scripts/release-mode-check.ts:22-31"]
    },
    {
      id: "sc-entry", col: "screens", title: "Sign-up, login, public profile", status: "live",
      summary: "Register (handle, birth date, invite code) goes straight to Home. /@handle shows a public poster.",
      files: ["src/app/onboarding.tsx", "src/app/auth/*", "src/app/[handle].tsx"]
    }
  ],

  links: [
    ["@axes", "q-bank50"], ["@axes", "q-round25"], ["@axes", "q-axistaps"], ["@axes", "q-scenario8"],
    ["q-pool", "q-round25"], ["q-round25", "q-reroll"], ["q-pool", "q-reroll"],
    ["q-bank50", "s-score"], ["q-round25", "s-score"], ["q-axistaps", "s-score"], ["q-scenario8", "s-score"],
    ["q-round25", "s-packs"], ["q-reroll", "s-packs"], ["q-skip", "s-me"],
    ["s-score", "s-me"], ["s-score", "s-tracks"], ["s-score", "s-history"],
    ["s-aiusage", "ai-gateway"],
    ["s-tracks", "ai-insight"], ["s-me", "ai-insight"],
    ["s-tracks", "ai-story"], ["s-tracks", "ai-catread"], ["s-catstore", "ai-catread"],
    ["s-tracks", "ai-round"], ["s-me", "ai-round"], ["s-checks", "ai-round"],
    ["s-me", "ai-legendstory"], ["s-tracks", "ai-roll"], ["s-tracks", "ai-title"], ["s-tracks", "ai-explore"],
    ["ai-round", "q-pool", "save"], ["ai-round", "s-packs", "save"],
    ["ai-insight", "s-insights", "save"], ["ai-story", "s-story", "save"], ["ai-catread", "s-catstore", "save"],
    ["ai-legendstory", "s-legendstore", "save"], ["ai-roll", "s-rollstore", "save"], ["ai-title", "s-titlestore", "save"], ["ai-explore", "s-explorestore", "save"],
    ["ai-insight", "o-insight"], ["ai-story", "o-story"], ["ai-catread", "o-categorize"],
    ["ai-legendstory", "o-legends"], ["ai-roll", "o-roll"], ["ai-talk", "o-sage"], ["ai-title", "o-profile"],
    ["s-tracks", "o-categorize"], ["s-tracks", "o-profile"], ["s-me", "o-legends"], ["s-me", "o-profile"],
    ["s-atotokens", "o-tokens"], ["q-bank50", "o-tokens"], ["q-round25", "o-tokens"], ["q-reroll", "o-tokens"],
    ["s-oldtokens", "o-oldtokens"], ["o-oldtokens", "o-profile"], ["s-atotokens", "o-balance"],
    ["s-checks", "o-check"], ["s-crisis", "o-crisis"], ["s-circlestore", "o-circle"],
    ["s-local", "o-widget"], ["s-local", "o-push"], ["o-insight", "o-widget"], ["o-insight", "o-push"],
    ["o-buddy", "o-buddyhub"], ["o-milestones", "o-buddyhub"], ["o-push", "o-buddyhub"],
    ["o-insight", "sc-home"], ["o-story", "sc-home"], ["o-consent", "sc-home"], ["o-crisis", "sc-home"], ["o-consent", "sc-you"],
    ["o-categorize", "sc-explore"], ["o-profile", "sc-explore"], ["o-oldtokens", "sc-explore"], ["ai-explore", "sc-explore"],
    ["o-sage", "sc-sage"], ["o-legends", "sc-legends"], ["o-roll", "sc-parked"], ["o-circle", "sc-parked"], ["o-check", "sc-parked"], ["o-push", "sc-parked"],
    ["o-tokens", "sc-questions"], ["q-bank50", "sc-questions"], ["q-round25", "sc-questions"],
    ["o-buddy", "sc-home"], ["o-buddy", "sc-explore"], ["o-buddy", "sc-sage"], ["o-buddy", "sc-legends"],
    ["sc-more", "sc-you"], ["sc-more", "sc-questions"]
  ],

  /* ───────────── RED-TEAM TAB ───────────── */
  redteam: {
    intro: "A critical read of the app as it stands, ranked. Security items are listed, not fixed: the standing rule is that hardening waits for the pre-launch pass. The one exception worth pulling forward is #1, because it lets one user put words in front of another.",

    tabBar: {
      today: ["Home", "Explore", "Sage (placeholder)", "Legends (placeholder)", "More → You, Questions"],
      proposed: ["Home", "Questions", "Explore", "You", "More → Sage, Legends until rebuilt"],
      why: "Two of the four visible slots open a 'Rebuilt' notice, while Questions — the one thing a new user must do — is hidden in More. Give the slots to what works; let Sage and Legends earn theirs back when they are rebuilt."
    },

    screens: [
      {
        screen: "Home", job: "One thing to read today, one thing to do next.",
        items: [
          { title: "Make the daily insight the whole top of the screen", why: "It is the product. One short line you can read in five seconds, with the longer reflection one tap below.", borrow: "Co-Star: a single terse daily line; depth is opt-in." },
          { title: "Show exactly one 'next step' row under it", why: "Either 'N questions to unlock your insight' or 'Next 25 questions (+21 tokens)'. Never both, never a list.", borrow: "Duolingo: one obvious next lesson, with the reward shown before you start." },
          { title: "Keep yesterday's insight visible until today's is loaded", why: "Today the card is empty until the tap. An empty hero reads as broken. No AI call is added — it is already saved.", borrow: "Co-Star: there is always something on the screen." },
          { title: "Give Story a real locked state that names its key", why: "'Unlocks when 3 more categories settle' beats a silent lock.", borrow: "Finch: you can always see what the next small step opens." },
          { title: "Move the AI on/off row to You; keep only the disclosure on Home", why: "Once answered, a settings switch on the main screen is noise. The always-on disclosure stays for Apple 5.1.2.", borrow: "" },
          { title: "Make the crisis card able to appear", why: "It is kept on Home on purpose and can never render. A safety feature that cannot fire is worse than none, because everyone believes it is there.", borrow: "" }
        ]
      },
      {
        screen: "Explore", job: "See yourself: 16 axes and 11 themes.",
        items: [
          { title: "Show the 16 axes as two-ended bars", why: "Each axis already has two plain poles. Put one at each end with a marker between. It is the clearest picture the data allows.", borrow: "16Personalities: a bar per trait, both poles labelled, percentage toward one side." },
          { title: "Merge the three profile folds into one", why: "Trait bands, Profile fill and Full profile all describe the same 16 numbers. One fold: bars, 'N of 16 settled', tap a bar to adjust.", borrow: "" },
          { title: "Remove the five 'Rebuilt' placeholders", why: "Five of nine sections say 'being rebuilt'. One quiet line at the bottom ('more coming here') does the same job.", borrow: "" },
          { title: "Show which axes feed each category, and add the 1-token reroll", why: "The reroll is in the design and on the server; only the button is missing. Showing the axes makes the read feel earned, not random.", borrow: "16Personalities: every result traces back to visible traits." },
          { title: "Mark 'still forming' honestly", why: "A category with too few settled axes should say what is missing and link to the right questions.", borrow: "Finch: gentle 'not yet', never a failure state." },
          { title: "Retire 'notes' or reprice Depth dive in ATO tokens", why: "It is the last place the old currency is spent.", borrow: "" }
        ]
      },
      {
        screen: "Sage", job: "Talk it through (when rebuilt).",
        items: [
          { title: "Take it out of the tab bar until it works", why: "A pinned placeholder teaches users the app is unfinished every time they open it.", borrow: "" },
          { title: "When rebuilt, open on today's insight", why: "The chat should start from something Sage already said, not a blank box.", borrow: "Co-Star: the daily line is the conversation starter." },
          { title: "Show 'what Sage knows about you' with delete", why: "Saved facts are used in prompts today and the user cannot see or remove them. Fix this before chat starts adding more.", borrow: "" },
          { title: "Check for crisis words before any model call", why: "The keyword detector already exists and costs nothing. Wire it in first.", borrow: "" },
          { title: "Show calls left today", why: "The 20-a-day pool is shared with Insight, Story and rounds. Chat will drain it fastest.", borrow: "Duolingo: hearts are always visible." }
        ]
      },
      {
        screen: "You", job: "Your identity, your settings, your data.",
        items: [
          { title: "Drop the whole-screen 'Rebuilt' notice", why: "Half the screen works. The notice makes the working half look broken.", borrow: "" },
          { title: "Top: name, handle, your Legend code, share poster", why: "A short identity people want to show others.", borrow: "16Personalities: the four-letter type is the shareable object." },
          { title: "Token balance and a short history", why: "You cannot run an economy nobody can see. Balance, last five earns and spends.", borrow: "Duolingo: gems are always one tap away." },
          { title: "Privacy block: AI consent, what Sage knows, delete account", why: "Three controls that belong together and are legally important.", borrow: "" },
          { title: "Settings: notifications, appearance, talk style", why: "Push preferences exist on the device but have no home.", borrow: "" }
        ]
      },
      {
        screen: "More", job: "Overflow only — nothing a user needs daily.",
        items: [
          { title: "Move Questions out and into the bar", why: "It is the core loop. It should never be two taps deep.", borrow: "" },
          { title: "Park Sage and Legends here until rebuilt", why: "Still reachable, no longer front and centre.", borrow: "" },
          { title: "Add Help, Legal and Send feedback", why: "The usual overflow items. Feedback is currently buried in You.", borrow: "" },
          { title: "Keep it to six rows or fewer", why: "A long More sheet becomes a second, worse home screen.", borrow: "" }
        ]
      }
    ],

    buddy: {
      today: "A pixel character fixed top-right on every tab. Tapping it plays a random animation. It has no badge, opens nothing, and knows nothing about what is waiting for you.",
      idea: "Make the buddy the ONE place the app tells you things. If something is waiting, the buddy shows a dot. Tap it and a short list opens. Nothing else in the app is allowed to badge, pop up or nag.",
      rules: [
        { title: "One dot, one sheet", detail: "A small dot (with a count above 1) when something is waiting. Tap → a bottom sheet with at most five items, most important first. Each item is one line and one tap to its screen." },
        { title: "What goes in the list, in order", detail: "1. Today's insight is ready to load. 2. Questions: 'N left to unlock' or 'Next 25 ready (+21)'. 3. Tokens just earned. 4. Something unlocked (Story, a category, Legends). 5. A milestone to celebrate. 6. App news (update ready, consent not yet answered)." },
        { title: "Mood shows your state, not a random pick", detail: "Idle when nothing is waiting. Perked up when something is. A short celebration when you finish a round. Sleepy late at night. The existing growth glow moves from the Sage tab to every tab and reflects 'N of 16 settled'." },
        { title: "Never guilt", detail: "No sad face for a missed day, no streak to lose. Missing a day changes nothing; coming back gets a small welcome." },
        { title: "Push mirrors the top item", detail: "At most one push a day, and it says exactly what the top of the buddy list says. Tapping it opens that screen and clears the item. This also fixes the Sunday push that lands on a placeholder." },
        { title: "Free and derived", detail: "Every item is worked out from data the app already has (intake progress, saved insight, token ledger, tracks). No new AI call, no new table to start." },
        { title: "Safety stays separate", detail: "Crisis never goes through the buddy. The buddy goes quiet during a crisis moment (it already does) and the static card takes over." }
      ],
      borrowed: [
        { from: "Duolingo's mascot", take: "The character is the voice of every reminder, and its expression tells you your state at a glance.", leave: "The guilt-trip tone and streak anxiety." },
        { from: "Co-Star daily insight", take: "One short line a day, pushed as-is, with depth behind a tap.", leave: "Being cryptic for effect — ATO's line should be plain." },
        { from: "16Personalities trait bars", take: "Progress you can see: 'your profile is 11 of 16 settled' as a visible bar the buddy can point at.", leave: "Presenting scores as fixed types." },
        { from: "Finch", take: "The companion grows as you look after yourself, celebrates small wins, and never punishes a missed day.", leave: "The full pet-care loop — Divecore already owns the pet." }
      ],
      buildOrder: [
        "One small file that turns existing state into a ranked list of items (no screen changes yet).",
        "The dot on the buddy, driven by that list.",
        "The sheet that opens on tap.",
        "Mood from state instead of random; glow on every tab.",
        "Re-home milestones as buddy celebrations (the toast is already dead code).",
        "Point push at the top item."
      ]
    },

    tokens: {
      intro: "The designed economy (confirmed by emci, 2026-09-30) against what the code and database do today.",
      rows: [
        { rule: "Earn +21 on finishing the 50 intake", code: "The server function pays 21, once ever, and requires 50 answered questions. Nothing in the app calls it.", verdict: "DIFFERS", note: "The reward is never paid. It lost its only caller when Legends was parked.", files: "src/lib/ato-tokens-server.ts:5 · wave52_ato_tokens_fixes.sql:154-221" },
        { rule: "Earn +21 per finished 25-question round", code: "Pays 21 when all 25 are answered, once per round, retried on next load if it failed.", verdict: "MATCH", note: "Live.", files: "src/components/questions-fold.tsx:244, 358 · wave52:63-150" },
        { rule: "Spend 10 per Legends reroll", code: "Price is 10 in the app and on the server. Nothing calls it; Legends is parked.", verdict: "UNREACHABLE", note: "Price matches. Returns with the Legends rebuild.", files: "src/lib/ato-tokens.ts:20 · wave51_ato_tokens.sql:302" },
        { rule: "Spend 1 per Categorize category reroll", code: "Price is 1 on the server. The app has no button and no caller.", verdict: "MISSING", note: "Server ready, screen missing.", files: "src/lib/ato-tokens-server.ts:38 · wave51:374 · src/components/categories-fold.tsx" },
        { rule: "Spend 1 per question reroll", code: "Price is 1. Checks a replacement exists, spends, then swaps.", verdict: "MATCH", note: "Live on round questions.", files: "src/components/questions-fold.tsx:377-420 · wave51:450" },
        { rule: "Max 1 reroll per item per day", code: "Question: once per question per day. Category: once per category per day. Legend: once per USER per day.", verdict: "DIFFERS", note: "Legend limit is per user, not per item. Only matters if a user can ever hold more than one legend item. The app only shows the message 'Already rerolled today.'", files: "wave51:132-138, 325, 401, 481" },
        { rule: "No reroll on intake questions", code: "No reroll control on the 50. The swap function is reported to reject non-pool questions (not opened in this audit). The spend function checks ownership only.", verdict: "MATCH (screen) / UNVERIFIED (server)", note: "Confirm the server refuses before the token is spent, not after.", files: "src/components/questions-fold.tsx:102-115 · src/lib/questions/reroll.ts:129 · wave54" },
        { rule: "Nothing else earns or spends", code: "The old 'notes' currency still pays +5 a day for answering questions or making Depth-dive picks, and takes 12 for a Depth dive. +3 check-in, +20 old intake bonus and 8 for a Sage insight exist but cannot fire.", verdict: "DIFFERS", note: "A second currency is running beside the designed one.", files: "src/lib/tokens.ts:8-16 · src/components/questions-fold.tsx:109, 334 · src/lib/me.ts:806, 823 · src/components/depth-dive.tsx:48, 65, 88" },
        { rule: "(implied) The user can see their balance", code: "No balance is shown anywhere. The label and blurb text exist but are never rendered.", verdict: "MISSING", note: "", files: "src/lib/ato-tokens.ts:28-29" },
        { rule: "(docs) The economy is designed", code: "docs/ISOLATION_PLAN.md lines 35, 43, 223 and 294 still say the token system is not designed. PROJECT_CONTEXT.md was corrected with this map.", verdict: "STALE DOCS", note: "ISOLATION_PLAN.md was left untouched (outside this task's files).", files: "docs/ISOLATION_PLAN.md:35, 43, 223, 294" }
      ]
    },

    /* severity: high | medium | low. kind: security | bug | dead */
    findings: [
      { kind: "security", severity: "high", title: "One user's typed text can reach the shared question pool that other users are served",
        detail: "When a round needs more questions, the prompt includes the user's name and one 'grounding' detail — their last Check text or the first fact they saved. All of that is user-typed. The AI's questions are then saved into question_bank_pool, which every user draws from. No content filter was found between the AI and the save, and the server only checks length and option count. A user who writes instructions into their name or a fact could steer what other people are asked.",
        fix: "Stop sending user-typed text into prompts whose output is shared (send trait phrases only), or keep AI questions private to the user who triggered them until reviewed.",
        files: "src/lib/questions/prompt.ts:63-68, 114 · src/lib/questions/context.ts:7-27 · src/lib/questions/bank-pool.ts:112-123 · wave63:26-69 · wave68:63-84" },
      { kind: "security", severity: "high", title: "Any signed-in user can write straight into the shared question pool",
        detail: "insert_bank_pool_items can be called directly by any logged-in account, with any prompt text and any axis, up to 25 at a time. Same pool, no AI needed. An existing prompt with the same text is overwritten.",
        fix: "Make the pool writable only by a server function that generates the questions itself.",
        files: "supabase/migrations/wave63_fix_insert_bank_pool_items_ambiguous_prompt.sql:26-72" },
      { kind: "security", severity: "medium", title: "The sign-up gate is a guessable word with no attempt limit",
        detail: "The QA invite override is a short dictionary word and the function that checks it can be called without logging in, with no rate limit. Known and accepted for now (re-gating checklist item 12).",
        fix: "Rotate to a long random value before sign-up opens.",
        files: "PROJECT_CONTEXT.md re-gating checklist #12 · supabase/migrations/wave42*.sql" },
      { kind: "security", severity: "medium", title: "Pre-launch mode is on, and updates do not check it",
        detail: "PRE_LAUNCH_DEV is true. The release check only runs on full store builds, not on over-the-air updates, so every update ships with dev tools un-gated. The AI lab (which can switch AI provider) opens for any account with 5 taps on You.",
        fix: "Flip the flag before public launch; consider running the release check on publish too.",
        files: "src/lib/dev-mode.ts:15 · src/components/running-update-line.tsx:93-121 · scripts/release-mode-check.ts:22-31" },
      { kind: "security", severity: "medium", title: "Old tokens can be claimed without doing anything",
        detail: "earn_tokens lets any signed-in user claim the daily 'check_in' and 'game_round' rewards without proof that a Check or a round happened.",
        fix: "Goes away when the old currency is retired.",
        files: "supabase/migrations/wave45*.sql:87-182" },
      { kind: "security", severity: "low", title: "The dev unlock password can be guessed without limit",
        detail: "dev-unlock compares safely but never counts attempts. A correct guess only sets a flag on that phone. The password is the same short value as two others.",
        fix: "Add an attempt limit, rotate before launch.",
        files: "supabase/functions/dev-unlock" },
      { kind: "security", severity: "low", title: "Saved facts feed AI prompts but cannot be seen or deleted",
        detail: "The card that lists and removes facts is not on any screen. Privacy issue more than a break-in risk.",
        fix: "Put SageFactsCard back on You.",
        files: "src/components/sage-facts.tsx:25 · src/lib/me.ts:947" },
      { kind: "security", severity: "low", title: "Small hardening items on the server functions",
        detail: "Any of six AI providers can be requested by the app (four have no key, so they just fail). AI vendor error text is passed back to the phone. Cross-origin access is open on every function. refresh-around compares its secret with a plain equals. A Play dev-log table is readable without logging in.",
        fix: "One pass at pre-launch.",
        files: "supabase/functions/ai-generate/index.ts:174-234, 320 · supabase/functions/refresh-around/index.ts:32-38 · wave73_play_dev_logs.sql:38-48" },
      { kind: "security", severity: "low", title: "Security rules on the oldest tables cannot be checked from the repo",
        detail: "me, checks, connections, crisis_flags and around were created before migrations were tracked. Their access rules exist only in the live database.",
        fix: "Export the live schema into a baseline migration.",
        files: "docs/dead-weight.md:20-24" },

      { kind: "bug", severity: "high", title: "The crisis card can never appear",
        detail: "Home shows it when 'crisis today' is true. That reads crisis_flags, and nothing in the app or the database ever writes to it. The keyword detector exists and has no caller.",
        fix: "Decide what should trigger it now that chat is gone (for example the 'current focus' text or saved facts) and wire the detector there.",
        files: "src/app/(tabs)/index.tsx:420 · src/lib/crisis/detect.ts:152 · src/lib/crisis/days.ts:17" },
      { kind: "bug", severity: "high", title: "Finishing the 50 never pays the +21 tokens",
        detail: "The server function is ready and correct. Its only caller was on the Legends screen, which was parked.",
        fix: "Call it when the intake completes on Questions.",
        files: "src/lib/ato-tokens-server.ts:5 · wave52_ato_tokens_fixes.sql:154-221" },
      { kind: "bug", severity: "medium", title: "One tap can cost two or more of the 20 daily AI calls",
        detail: "The daily call is claimed before the model is contacted and is not given back on failure. The automatic retry on DeepSeek claims again. Story runs up to two passes, so one Story tap can use four.",
        fix: "Refund on vendor failure, or do the fallback inside the server function under one claim.",
        files: "supabase/functions/ai-generate/index.ts:369-377 · src/lib/ai/generate.ts:105-110 · src/components/sage-story-fold.tsx:118-130" },
      { kind: "bug", severity: "medium", title: "Two currencies are running at once",
        detail: "Answering questions pays both old 'notes' (+5 a day) and new ATO tokens (+21 a round). Depth dive is priced in notes and its picks earn notes too. Two more old earn sites (ranking and scenario cards, me.ts:714, 758) were not traced to a live screen.",
        fix: "Remove the old earn and spend sites, or convert Depth dive.",
        files: "src/components/questions-fold.tsx:109, 334 · src/components/depth-dive.tsx:48" },
      { kind: "bug", severity: "medium", title: "Half the tab bar opens a placeholder; the core loop is hidden",
        detail: "Default bar: Home, Explore, Sage, Legends, More. Sage and Legends are 'Rebuilt' notices. Questions is inside More. PROJECT_CONTEXT.md describes a different bar (Home / Explore / You / More).",
        fix: "See the proposed tab bar above.",
        files: "src/lib/nav/nav-order.ts:93-142" },
      { kind: "bug", severity: "medium", title: "The Sunday push opens a placeholder",
        detail: "A weekly push is still scheduled and its tap target is /week, which shows only a 'Rebuilt' notice.",
        fix: "Stop scheduling it, or point it at Home.",
        files: "src/lib/push.ts:289-293 · src/lib/push-copy.ts:13 · src/app/week.tsx:31" },
      { kind: "bug", severity: "medium", title: "Unreviewed copy ships anyway",
        detail: "Nine 'copy reviewed' flags are false, including Story, Insight, Legends, the categories (Levity among them) and the axis poles. The flag only adds a 'draft' badge in pre-launch mode; it does not hold the text back. Story and Levity are the diagnosis-adjacent ones that need emci's read.",
        fix: "Review, or make the flag actually gate.",
        files: "src/lib/sage-story.ts:23 · src/lib/insight/generate-insight.ts:26 · src/lib/categories.ts:16 · src/lib/axis-poles.ts:8 · src/lib/legends64/archetypes.ts:56" },
      { kind: "bug", severity: "low", title: "Ten 'answer questions about X' links ignore the X",
        detail: "Links to /intake-sweep?axis=... still exist across seven screens. The axis is no longer read, so they all open the same place.",
        fix: "Drop the parameter or honour it.",
        files: "src/app/(tabs)/intake-sweep.tsx:33-47" },
      { kind: "bug", severity: "low", title: "A reroll can hand back a question you already had",
        detail: "The replacement is checked against the current round only, not earlier rounds. Documented and left on purpose.",
        fix: "Exclude the user's past rounds.",
        files: "src/lib/questions/reroll.ts:135-146" },
      { kind: "bug", severity: "low", title: "Legends splits at 0.5 while everything else uses 0.35 / 0.65",
        detail: "An axis sitting in the 'middle' band on Explore still counts as High or Low for the Legend. An unanswered axis counts as Low. Worth deciding before the rebuild.",
        fix: "Decide on purpose; consider requiring the six axes to be settled.",
        files: "src/lib/legends64/classify.ts:45-70" },
      { kind: "bug", severity: "low", title: "Parked screens still fetch in the background",
        detail: "CircleProvider and the growth hook keep running under parked screens.",
        fix: "Unmount with the rest of the parked code.",
        files: "src/app/(tabs)/_layout.tsx:13 · src/components/nav-pixel.tsx:42" },
      { kind: "bug", severity: "low", title: "The docs describe a different app",
        detail: "CLAUDE.md still says 'one daily card (Read + Do)'. docs/MAP.md lists files that do not exist (questions.tsx, route.ts, sweep.ts, dawn.tsx) and tables with no code. docs/NOW.md says Infinite Questions is live, the model is 'Grok 4.6' and there are 15 axes. The wave69 file header says 'not applied'. call-sites.ts lists three AI surfaces that are not wired.",
        fix: "One doc pass; this map can be the source.",
        files: "CLAUDE.md · docs/MAP.md · docs/NOW.md · supabase/migrations/wave69_daily_insights.sql · src/lib/ai/call-sites.ts:140" },
      { kind: "bug", severity: "low", title: "Route names are not checked by the compiler",
        detail: "A mistyped screen link compiles without error, so a broken link is only found by tapping it.",
        fix: "Already noted in the Sep 8 audit; a reachability check script was planned.",
        files: "PROJECT_CONTEXT.md:64" },

      { kind: "dead", severity: "medium", title: "Components nothing imports",
        detail: "birthday-row, category-compare, category-statement-archive-fold, category-teaser, category-visual, core-intake-sweep, crisis-region-picker, dev-probes-stub, dev-unlock-gate, explore-panel, immersive-screen, kenney-credits-card, legend-card, milestone-toast, missed-check-card, password-settings-fold, sage-facts, sage-title-card, sage-usage, voice-preset-picker. optional-intake is imported only by the dev lab. (Found by search — check each before deleting; a check script may still cover it.)",
        fix: "", files: "src/components/*" },
      { kind: "dead", severity: "medium", title: "Library code nothing reaches",
        detail: "lib/rolls/run.ts, lib/sage-insight.ts, lib/sage-eight-ball.ts, lib/chat.ts, lib/share.ts, composeLocalQuestionBatch, generateQuestionBatch, updateIntake, claimIntakeComplete, claimFullProfileComplete (should be re-wired, not deleted), rerollLegend, spendAtoTokensCategoryReroll (needed by the design — wire, don't delete), detectCrisis (wire, don't delete).",
        fix: "", files: "src/lib/*" },
      { kind: "dead", severity: "low", title: "Database leftovers",
        detail: "Tables with no app code: threads, messages, blocks, mutes, reports, category_share. Orphan column: me.milestones_celebrated. Server functions nothing calls: skip_question_item, skip_rest_question_pack, delete_message_for_me, get_or_create_thread, peer_category_pack, category_share_status, categories_share_allowed, has_dev_trace_capability, purge_expired_dev_trace, plus delete_branch / unpause_branch / referral_branch.",
        fix: "", files: "supabase/migrations/stage7_chat_report.sql · wave21*.sql" },
      { kind: "dead", severity: "low", title: "Screens flagged for deletion and still here",
        detail: "theme-lab and around-lab (unreachable), explore-panel.tsx (a 357-line leftover), and no 'page not found' screen exists.",
        fix: "", files: "src/app/theme-lab.tsx · src/app/around-lab.tsx · src/components/explore-panel.tsx" }
    ]
  }
};

if (typeof module !== "undefined" && module.exports) { module.exports = SYSTEM_MAP; }
