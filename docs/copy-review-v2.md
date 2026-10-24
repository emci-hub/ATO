# Copy review v2 — meaning first (phase 1 samples)

emci, 2026-10-23. This replaces "show every trait through a real moment."

Phase 1 only. The guide, the rule, the checks that forced scenes, and the sample strings below are updated. The rest of the banks are not. Nothing here is an app-wide pass. `STORY_LIBRARY_RUNTIME` is still off. Trait ids, scores, and question option values are unchanged.

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
| Sentence-shape cap | Still on: one shape per spoken card | Not removed. It can still push a false "when". Sample lines kept their old shape so the existing bank still renders. The Curie line uses "when compared with," which is a comparison, not a shared hour |

Still banned, because they hide the meaning: the untried option, gets the first look, one look is enough, the rest can wait, shared side, strong match, chased an unknown glow, measured everything twice, kept to the familiar choice, you are someone who, you may find, it's important to, embrace, navigate, unlock, coach-speak "journey", vibe, energy. Slang stays casual-only.

Coach phrases, scoring, trait ids, `{answer}` / `{deed}` / `{Subj}`, and `STORY_LIBRARY_RUNTIME` (off) were left in place.

## Before / after

Each "new" cell is the assembled line a player can see. Acceptance answers are in order: what it means; why it is here; is every referenced thing visible; does it follow from the trait or the answer; does it invent an event; is it clearer without the scene; does the whole message make sense.

### 1. Trait description — high openness

Where: Full-profile poles stay the approved quote "What's that? I'll try it." This row is `TRAIT_POLE_LINES.openness.high`, shown by Explore's offline fallback as "You …" (`src/lib/explore/local.ts`). Also the share-card phrase, which was "tries a new place" and is now "tries something new."

Intended meaning: This person likes trying new things, even when other people stay with what they know.

Old: They have a listing open before the group has agreed.

New: They would rather try something new, even when other people stick with what they know.

Acceptance: The preference for what is new. Shown on an openness-high fallback. No listing or group is required. It follows high openness. It does not claim a listing was opened. Clearer without the scene. The sentence stands alone.

### 2. Trait description — low openness

Where: same fallback, `TRAIT_POLE_LINES.openness.low`.

Intended meaning: This person prefers a familiar option because they already know they enjoy it.

Old: They order the usual dish again, and it is still the best one.

New: They would rather keep a familiar option, because that option is already known to be enjoyable.

Acceptance: Familiar preference. Shown for openness-low. Nothing else is referenced. It follows the low pole. It does not claim an order was placed. Clearer. Stands alone.

### 3. Insight — Curiosity, Adventurous (`ftw_openness_h_01`)

Where: Home insight card. Assembled from focus + why + one try + one watch. The other two focus wordings rotate; all three, plus why, try, and watch, were rewritten so the card is one meaning. Old focus titles are in `RETIRED_FOCUS_TEXT` so a saved row still maps. Id unchanged.

Intended meaning: Your answers suggest you like trying something new, even when a familiar option is already there, and you might skip the one you already enjoy.

Old: At a restaurant, you usually pick a dish you have never ordered, even when you already know a favorite. A new place keeps the night interesting, but you can skip the sure dish you would have enjoyed more. Next time you order, ask what you would pick if it did not have to be new…

New: Your answers suggest you like trying something new, even when a familiar option is already there. These answers point to liking what is new. You can also pass up an option you already enjoy. Next time you choose, ask whether you want the new option or the one you already know. Notice whether you picked something because it was new or because you wanted it.

Acceptance: A suggestion from the answers, plus the cost, plus an optional next step. Shown on the insight for this idea. "Your answers" is the visible basis. It follows high openness. It does not claim a restaurant visit. Clearer. The card reads as one thought.

### 4. Quote of an answer — flagged, not interpreted

Where: Story Library shows-up line `conscientiousness-quote-shows`, only if the chosen option contains the words "I plan a whole new day." Seed `quote` in `scripts/story-library-check.ts`.

Intended meaning: Uncertain. Those words are not an option in `src/lib/questions/bank/`. The nearest real scenes are questions such as "Friends want a spontaneous weekend trip and nobody has made a plan," whose high option is "I make the shared doc anyway." That is not this sentence. The line was not pointed at a different question, because that would change which answer selects it.

Old: You picked "I plan a whole new day", and the packing list was done before anyone else had shoes on.

New: You picked "I plan a whole new day", and that records the selected option only.

Acceptance: It only repeats the option. It is shown only when that substring matches. The question is not on screen, because it does not exist in the bank. It does not claim a trait reading. It no longer invents the packing list. It is clearer. It does not explain the answer. Do not treat this as a finished conscientiousness line until the question is identified.

### 5. Legend match — Marie Curie, high openness

Where: Legend card, "how the trait won," `openness-legend-won-when`. Assembled with `{legend}` and `{deed}`.

Intended meaning: You would rather try something unfamiliar. Marie Curie coined the word radioactivity. The comparison is that both are a step toward something new. They are not the same event.

Old: You tried a place nobody at the table could name when Marie Curie coined the word radioactivity.

New: You would rather try something unfamiliar when compared with Marie Curie, who coined the word radioactivity.

Acceptance: A preference set next to a sourced deed. Shown on a match with Curie. Her name and the deed are the legend's facts; the preference is the reader's leaning. It follows high openness and the sourced deed. It does not say you were at a table when she coined the word. Clearer. The "when compared with" is there so this line keeps the `when` shape the picker still expects. It reads as a comparison.

### 6. Legend contrast — low extraversion next to Curie

Where: "Where you differ," `extraversion-legend-differ`. Curie is not tagged extraversion.

Intended meaning: The reader prefers a quieter setting (Reserved; the profile quote is "I need a night in."). That is a different fact from Curie coining the word. The line must not claim she was outgoing, and must not claim the reader spent a night with one friend.

Old: You stayed with one friend because that was the choice, and Marie Curie coined the word radioactivity.

New: You would rather keep things quieter, because that preference is separate from Marie Curie, who coined the word radioactivity.

Acceptance: A preference, marked as separate from her deed. Shown on a contrast. Her deed is on the card. "Quieter" is a reading of Reserved, not a quoted answer. It does not invent the one-friend night. Clearer than the old glue. Please confirm "quieter" is the reading you want for Reserved. If it is too vague, say so before the app-wide pass.

### 7. Playfulness low — the joke line

Where: `playfulness-low-shows-then`, and the offline pole line `TRAIT_POLE_LINES.playfulness.low` ("They read the joke straight and answer the actual question." is now "They would rather take a situation straight than turn it into play.").

Intended meaning: Serious, not Familiar. They would rather take a situation straight than turn it into play. The profile quote is "Let's just get it done."

Old: You heard the joke and then answered the actual question without a side quest.

New: You would rather take a situation straight and then leave the playful version alone.

Acceptance: Low playfulness. Shown on that pole. No joke is referenced, because none was asked. It does not say they dislike people or ignore humor as a personality type. It does not invent a joke they heard. Clearer. The "and then" is the slot's old shape. Stands alone.

### 8. Button and empty state — Your shape, before any answer

Where: `ShapeCard` empty state. Title, line, and button together.

Intended meaning: The chart is empty until 16 questions are answered. The button opens those questions.

Old: Your shape is blank. Sixteen answers draw the first lines. [Answer the first 16]

New: Your shape is blank. Answer 16 questions and this chart starts to fill in. [Answer the first 16 questions]

Acceptance: The chart on this screen fills in after 16 questions. Shown when nothing is answered yet. "This chart" is the blank shape on the card. 16 is the first set. It does not invent a metaphor. The button names the action. The three lines agree.

### 9. Error — paid legend reveal failed

Where: `LEGENDS_PAID_FAILED`, set when a paid reveal does not return an AI card (`src/app/(tabs)/legends.tsx`). That path includes "no tokens" and "the call failed." A timeout also calls `refundAiTokens('legend')`.

Intended meaning: The card did not load, so the reveal was not saved. Try again. A charge, if there was one, is refunded once a day.

Old: The AI card didn’t come through, so this reveal didn’t happen. Your tokens come back (once a day). Try again in a bit.

New: The legend card did not load, so this reveal was not saved. Try again later. If tokens were charged for this try, they come back (a failed charge is refunded once a day).

Acceptance: The load failed and the reveal was not kept. Shown right after that tap, so "this reveal" is the tap they just made. It no longer says tokens returned when none were charged. It does not invent a second event. Clearer. The sentence says what happened and what to do.

### 10. Notification ask

Where: The sheet after the first insight loads. Title, body, Turn on, Not now.

Intended meaning: Ask whether ATO may send a note when the daily insight is ready. They can turn it off later.

Old: Want a nudge now and then? ATO can send a short note when your insight is ready. You can change this any time. [Turn on] [Not now]

New: Allow a reminder? ATO can send a short note when your daily insight is ready. You can turn this off later. [Turn on] [Not now]

Acceptance: A reminder for the daily insight. Shown after an insight exists, so "insight" has a referent. It follows that screen. It does not invent a habit. "Nudge" and "change this" are gone. The buttons name the choice.

### 11. Onboarding — end of the day

Where: `CORE_INTAKE_QUESTIONS`, field `evening_wind_down`. The chips ("When I put my phone down," and the rest) are on the same screen. The stored value is the cue in the evening push body.

Intended meaning: Which of these already happens at the end of your day? The evening reminder will mention the one you pick.

Old: What already happens at the end of your day? The evening Check bump hangs off this.

New: What already happens at the end of your day? The evening reminder mentions the one you pick.

Acceptance: Asks for the end-of-day cue and says what the app does with it. The chips are the "one you pick." It does not mention an internal "Check bump." Chip values are unchanged. The evening push is still off while there is no Check to log; the question still collects the cue that push uses when it is on.

## Assembled Story Library card, not yet clean

Seed `sample-dive` / `sample-legend`, after this phase. Only the openness show-line, the Curie match line, and the extraversion contrast were rewritten. The rest is the old scene bank. Do not read this card as finished.

- Shows, openness: You would rather try something new, even when other people stick with what they know.
- Shows, playfulness: You turned the grocery run into a side quest, and the list took longer on purpose. **Unrevised. Invents an errand.**
- Shows, steadiness: You heard the new plan and then let it wait until morning. **Unrevised. Invents a plan.**
- Mix: You said yes to the weird errand because the spreadsheet came along too. **Unrevised.**
- Notice: You already had a new city pulled up before anyone sat down to pick a place. **Unrevised.**
- Means: Would you still talk the table into a place nobody has tried if the usual restaurant were the only one with a free table tonight? **Unrevised.**
- Joke: The safe plan lost. **Unrevised. The joke does not say what was safe.**
- Legend match: You would rather try something unfamiliar when compared with Marie Curie, who coined the word radioactivity.
- Legend scene: You spent one ordinary hour on those notes after Marie Curie coined the word radioactivity, with a new place still open on the phone. **Unrevised. Invents the hour and the phone.**
- Legend contrast: You would rather keep things quieter, because that preference is separate from Marie Curie, who coined the word radioactivity.
- Legend means: Would you still try a place nobody has named once everyone else had gone home and Marie Curie coined the word radioactivity? **Unrevised. Same false "when."**

## Not rewritten, on purpose

Question bank wording and scores. Daily lines. Category bank. Legend roster facts. Axis pole quotes emci already approved (`AXIS_POLES`), except where a sample above names one as the intended meaning. The other 700 Story Library lines. `docs/NOW.md`, `PROJECT_CONTEXT.md`, and `docs/ato-finish-roadmap.md`.
