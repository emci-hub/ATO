# Audit: runtime AI text, and the banks already in the app

Checked against the tree this branch is based on (`origin/master`). This is a read of the code, not a live call to Gemini.

The short version: the phone no longer writes most of its own words. Insights, the Story, category cards, questions, and every Divecore line are stored text picked on the device. Two product surfaces still ask a model to write prose at runtime, both through one edge function: **Legends cards** and **Explore category deep dives**. A cron job writes more of those cards when a bucket runs low. Everything else below is either already a bank, or a prompt that nothing on screen calls anymore.

There is no call to OpenAI, Anthropic, or xAI anywhere in the app or the edge functions. The live vendors are Google Gemini, then DeepSeek if Gemini fails.

## 1. Live model calls

These are the ones that still generate text about a person while the app is running.

### 1.1 Explore — category deep dive

This is the Explore text that is still AI. The Explore tab itself (`src/app/(tabs)/explore.tsx`) does not call a model when it opens. It reads traits, then mounts `CategoryDeepDiveCard`.

| | |
|---|---|
| Screen | `src/components/category-deep-dive-card.tsx` |
| Free path | `openLibraryDive` in `src/lib/category-deep-dive/library.ts` → `serveLibraryCard` → RPC `library_serve` |
| Paid path | `writeNewDive` → `writeLibraryCard('deep_dive', …)` → edge function `ai-library` |
| Old fallback | `writeCategoryDeepDive` in `src/lib/category-deep-dive/generate.ts` calls `generateText`. That hits `ai-generate`, which now returns 410, so this path cannot produce text. The card then shows the failure state. |
| Prompt | `buildDiveBundlePrompt` in `src/lib/category-deep-dive/dive.ts`, rebuilt on the server from the bucket key by `src/lib/ai-library/deep-dive.ts` |
| When | A tap. Not on mount. `check:no-auto-ai` pins that. |

What the model writes, and what it does not:

- On the phone, with no model: each trait in the category becomes a side and a percent (`DiveLean`: axis, lean, pct 50–100, optional middle under 60).
- The model writes the words: `title`, `showsUp` (one everyday moment per top lean), `mix`, `othersNotice`, `whatItMeansForYou`, optional `joke`.
- Card type: `CategoryDive` in `dive.ts`. Source is always `'ai'` today. There is no hand-written deep-dive fallback card, unlike Legends.

Bucket key shape: `dd|<categoryId>|<axis:h|l|m>,…` (`diveBucketKey`). 207 buckets across 11 categories. Angles are `people`, `work`, `solo`. One call asks for two cards. Library version `l2`.

What replacement takes: a deep-dive backbone per angle, with slots for the title, each "shows up" line, the mix, and the closing. Trait tier comes from the same h/l/m the bucket already uses (m is the middle, which the new bank should treat as mid). The percent stays computed. The joke, if it stays, is a picked line from a joke bank, not a model. See [MIGRATION.md](MIGRATION.md).

### 1.2 Legends — the "you" part of a museum card

| | |
|---|---|
| Screen | `src/app/(tabs)/legends.tsx` calls `revealLegendStory` on a reveal tap |
| Planner | `planLegendReveal` in `src/lib/legend-figures/generate.ts` (pure, no model) |
| Live path | `writeLibraryCard('legend', bucket, 'free_legend' or 'paid')` |
| Fallback if the function says `missing` | `writeLegendStory` → `generateText` → `ai-generate` 410 → `fallbackLegendStory` |
| Any other failure | `fallbackLegendStory` in `src/lib/legend-figures/story.ts` (hand-written tags and the angle's meaning) |
| Prompt | `buildLegendPrompt` in `story.ts`, rebuilt from the key by `src/lib/ai-library/legend.ts` |

Hand-written already, and shown as-is: the museum label (who they were, famous for, facts, moments) and "Where you match" (the tag phrases).

The model writes: `title`, `howTheTraitWon` lines, `metScene`, `differ`, `whatItMeansForYou`, optional `joke`. Type: `LegendStory`. `source` is `'ai'` or `'fallback'`.

Bucket key: `lg|<legendId>|<angleId>|<momentId>|p:<axis.h|l[!],…>|d:<axis.h|l or ->`.

What replacement takes: keep the museum entry as the backbone. Fill `title`, the won-line, the meeting scene, the differ line, and the closing from the trait bank, with an ending chosen from the reader's matched sides. The fallback function is already the no-AI version and can stay as the generic ending until the new cards are approved.

### 1.3 The edge function that actually calls the model

`supabase/functions/ai-library/index.ts`

The phone sends `{ kind, bucket, mode }` only. Kind is `deep_dive`, `story`, or `legend`. Mode is `paid`, `free_legend`, or `seed`. The function checks the JWT and `ai_consent`, claims via `claim_library_write`, rebuilds the prompt from `supabase/functions/_shared/ai-library.bundle.js` (generated from `src/lib/ai-library/`), calls the model, checks the answer, stores passing cards with `library_add_cards`.

`supabase/functions/_shared/ai-vendors.ts` is the only place a vendor URL exists:

- Gemini: `generativelanguage.googleapis.com`, model `gemini-3.7-flash` unless `GEMINI_MODEL` is set. Key: `GEMINI_API_KEY`.
- DeepSeek, only if Gemini throws: `api.deepseek.com/chat/completions`, model `deepseek-v4-flash`. Key: `DEEPSEEK_API_KEY`.
- Temperature 0.9, JSON response, output capped at 1024 tokens.

No OpenAI, Anthropic, or xAI URL. Client provider ids `claude`, `grok`, `nvidia`, and `perplexity` still exist in `src/lib/ai/types.ts` and `src/lib/ai/config.ts`. Nothing in the live function calls them.

### 1.4 The cron that keeps writing cards

`supabase/functions/ai-library-fill/index.ts`, scheduled every 10 minutes as `ai-library-fill` (see `supabase/migrations/wave94_ai_library_fill.sql`).

No person is in the call. It looks at `library_fill_queue` (buckets people are waiting on: stories, today's legend frames, empty deep-dive groups) and then tops every deep-dive bucket up toward 3 cards. Same Gemini → DeepSeek path (`completeDetailed`). Root seed from the dev tool uses the same writer.

This is the drift the owner is worried about. Every successful run adds new prose that no one typed, checked only by the card validator, not by a full read of every combo.

### 1.5 Admin seed button

`src/components/ai-library-dev.tsx`, mounted for root inside `src/app/dev-lab.tsx` (`HubTool id="ai-library"`). "Seed" calls `writeLibraryCard('deep_dive', …, 'seed')`, which is a real model call. It is the closest thing to an admin authoring tool today. It writes finished cards into the shared library. It does not edit a word bank, and it does not run a combo matrix.

### 1.6 Story kind, dormant on the phone, alive on the server

`LIBRARY_KINDS` in `src/lib/ai-library/types.ts` is `deep_dive`, `story`, `legend`. The Insights story card does **not** call the library (`scripts/insights-no-ai-check.ts` fails if it does). `src/lib/ai-library/story.ts` still builds a prompt (`STORY_POLISH_PROMPT_STATIC` plus the stored category lines). If anything posts `kind: 'story'` — the cron queue, or a hand call — the server will still generate a story card.

`STORY_AI_POLISH` in `src/lib/story-v3/polish.ts` is `false`. The polish prompt is text only.

## 2. Closed or unreachable generators

These files still contain prompts. No screen calls them to produce text. They are listed so a later cleanup does not miss a door.

| Surface | Files | What it used to do | State now |
|---|---|---|---|
| Generic prompt proxy | `supabase/functions/ai-generate/index.ts`, client `src/lib/ai/generate.ts`, `src/lib/ai/edge.ts` | Any signed-in caller could send a prompt | 410 stub since wave98. Holds no vendor key. `check:ai-provider` forbids putting a call back. |
| Client legend fallback | `writeLegendStory` in `src/lib/legend-figures/generate.ts` | One person's legend card via `generateText` | Only if the library returns `missing`. The 410 means it falls through to `fallbackLegendStory`. |
| Client deep-dive fallback | `writeCategoryDeepDive` in `src/lib/category-deep-dive/generate.ts` | One person's dive via `generateText` | Same 410. The card shows a failure, not new prose. |
| Daily insight writer | `src/lib/insight/generate-insight.ts` | Five fields: theme, title, reflection, try, watch | The functions `generateDailyInsight` / `generateDailyInsightAndLines` were removed 2026-10-14. The prompt text and the parser remain for old rows and the dev inspector. Today's focus is `src/lib/insight-bank/`. |
| Explore observations | `src/lib/explore/route.ts`, `src/lib/explore/prompt.ts`, `src/lib/explore/local.ts` | A periodic pack grounded on traits | `routeExplore` has no caller outside its own file. `src/app/(tabs)/explore.tsx` does not import it. The screen comment says observations are parked. `composeLocalExplore` is the no-model composer, also uncalled by the screen. |
| Sage title | `src/lib/sage-title.ts` (`buildTitlePrompt`) | A title and lede from settled traits | Prompt builder only. Callers parse stored titles. No `generateText`. |
| Category statements | `src/lib/category-statements/generate-statements.ts` | AI category cards | Prompt builder only. Live cards are `src/lib/category-bank/`. Old rows stay in the database and are hidden. |
| Story prompt | `src/lib/sage-story.ts`, `src/lib/story-card.ts` | The Story as a model card | Insights renders `story-v3` templates. `buildStoryPrompt` is still imported by the rolls composer below. |
| Rolls | `src/lib/rolls/compose.ts`, `src/lib/rolls/category-read.ts`, `src/lib/legends64/story-prompt.ts` | A 13-item roll: legend story, 11 category reads, 1 story, via an injected `generateRollText` | Nothing in `src/` calls `composeRoll`. `src/lib/rolls/run.ts` does not exist. Only `scripts/rolls-compose-check.ts` calls it, with a mock. |
| Infinite Questions | Comment in `src/lib/ai/call-sites.ts` points at `src/lib/questions/generate.ts` | AI question batches | That file is gone. Questions are the fixed bank under `src/lib/questions/bank/` (25 active per trait). |
| Daily-line AI saver | `keepAiLines` in `src/lib/daily-line/sync.ts` | Save model lines into `daily_line_pool` | Nothing calls `keepAiLines`. The pool can still hold old `source: 'ai'` rows for their owner. The picker will not put those on the lock screen (`src/lib/daily-line/pick.ts`). |
| Legends64 story claim | `src/lib/legends64/store.ts`, `src/lib/legends64/story-prompt.ts` | An older legend-story generator | Prompt plus a claim comment. No `generateText` in this folder. |
| Provider ping | `pingProvider` in `src/lib/ai/generate.ts`, dot in `src/components/provider-status-dot.tsx` | "Is the key configured?" | Not content. It posts to `ai-generate`, which answers 410, so the dot cannot succeed. |
| Live check scripts | `scripts/live-ai.ts` and the card/talk/style live checks | Developer-only, signed in as the dev-test user | Not in the app. They invoke `ai-generate`, so they 410 as well. |
| AI lab | `src/app/ai-lab.tsx` | Switch the provider id on the device | No prompt. The override cannot reach a vendor while `ai-generate` is closed. |

`src/lib/ai/call-sites.ts` still describes Explore observations, Infinite Questions, Sage title, Sage story, and Sage insight as if they were live call sites. The array `AI_CALL_SITES` only lists four, and two of those (`writeLegendStory`, `writeCategoryDeepDive`) are the dead fallbacks. The list is stale and should not be used as a map of what the phone does.

## 3. Divecore / Play

No runtime LLM in Play.

Searched `src/play` for `generateText`, `ai-library`, `openai`, `gemini`, `anthropic`, `deepseek`, and prompt builders. No matches.

Play text is stored copy:

| What | File | Shape |
|---|---|---|
| Pet speech bubbles | `src/play/pet-talk.ts` | Per form (Bright, Scruffy, Battle, Deep, Standard) × situation (`chatter`, `hungry`, `busted`, …). At least 3 lines, 6 for the big pools. Cap 48 characters. No trait tier. |
| Pet that knows you | `src/play/pet-knows-you-bank.ts` | All 16 axes × high/low × 3 lines, plus thin-data and streak lines. Ids `pky_<axis>_<h\|l>_<nn>`. Moment voice. Not shared, not in the cloud save. |
| Daily visitors | `src/play/daily-visitors-bank.ts` | Per hero: arrive, sticker, line, look, two return visits. |
| Element Legends (the game system, not the museum) | `src/play/legend-copy.ts`, `src/play/hero-copy.ts` | Fixed explainers and combat labels. Numbers come from the combat code. |
| Street names and item labels | `src/play/dive-street-names.ts` | Fixed names. A few finds are renamed (`food_kelp` → "Bodega chips"). |
| Notices | `src/play/notify/copy.ts` and the `notify()` call sites | Fixed titles and bodies. |

There is no quest generator, no pet-name generator, and no item-flavour model. "Side quest" appears as words inside one stored pet line, not as a system.

Play does not need a model removed. If the library later grows a `play` kind, pet-knows-you is the piece that already keys lines on trait and tier (high/low only, no mid).

## 4. Banks and templates that already exist

The owner is right that a lot of this is already in the app. None of it is a typed word bank with part-of-speech, verb form, and a combo test. They are full sentences, or a story grammar aimed at one comic.

### 4.1 Insight bank — today's focus, try, watch

`src/lib/insight-bank/`. One file per trait, plus starters. Type `InsightIdea`: forever id `ftw_<axis>_<h|l>_<nn>`, one or two lean keys, three wordings of the focus, a why, two tries, two watches. Picker: `pick.ts`, seeded, no repeat window. Clear voice. No mid tier: keys are `axis:high` or `axis:low` via `leanHighLow` (the cut is 0.5, not the 0.35/0.65 band).

This replaced the daily insight model on 2026-10-14. `scripts/insights-no-ai-check.ts` fails if Insights calls a model or the library.

### 4.2 Category bank — the Explore category card

`src/lib/category-bank/`. Per category, a bar (low/mid/high) or a map (hh/hl/lh/ll). Each cell has three wordings of summary, strength, watch-out, and try-this (`define.ts`). Picker turns by week. Clear voice. No model, no consent gate. This is the non-AI Explore text.

The low/mid/high cut here is `traitBand` (`TRAIT_BAND_LOW_CUT` 0.35, `TRAIT_BAND_HIGH_CUT` 0.65 in `src/lib/traits.ts`). That is the tier split the new bank should use, not the binary lean.

### 4.3 Story v3 — the Insights story, already a grammar

`src/lib/story-v3/`. This is the closest code to the research.

- `tracery.ts` expands `#slot#`, with `.cap`, `.a`, `.the`, `.s`, `{=slot}` reuse, and `[key:value]` locks. Entries can be filtered by category, setting, and high/low lean.
- `slots.ts` is the object-revolt grammar (toaster, kettle, and so on).
- `lean-phrases.ts` is one phrase per category per high/low, not per trait.
- `topics.ts` holds more backbones.
- `render.ts` `pickStoryTemplate` is what `src/components/insights/insights-story-card.tsx` calls.
- `validate.ts` checks a rendered script (clarity, gender, jokes, banned words, repeats). It does not render every trait × tier × pronoun.
- `src/lib/story-bank/` is a JSON fallback of whole stories with `{friend}` / `{sibling}` only.

`STORY_AI_POLISH` is off. The story the person reads is a template.

What it does not have: a part-of-speech on the slot, verb forms stored as base/-s/-ed/-ing, trait tiers, or an ending that wins by how many facts match. Slots are story-specific (`objectVillain`, `guestBundle`), not a shared trait bank.

### 4.4 Other stored lines

| Bank | Path | Keys |
|---|---|---|
| Daily line on Home | `src/lib/daily-line/bank.ts`, `lines.generated.ts` | `axis:high` or `axis:low`, plus pairs and starters. Approved copy. |
| Try this today, superpower, how you argue | `src/lib/daily-insights/` | Category lean phrases and static pools. No model. |
| Trait band labels | `src/lib/trait-bands.ts` `TRAIT_BAND_PHRASES` | One low phrase and one high phrase per axis. No mid, no part of speech. |
| Profile character | `src/lib/profile-character.ts` | Name from the 64 types plus a third word, colours, stats. Pure. No model. |
| Eight ball | `src/lib/sage-eight-ball.ts` | Fixed answers. |
| Push | `src/lib/push-insight.ts` | Sends a line that is already on screen. Does not generate. |

### 4.5 Shared library tables

Wave93 (`supabase/migrations/wave93_ai_library.sql` and the follow-ups) stores finished cards, not slots: kind, bucket key, version, angle, card JSON, who has seen it. That table is the wrong shape for a word bank. A Story Library can live beside it. It should not reuse the card row as a template, or the cron will keep filling it with model prose.

## 5. What each live AI spot needs in order to move

| Spot | Keep | Replace with library | Do not do |
|---|---|---|---|
| Deep dive | Percents, category, angle, middle-vs-side | Title, shows-up lines, mix, notice, closing, joke | Do not send the person's percent or answers to a model |
| Legend reveal | Museum entry, match tags, moment text | Title, won-line, meeting scene, differ line, closing, joke | Do not let the filler invent a fact that is not in the entry |
| Story kind on the server | The v3 template the phone already uses | Nothing, until someone wants new backbones | Do not turn the polish prompt back on |
| Fill cron | The queue idea (know which bucket is thin) | A check that the approved library already covers that bucket | Do not call Gemini to top it up |
| Insight, category card, Story, questions, Play | The banks | Only if a later authoring tool writes into those banks | Do not smash those full sentences into single-word slots |

The 16 traits are `TRAIT_AXES` in `src/lib/traits.ts`. A reader's number is 0–1 on the report track. `traitBand` maps it to low / mid / high. Several older banks ignore mid and use `leanHighLow` at 0.5. The new bank should store mid for real, and let mid fall back to generic only when a trait has no mid line yet. That fallback has to be written for the same frame, or the sentence breaks. The prototype does this.
