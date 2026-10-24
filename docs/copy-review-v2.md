# Copy review v2 — meaning first (phase 1 samples)

emci, 2026-10-23. This replaces "show every trait through a real moment."

Phase 1 set the policy and a first sample set. Round 2 (still not an app-wide pass) loosens the stiff lines, rewrites the leftover scenes on the sample cards, and drops the one-shape-per-card cap. The rest of the banks are not rewritten. `STORY_LIBRARY_RUNTIME` is still off. Trait ids, scores, and question option values are unchanged.

Reserved (low extraversion), emci 2026-10-24: the plain meaning is "You recharge with time to yourself." Not "quieter." Applied on the sample trait line, the sample insight, and the sample contrasts only.

If a row says the meaning is uncertain, that line was not given a guessed trait reading.

## Where player-facing text comes from

There is no localization catalog. Player-facing English is the source string.

| Kind | Where |
|---|---|
| Hardcoded UI | `src/lib/polish-copy.ts` (empty states, buttons, week lines), `src/lib/intake.ts` (onboarding), `src/lib/push-policy.ts` and `src/lib/push-copy.ts` (notifications), `src/app/(tabs)/legends.tsx` (legend errors and empty halls), component strings such as `DEEP_DIVE_FAILED`, check-in, delete-account, save failures |
| Trait descriptions | `src/lib/axis-poles.ts` (`AXIS_POLES`, shown on the profile), `src/lib/traits.ts` (`TRAIT_POLE_LINES`, Explore's offline fallback), `src/lib/trait-bands.ts` (share card) |
| Insights | `src/lib/insight-bank/**` (Focus, why, try, watch). Old focus wording is mapped in `RETIRED_FOCUS_TEXT` |
| Questions | `src/lib/questions/bank/**` (not rewritten here) |
| Story Library | `src/lib/story-library/lines.ts`, assembled by `render.ts`. Deeds: `src/lib/story-library/deed.ts` |
| Legends (hand-written) | `src/lib/legend-figures/roster/**` |
| Daily lines | `src/lib/daily-line/` (not rewritten here) |
| Category cards | `src/lib/category-bank/**`, `src/lib/category-bands.ts` |
| AI prompts | `src/lib/voice/moment-voice.ts` (the block prompts import; the rules are now v2), `src/lib/voice/clear-voice.ts`, `src/lib/story-library/draft-prompt.ts`, `src/lib/category-deep-dive/dive.ts`, `src/lib/legend-figures/story.ts`, `docs/story-library/STYLE.md` |
| Previews and approval | Story Library dev tool (`src/components/story-library-dev.tsx`), Dev Hub copy flags, generated review docs under `docs/` |
| Fallbacks | `src/lib/explore/local.ts` (pole lines when the model is off), legend fallback story, push fallbacks |

## What caused the bad lines

The previous voice guide required a scene on every line, one private phrase per trait (group chat, packing list, side quest), a flip scene, and a joke. The Story Library picker also prefers a sentence shape (`when`, `and then`, `because`). Writers filled those slots with objects that were not in the question and were not the trait.

1. **"You had the listing open when the group chat was still stuck on the safe plan."** `openness-high-shows-when` in `src/lib/story-library/lines.ts`. High openness (Adventurous). The guide's approved "better" example, plus the required "group chat" phrase and the `when` shape. The listing and the chat are not in the player's answers. The picker shows this line first on a high-openness card.
2. **"You knew the best thing on the menu, and the group chat could not change the order."** `openness-low-shows-compound`. Low openness (Familiar). Same scene rule. The menu order is invented. The trait is preferring what you already know.
3. **"You heard the joke and then answered the actual question without a side quest."** `playfulness-low-shows-then`. This is **not** familiar-preference. It is playfulness low (Serious). The required scene phrase for that trait is "side quest," so the line invented a joke and an errand. The trait link (taking something straight) was buried under those objects.
4. **"You picked 'I plan a whole new day,' and the packing list was done before anyone else had shoes on."** `conscientiousness-quote-shows`. The quote template was told to attach the conscientiousness scene ("packing list"). The match string `I plan a whole new day` is **not in the question bank**. No option contains it, so the line never meets a real answer, and there is no question to explain. Meaning of the option: uncertain. Flagged, not guessed.
5. **"You tried a place nobody at the table could name when Marie Curie coined the word radioactivity."** `openness-legend-won-when`, filled by `{deed}` from `deed.ts` (`coined the word radioactivity`, a sourced fact). The `when` shape glued the player's invented dinner to that fact, so they read as one event.
6. **"You stayed with one friend because that was the choice, and Marie Curie coined the word radioactivity."** `extraversion-legend-differ`. The contrast template glues "because that was the choice" to `{deed}`. Low extraversion became a specific night. Curie's extraversion tag was already removed as an inference (`docs/copy-review-agent/applied-set8-legends-tags.md`). The deed is not a sociability fact.
7. **"They have a listing open before the group has agreed."** `TRAIT_POLE_LINES.openness.high`. The pole bank was rewritten into the moment voice. Explore's offline fallback shows it as "You have a listing…" by replacing the first "They".
8. **"At a restaurant, you usually pick a dish you have never ordered…"** `ftw_openness_h_01` in `src/lib/insight-bank/openness.ts`. The clear-voice rule asked for a concrete situation, so curiosity was stated as a meal the player usually orders. The answers support a preference for what is new, not that dinner.
9. **"The evening Check bump hangs off this."** Onboarding, `evening_wind_down` in `src/lib/intake.ts`. The prompt used an internal name. The stored chip is dropped into the evening notification (`eveningPush` in `src/lib/push-copy.ts`: "When you {cue}, log today's Check"). The send hour comes from `energy_pattern`, not from this question. The evening Check reminder itself is switched off while there is nothing to log (`push-check`).
10. **Empty state, button, notification, error.** `polish-copy.ts` was written as moment-voice color: "Sixteen answers draw the first lines" and a button that never says "questions." The notification ask said "nudge" and "change this" without naming the reminder. `LEGENDS_PAID_FAILED` always said tokens come back, including when the card failed because there were no tokens to charge. The refund is once a day on a failed charge.

The sample dive card below still contains unrevised lines (side quest, the waiting plan, the spreadsheet, the new city, the joke "The safe plan lost.", the imagined hour with Curie). Those are the same cause. They are listed so the assembled card can be judged. They were not rewritten in this phase.

## Rules and checks changed

| Rule or check | What it used to require | What it does now |
|---|---|---|
| `docs/voice-guide.md` | A real moment on every line; one scene phrase per trait; a flip scene; friend-test jokes | Meaning first. Scene, joke, and flip scene are not required |
| `.cursor/rules/player-copy.mdc` | Same, and the check refused a missing flip and the symbol words | Points at v2. The check no longer requires those |
| `src/lib/voice/moment-voice.ts` | "One concrete moment… Describe the moment and stop," with group-chat examples | Same export name. The rules are v2. Stories may still use a scene if it is established and is fiction |
| `src/lib/voice/clear-voice.ts` | Name a friend and write "When X, you tend to Y" | A direct sentence is enough. Do not add a person or a place to decorate a trait |
| `src/lib/story-library/draft-prompt.ts` and `docs/story-library/STYLE.md` (`style-storylib-5`) | Taught the listing line as the better example; required a flip scene; banned ticket, kettle, fork, bag, chair, costume | Teaches the plain sentence. Flip is optional. Object words are not banned. Do not use an object as a code for a trait |
| `src/lib/category-deep-dive/dive.ts` | "CLEAR FIRST, MOMENT SECOND," and a required everyday moment in the closing | Meaning first. An example is optional and must not be told as the reader's history |
| `src/lib/legend-figures/story.ts` | "You do a smaller version of that when [one modern moment]" | State the similarity. Do not invent the event. "If you'd met" stays marked as hypothetical |
| `sceneReuse`, `scenePropOveruse`, missing-scene budget in `validate.ts` | Each trait must contain its scene phrase, nowhere else, at most once a card and 12 times in the bank | Retired. Those gates pushed the substitute imagery |
| `metaphorSymbolIssues` | Failed story lines that contained ticket, kettle, fork, bag, chair, costume, and the rest | Retired. The words are allowed when they mean the object |
| Flip required (`validate.ts`, `voice-review.ts`, `story-library-check.ts`) | Every line needed an opposite-pole scene, not shown | A flip note is optional. If present, it must not copy the line |
| "Early read:" / snack-planner | A low-confidence line had to wear that costume | A plain hedge is enough |
| Banned "tend to", "this suggests", "this reflects", "your pattern shows" | Those phrases failed the check, so writers hid the hedge inside a scene | Allowed when they hedge a suggestion |
| Joke required on the sample card | `story-library-check` failed if the rendered card had no joke | A joke may be absent. If one is present it still has to pass the harm filter |
| One-shape-per-card cap | A spoken card could not repeat a sentence shape, so a plain line lost to an old scene that still had "when" | Off. Plain sentences may share a shape. A real "even when" is allowed. A "when" that glues two unrelated facts is not |

Still banned, because they hide the meaning: the untried option, gets the first look, one look is enough, the rest can wait, shared side, strong match, chased an unknown glow, measured everything twice, kept to the familiar choice, you are someone who, you may find, it's important to, embrace, navigate, unlock, coach-speak "journey", vibe, energy. Slang stays casual-only.

Coach phrases, scoring, trait ids, `{answer}` / `{deed}` / `{Subj}`, and `STORY_LIBRARY_RUNTIME` (off) were left in place.

## Round 2 — final wording of the earlier rows

Each "new" cell is the assembled line a player can see. Old is the scene from before phase 1, unless a row says otherwise.

### 1. Trait description — high openness

Where: `TRAIT_POLE_LINES.openness.high`, Explore's offline fallback (`asYou` turns the leading "They'd" into "You'd"). Share-card phrase: "tries something new."

Intended meaning: This person likes trying new things, even when other people stay with what they know.

Old: They have a listing open before the group has agreed.

New: You'd rather try something new, even when other people stick with a familiar option.

Acceptance: The preference. Shown on an openness-high fallback. No listing. It follows high openness. It does not claim a listing was opened. Clear, and it uses a contraction. The sentence stands alone.

### 2. Trait description — low openness

Where: same fallback, `TRAIT_POLE_LINES.openness.low`.

Intended meaning: This person would rather stick with something they already know they like.

Old: They order the usual dish again, and it is still the best one.

New: You'd rather stick with something you already know you like.

Acceptance: Familiar preference. Shown for openness-low. Nothing else is referenced. It follows the low pole. It does not claim an order was placed. emci's wording, with the inner "they" turned to "you" because the card speaks to the reader.

### 3. Insight — Curiosity, Adventurous (`ftw_openness_h_01`)

Where: Home insight card. One focus, the why, one try, one watch. The other focuses rotate and do not repeat this paragraph. Id unchanged. Old focus titles stay in `RETIRED_FOCUS_TEXT`.

Intended meaning: Your answers suggest you like trying new things even when a favorite is right there. Variety is the upside. Passing on something you'd enjoy more is the catch.

Old: At a restaurant, you usually pick a dish you have never ordered, even when you already know a favorite…

New: Your answers suggest you like trying new things, even when a favorite is right there. The upside is variety. The catch is you might pass on something you'd enjoy more. Next time you pick, name the favorite first, so you can see what you would be passing on. Notice when the new option won only because it was new.

Acceptance: A suggestion, the tradeoff, and one next step. "Your answers" is the basis. It does not claim a restaurant visit. The four parts do not repeat the same sentence.

### 4. Quote of an answer

Where: `conscientiousness-quote-shows`. The old match string was not in the question bank, so it was dropped. The line now matches a real option.

Question (`conscientiousness_06`): "Friends want a spontaneous weekend trip and nobody has made a plan." High option: "I make the shared doc anyway."

Intended meaning: In that situation, this answer says you would still put a plan together.

Old: You picked "I plan a whole new day", and the packing list was done before anyone else had shoes on.

New: You picked "I make the shared doc anyway" when friends wanted a spontaneous trip and nobody had a plan, so you would still put a plan together.

Acceptance: It quotes the real option and says what that option means in that question. The question's situation is in the line because the question itself is not on this card. It does not invent a packing list. The "when" is the question, not a second event.

### 5. Legend match — Marie Curie, high openness

Where: `openness-legend-won-when`, only for `lf_marie_curie`.

Fact check: the roster tag says "She studied a new kind of radiation that nobody understood yet." Fact f3 says she coined the term radioactivity. "She spent years on a mystery other scientists ignored" is not in the entry, so it was not used.

Intended meaning: You head toward what isn't known yet. So did she, and here is the sourced fact.

Old: You tried a place nobody at the table could name when Marie Curie coined the word radioactivity.

New: You'd rather head toward what isn't known yet, like Marie Curie. She studied a new kind of radiation that nobody understood yet, and she named it radioactivity.

Acceptance: A preference, then her fact. Shown on a Curie match. Her name and the radiation are from the entry. It follows high openness. It does not put you at a table in 1898. No "when compared with."

### 6. Legend contrast — Reserved

Plain meaning, emci 2026-10-24: You recharge with time to yourself.

Curie has no extraversion fact. The old extraversion tag was removed as an inference. The Curie card therefore does not say what she was like with people. That differ line states only the reader, and it is flagged.

Where the other side is sourced: Babe Ruth, tag "After games, a crowd would gather in his hotel suite." Line `ruth-extraversion-differ-low`, only for `lf_babe_ruth`.

Old (Curie, invented): You stayed with one friend because that was the choice, and Marie Curie coined the word radioactivity.

New, reader only, on the Curie card (flagged, not a both-sides contrast): You'd rather recharge with time alone than with a crowd.

New, both sides, Babe Ruth: You'd rather recharge with time alone. After games, a crowd would gather in Babe Ruth's hotel suite.

Acceptance for the Ruth line: Your side is time alone. His side is the crowd in the hotel suite, from the entry. It does not say you were there. It does not say "quieter."

### 7. Playfulness low

Where: `TRAIT_POLE_LINES.playfulness.low`, and the low-playfulness show line.

Intended meaning: They'd rather take a situation straight than turn it into play.

Old: You heard the joke and then answered the actual question without a side quest.

New (profile fallback): You'd rather take a situation straight than turn it into play.

New (story card): You'd rather take a situation straight, and leave the playful version alone.

Acceptance: Serious, not Familiar. No invented joke. The "and" is a real second beat, not a scene.

### 8. Button and empty state

Where: `ShapeCard` before any answer.

Old: Your shape is blank. Sixteen answers draw the first lines. [Answer the first 16]

New: Your shape is blank. Answer 16 questions and this chart starts to fill in. [Answer the first 16 questions]

### 9. Error — paid legend reveal failed

Old: The AI card didn’t come through, so this reveal didn’t happen. Your tokens come back (once a day). Try again in a bit.

New: The legend card did not load, so this reveal was not saved. Try again later. If tokens were charged for this try, they come back (a failed charge is refunded once a day).

### 10. Notification ask

Old: Want a nudge now and then? ATO can send a short note when your insight is ready. You can change this any time.

New: Allow a reminder? ATO can send a short note when your daily insight is ready. You can turn this off later.

### 11. Onboarding — end of the day

Old: What already happens at the end of your day? The evening Check bump hangs off this.

New: What already happens at the end of your day? The evening reminder mentions the one you pick.

### 12. Trait description and insight — Reserved

Where: `TRAIT_POLE_LINES.extraversion.low` (Explore shows the You form). Share card: "recharges with time alone." Insight `ftw_extraversion_l_01`, one focus plus why, try, and watch.

Intended meaning: You recharge with time to yourself.

Old trait line: They wave once and keep the quiet corner.

New trait line: You recharge with time to yourself.

Old insight: After a busy week, a quiet night at home usually sounds better to you than a night out…

New insight: You recharge with time to yourself, especially after a stretch around other people. You use that time alone so you can show up for the next plan. Without it, the next one can feel like too much. Next time the week fills up, keep one evening for yourself. Notice when you need time to yourself before you say yes to another plan.

## Assembled cards

Reviewed as a whole card, not as loose lines. Unflagged lines are the sample. Flagged lines are not a finished reading.

### Explore deep dive — high reader

Seed `sample-dive`. Openness high, playfulness high, steadiness in the middle.

- Title: the new option
- Shows, openness: You'd rather try something new, even when other people stick with what they know.
- Shows, playfulness: You'd rather turn an ordinary task into play, and it can take longer on purpose.
- Shows, steadiness: You'd let some of a rough moment land and then let the rest go.
- Mix: You'd rather try something new, and you'd also turn an ordinary task into play.
- Notice: You'd notice a new option before other people settle on a familiar one.
- Means: You'd rather try something new, even when a familiar option is right there. The upside is variety, and the catch is passing on something that would have been more fun.
- Joke: The new option won.

The steadiness line is the middle of that trait ("some of it lands, some of it goes"), not a claim that a particular plan was left until morning.

### Explore deep dive — low reader

Seed `sample-dive-low`. Openness low, playfulness low, extraversion low.

- Title: the familiar pick
- Shows, openness: You'd rather stick with a known favorite, even when a new option is sitting right there.
- Shows, playfulness: You'd rather take a situation straight, and leave the playful version alone.
- Shows, extraversion: You'd rather recharge with time alone and then leave the crowd for later.
- Mix: You'd rather keep both of these than pretend they are one habit.
- Notice: You'd notice a familiar favorite before anyone argues for a new option.
- Means: You'd rather stick with something already liked, even when a new option is available. The point is knowing what already works, not refusing every change.
- Joke: The familiar one still wins.

### Curie legend card

Seed `sample-legend`. Match on openness. Second pair is mid steadiness. Differ is low extraversion.

- Title: the new option
- Match: You'd rather head toward what isn't known yet, like Marie Curie. She studied a new kind of radiation that nobody understood yet, and she named it radioactivity.
- If you'd met: You might picture one ordinary hour beside Marie Curie, who coined the word radioactivity. That hour is imagined, not a memory.
- Means: You'd rather head toward what isn't known yet. Marie Curie coined the word radioactivity. Those two point the same way: toward something that was not already named.
- Joke: The new option won.
- Second pair, steadiness: You'd let some of a rough moment land and then let the rest go. **Flagged.** Curie is not tagged steadiness, so this line does not borrow her deed.
- Differ: You'd rather recharge with time alone than with a crowd. **Flagged.** Her entry does not say how she spent time with people. The both-sides contrast is the Babe Ruth line above.

## Not rewritten, on purpose

Question bank wording and scores. Daily lines. Category bank. Legend roster facts. Axis pole quotes emci already approved (`AXIS_POLES`), except where a sample above names one as the intended meaning. The other 700 Story Library lines. `docs/NOW.md`, `PROJECT_CONTEXT.md`, and `docs/ato-finish-roadmap.md`.
