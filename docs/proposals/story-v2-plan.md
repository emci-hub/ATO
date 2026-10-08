# Story v2: one thread, max 2 categories, one joke

Approved direction: emci, 2026-10-08. Hand-off plan: build it in one pass, then one gate, one reviewer and one OTA.

## Why

The Story (`src/lib/sage-story.ts` → `buildStoryPrompt`, called from
`src/components/sage-story-fold.tsx`) reads "all over the place". The cause, in the code:

1. **Too much input.** The prompt gets every settled category, up to 11 notes, so the model
   writes one scene per note. emci's screenshot had 5 unrelated scenes: a calendar tab, a dinner
   invite, the group chat, a voice note, a bad afternoon.
2. **Rules that fight.** The prompt asks for "one cohesive narrative", then appends the moment
   voice, whose rule is "one concrete moment … describe it and stop". The model obeys the specific
   rule, so the result is a list of moments.
3. **No point.** Nothing asks what the moments add up to, so there is no understanding at the end.

## What changes, in one sentence

The app (not the model) ranks the traits by how far they lean, picks the best 1–2 categories to
tell one story about, grounds it in that stored category card copy, and asks the model for one day,
one setting and one meaning line, with one joke about the user's most extreme shareable side.

## Design

### 1. Rank the axes (pure, `src/lib/story-thread.ts`, new)
- Read report-track values (`trackFor(tracks, axis, 'report')`). An axis counts if it has
  `answerCount >= 1` and `|value − 0.5| >= CLEAR_LEAN_MARGIN` (0.1, `lib/daily-line/pick.ts`).
- strength = `|value − 0.5|` (0–0.5). Sort descending.

### 2. Pick the category combo (max 2)
- Candidates: `readAllCategories(tracks)` where `ready` is true.
- Category score:
  - bar: mean strength of its stable axes, plus `|bar − 0.5|`;
  - map: distance of `(x, y)` from `(0.5, 0.5)`, plus the mean strength of its two axes.
- **A** = highest score.
- **B** = best remaining category where:
  - it shares at most 1 axis with A (prefer 0 shared; −50% score per shared axis);
  - bonus +25% if B's strongest axis leans the opposite way to A's (high vs low), because a
    tension makes a better story;
  - B's score must be ≥ 60% of A's, else it is a **single-category story**.
- Fallbacks, in order: A+B → A alone → no category is ready → the Story stays locked (today's
  `storyReady` gate, unchanged).
- If told-vs-played divergence exists (`formatStoryTensionNote`), it stays as an optional line the
  prompt may use, but only if its axis is inside A or B.

### 3. Variety on "Load a new story"
- Save the thread in the existing `me.sage_story` jsonb, next to `body`:
  `thread: { categories: [A, B?], jokeAxis }`. No schema change: the column is jsonb, and
  `parseSageStory` must accept and ignore it safely.
- The next load picks the best combo that is not the last one: rank the top 3 combos and take the
  first that differs from the saved `thread.categories`. With only one combo, reuse it.
- Keep `storyFingerprint` as it is (stale detection), and add the thread to the saved record.

### 4. Ground it in stored copy, not guesses
For A (and B) pass the **stored category card** for the user's cell (`pickCategoryCard` /
`cellForReading` from `src/lib/category-bank`): its summary, strength and watch-out. Also pass the
pole words of each category's strongest axis (`AXIS_POLE_NAME`, e.g. "Watchful", "Structured").
Nothing about the other categories goes in.

### 5. The joke
- **Target:** the single strongest axis across A ∪ B that passes `isShareableLean`
  (`lib/legends64/identity.ts`). If none passes, there is no joke. Never joke about a private or
  struggle lean: both attachment axes, steadiness:low, competence:low, self_efficacy:low,
  growth_mindset:low, locus_of_control:low.
- **No joke** when `crisisToday` is true (Home already knows it).
- **Allowed styles (emci, 2026-10-08):** dry, deadpan, self-aware, satire of modern life (group
  chats, calendars, read receipts, productivity culture, open tabs), and mild "dark" in the gallows
  sense about everyday absurdity, e.g. *"Your to-do list has outlived two phones."*
- **Hard bans, whatever the style:**
  - death, self-harm, suicide, illness, mental health, trauma, abuse, addiction;
  - bodies, looks, weight, age;
  - identity (race, gender, sexuality, religion, nationality, class);
  - money troubles; relationships ending; real people, brands or politics;
  - swearing, slurs, sexual content;
  - mocking the person rather than the situation;
  - "!", emoji, hashtags.
- **Form:** exactly one sentence, under 120 characters, woven into the story. It is also returned
  as `joke` in the JSON so the app can check it.
- **Voice override:** the moment voice says "tease kindly, never cruel". This one line may be drier
  or darker within the bans above. Record it in `src/lib/voice/moment-voice.ts` as a named
  exception: `STORY_JOKE_RULES`.

### 6. The prompt (`buildStoryPrompt`, rewritten)
- **Input:** the 1–2 chosen categories (names hidden from the model), their stored card lines, the
  lead pole words, the optional tension line, and the joke target and style (or "no joke").
- **Structure:** one ordinary day, one setting, the same people throughout.
  1. A short setup.
  2. The moment where the two sides meet (or the one side shows).
  3. How they tend to handle it.
  4. One plain meaning line.

  90–160 words, at most 3 short paragraphs, second person.
- **Which voice owns which part:**
  - the scenes and the joke follow the moment voice (plus the joke exception);
  - the closing meaning line follows the clear voice (`src/lib/voice/clear-voice.ts`): plain, kind,
    "tend to / usually", no labels.
- **Facts:** a typical day, never a claimed event ("on a day like …", "you might …"). Keep the
  existing rules: no "you are", no "always", no category or axis names, no framework terms.
- **Plan first:** respond with JSON
  `{"thread":"<one sentence: what this story is about>","joke":"<the joke sentence or empty>","body":"<the story>"}`.

### 7. Checks on the answer (`parseStoryBody`, extended)
- Reject (show the existing "couldn't write it, try again" state) when the body:
  - is over 180 words or over 3 paragraphs;
  - contains a framework term (`containsFrameworkTerm`) or names a category (`storyNamesACategory`);
  - says "you are" or "always", or contains "!";
  - contains a banned joke topic (a small keyword list for the hard bans above: die, death, kill,
    suicide, self-harm, depressed, anxiety, therapy, drunk, sex, plus slurs from the existing fence
    lists).
- If `joke` is non-empty but not in the body, accept the body and drop the joke field.
- `thread` is optional. If present it must not name a category or axis label.
- A rejected answer has still spent one AI call. That is the same as today's behaviour.

## Files

| File | Change |
|---|---|
| `src/lib/story-thread.ts` (new, pure) | axis ranking, category scoring, combo pick, rotation, joke target |
| `src/lib/sage-story.ts` | `buildStoryPrompt` rewrite; `parseStoryBody` checks; `SageStory.thread`; `parseSageStory` accepts it |
| `src/lib/voice/moment-voice.ts` | `STORY_JOKE_RULES` (styles, bans, examples) |
| `src/components/sage-story-fold.tsx` | call the picker with tracks, last thread and `crisisToday`; save the thread with the story |
| `scripts/story-thread-check.ts` (new, add `check:story-thread` to package.json) | fixtures: ranking order; A/B pick incl. the overlap and tension rules; single-category fallback; rotation never repeats the last combo when another exists; joke target never a private lean; no joke when `crisisToday`; prompt contains only the chosen categories' copy; parser rejects the over-length, "you are", "!", banned-topic and category-name cases |
| existing story checks (`grep -l buildStoryPrompt scripts/`) | update honestly to the new prompt; never weaken |

Unchanged: the AI icon, consent gate, quota claim (`claimStoryGenerate`), one call per story,
`STORY_COPY_REVIEWED = false` (no draft line is shown in the app; emci 2026-10-08), no database,
auth, env or dependency changes.

## Ship

1. `git pull` first (Cursor pushes Play work in parallel). Keep Play files out of this change
   (`check:play-isolation`).
2. `npm run check:ota-gate` must be green, then the `reviewer` subagent with this file and the
   diff. Fix critical items once, then re-run both.
3. Commit to master, push, then
   `npm run ota:publish -- --branch production --message "Story v2: one thread, a joke" --non-interactive`.
   This OTA also ships the **Your shape** tap fix and the removed draft lines (commit noted in
   docs/NOW.md, pushed but not yet published).
4. Update `docs/NOW.md` and `PROJECT_CONTEXT.md` (decisions log).
5. Device test (emci): open the Story and tap "Load a new story" twice. It should be one day, 1–2
   threads, one meaning line at the end, and at most one joke. The second load should take a
   different angle.

## Not verifiable offline

Nobody can run the live model from a build session. The fixtures prove what the model receives
and what the app accepts back. Only emci's first "Load a new story" proves the writing.
