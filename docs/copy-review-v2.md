# Copy review v2 — meaning first (full pass)

emci, 2026-10-24. This replaces "show every trait through a real moment."

Phase 1 set the policy. Round 2 rewrote the sample cards and dropped the one-shape-per-card cap. This pass rewrites the player-facing banks those samples came from: Story Library lines, insights, Explore pole lines, category lean phrases, and the lines that still opened the same way or hid the meaning.

`STORY_LIBRARY_RUNTIME` stays off. Trait ids, scores, and question option values are unchanged. Reserved (low extraversion) is final: **You recharge with time to yourself.** On trait cards, insights, and legend comparisons. The share-card band phrase stays "recharges with time alone" because that string is pinned.

If a row says the meaning is uncertain, that line was not given a guessed fact.

## One idea per line (follow-up, same day)

emci approved a tighter pass on the lines that still joined two ideas, or that named a legend with no fact for that side. Daily lines approved on 2026-10-02 are unchanged. The closer "The new option won." stays its own sentence. It is the high-openness joke only.

| Where | Before | After | Reason |
|---|---|---|---|
| Shows, steadiness | You might look at both choices and then let one setback fade while another stays. | Some setbacks you shake off fast, but others stick around. | One idea. Some fade, some stay. |
| Mix | Trying something new can include play for you, because a task can be new and still be a game. | The answers put two things together for you: trying something new, and play in an ordinary task. | Both leans are on the card. No cause the answers do not show. |
| Curie scene | Picture an hour with Marie Curie. In that hour you would try something new if that choice came up, and the talk would stay on the known work. | Picture an hour with Marie Curie: she'd be testing something nobody understood yet, and you'd want in. | One imagined scene. The roster fact is that she studied a kind of radiation nobody understood yet. |
| Curie, steadiness | You can let one setback fade while another stays, and that is separate from what Marie Curie is known for. | Some setbacks you shake off fast, but others stick around. | She has no steadiness fact, so her name is not on the line. |
| Curie differ | You recharge with time to yourself rather than with a crowd, because the answers land on that side. | You recharge with time to yourself after time with other people. | Reader only. Reserved wording kept. Her entry does not say how she spent time with people. |
| Babe Ruth differ | You recharge with time to yourself. After games, a crowd would gather in Babe Ruth's hotel suite. | Same sentence. | The hotel suite is a roster fact, so his name stays. |
| Insight watch | Notice when the new option wins only because it is new. | Notice when the new option wins only for being new. | Same watch. The cause word is gone. |
| Starter focus | Your lock screen might take the first minute of the morning, while the kettle is still cold. | Your lock screen might take the first minute of the morning. | One idea: the phone. The kettle was a second scene. |
| Category, openness | You name a new option while the familiar one is still on the table. | You name a new option even when the familiar one is still on the table. | One contrast. |
| Card 6 lean, communication | you say the hard part and then ask what works | you say the hard part in a way that can work for both | One idea. The "and then" was a second step. |

## Where player-facing text comes from

There is no localization catalog. Player-facing English is the source string.

| Kind | Where |
|---|---|
| Hardcoded UI | `src/lib/polish-copy.ts`, `src/lib/intake.ts`, `src/lib/push-policy.ts`, `src/app/(tabs)/legends.tsx` |
| Trait descriptions | `src/lib/axis-poles.ts` (`AXIS_POLES`, left as approved), `src/lib/traits.ts` (`TRAIT_POLE_LINES`), `src/lib/trait-bands.ts` |
| Insights | `src/lib/insight-bank/**`. Old focus wording stays in `RETIRED_FOCUS_TEXT` |
| Questions | `src/lib/questions/bank/**` (not rewritten; a scenario change needs a retired row) |
| Story Library | `src/lib/story-library/lines.ts`. Deeds: `src/lib/story-library/deed.ts` |
| Legends | Roster facts in `src/lib/legend-figures/roster/**` (not rewritten). The meeting prompt is in `src/lib/legend-figures/story.ts` |
| Daily lines | `src/lib/daily-line/` (approved 2026-10-02, not rewritten) |
| Category cards | `src/lib/category-bank/**` |
| Story card 6 | `src/lib/story-v3/lean-phrases.ts` |
| AI prompts | `src/lib/story-library/draft-prompt.ts`, `docs/story-library/STYLE.md` (`style-storylib-6`) |

## What caused the bad lines

The previous voice guide required a scene on every line, one private phrase per trait, a flip scene, and a joke. The picker also preferred a sentence shape. Writers filled those slots with objects that were not in the answers.

1. A listing and a group chat stood in for high openness.
2. A menu order stood in for low openness.
3. A joke and a "side quest" stood in for low playfulness.
4. A quote line matched an option that is not in the question bank, then invented a packing list.
5. A `when` shape glued the player's week to Curie's radioactivity.
6. The same deed was pasted onto a sociability contrast Curie is not tagged for.
7. Pole lines were rewritten into the moment voice ("They have a listing open…").
8. An insight stated curiosity as a dish the player usually orders.
9. Onboarding used an internal name ("The evening Check bump hangs off this").
10. Empty states, the legend error, and the notification ask hid the action.

Round 2 fixed the sample sentences and then repeated one opener ("You'd rather"), one joke ("The new option won."), and Curie's radioactivity on the same card. Those are the rows below.

## Rules and checks changed

| Rule or check | What it used to require | What it does now |
|---|---|---|
| `docs/voice-guide.md` | A real moment on every line | Meaning first. An opener used by more than a third of a pool fails. A legend fact is used once on a card. A hypothetical hour opens with "Picture an hour with…" |
| `.cursor/rules/player-copy.mdc` | Same as the old guide | Points at v2, including the opener cap and the Picture framing |
| `src/lib/voice/player-copy.ts` | Scene phrases, a required flip | `openerOveruse`. Share must be at most one third. Pools shorter than 3 lines are skipped. "You'd rather" and "You would rather" are one key |
| Story Library (`validate.ts`, `voice-review.ts`) | One sentence shape per card | Shape may repeat. Each slot pool, and each assembled card, is an opener pool. `{deed}` and the word "radioactivity" may each appear once on a legend card |
| Insights | Unique focus text | The three focuses of one idea are an opener pool |
| Pole lines | — | All 32 high/low lines are one pool |
| `docs/story-library/STYLE.md` | `style-storylib-5` | `style-storylib-6`. One fact. Varied openings. Picture an hour |
| `src/lib/legend-figures/story.ts` | "If you'd met", plus "that hour is imagined" | "Picture an hour with [name]: they'd be [one roster fact], and you'd [the shared side]." If that side has no fact, the differ line names the reader only |
| Category watch-outs | Must open with Sometimes or Because | Unchanged. That pool is not under the opener cap, because the check requires those two openings |

Still banned: the untried option, gets the first look, one look is enough, the rest can wait, shared side, strong match, you are someone who, embrace, navigate, unlock, journey, vibe, energy as coach-speak. Slang stays casual-only.

## Old / new / reason, by screen

"Old" is the round-2 line a player could see, unless the row says otherwise. "New" is the assembled You-form.

### Explore trait card

| Trait | Old | New | Reason |
|---|---|---|---|
| Openness high | You'd rather try something new, even when other people stick with a familiar option. | You will try something new, even when other people stick with a familiar option. | Same meaning. "You'd rather" no longer opens the pole bank. |
| Openness low | You'd rather stick with something you already know you like. | You stick with something already known to be liked. | The inner "they" would break the check-in stem. The sentence still means a known favorite. |
| Playfulness low | You'd rather take a situation straight than turn it into play. | You take a situation straight instead of turning it into play. | Serious, not Familiar. No invented joke. |
| Extraversion low | You recharge with time to yourself. | You recharge with time to yourself. | Reserved wording, left exact. |
| Other poles | "They'd rather…" on most lines | A plain verb for that trait ("They finish a plan once it is started.", "They state a blunt point and stay with it.") | One opener was more than a third of the 32-line pool. |

### Insight

| Card | Old | New | Reason |
|---|---|---|---|
| `ftw_openness_h_01` focus | Your answers suggest you like trying new things, even when a favorite is right there. | Same sentence, plus two other openings: "From your answers, …" and "The pattern in your answers is that …" | The three wordings of one idea were opening the same way. |
| `ftw_openness_h_01` why | The upside is variety. The catch is you might pass on something you'd enjoy more. | The upside for you is variety. The catch is passing on something that would have been more fun. | Names the tradeoff in plain words. "For you" keeps the you/your rule without "you take on passing on." |
| `ftw_extraversion_l_01` focus | You recharge with time to yourself, especially after a stretch around other people. | You recharge with time to yourself. | The reserved sentence, exact. The other five low-extraversion ideas keep that sentence and add a different short clause so the focuses stay unique. |

Ids are unchanged. Previous focus strings are in `RETIRED_FOCUS_TEXT`.

### Story Library — dive card

Seed `sample-dive`. Openness high, playfulness high, steadiness in the middle.

| Slot | Old | New | Reason |
|---|---|---|---|
| Shows, openness | You'd rather try something new, even when other people stick with what they know. | You will still try something new even when a familiar option is right there. | The preference, with a real "even when." |
| Shows, playfulness | You'd rather turn an ordinary task into play, and it can take longer on purpose. | You can turn an ordinary task into play on an ordinary day as well. | Play, as one idea. |
| Shows, steadiness | You'd let some of a rough moment land and then let the rest go. | Some setbacks you shake off fast, but others stick around. | One idea. Some fade, some stay. |
| Mix | You'd rather keep both of these than pretend they are one habit. | The answers put two things together for you: trying something new, and play in an ordinary task. | Both leans are on the card. No invented cause. |
| Notice | You'd notice a new option before other people settle on a familiar one. | Other people can see that you will try something new before the choice is settled. | What someone else could see, not a private "you'd notice." |
| Means | You'd rather try something new… The upside is variety, and the catch is passing on something that would have been more fun. | What the answers suggest, in plain words, is that you will try something new even when a familiar option is right there. | One idea. The upside and the catch were a second claim on the same line. |
| Joke | The new option won. | The new option won. | This closer belongs to high openness only. Playfulness high is "Play took the long way." Steadiness mid is "Some of it stayed." |

Low card (`sample-dive-low`): extraversion shows as "You will come back to this choice: to recharge with time to yourself." Joke: "The familiar one stayed."

### Legend comparison

Seed `sample-legend` (Marie Curie). Radioactivity is in the first match line only.

| Slot | Old | New | Reason |
|---|---|---|---|
| Match | You'd rather head toward what isn't known yet, like Marie Curie. She studied a new kind of radiation that nobody understood yet, and she named it radioactivity. | You will still try something new even when a familiar option is right there. | Reader line. The roster fact is told once, in the imagined hour, so this line does not repeat it. |
| Scene | You might picture one ordinary hour beside Marie Curie, who coined the word radioactivity. That hour is imagined, not a memory. | Picture an hour with Marie Curie: she'd be testing something nobody understood yet, and you'd want in. | One imagined scene from the openness tag. It does not say "radioactivity," so the deed is not said twice. |
| Means | You'd rather head toward what isn't known yet. Marie Curie coined the word radioactivity. Those two point the same way… | What the answers suggest, in plain words, is that you will still try something new even when a familiar option is right there. | The likeness is the leaning. Her name is not on this line. |
| Joke | The new option won. | The new option won. | Openness high's own closer, not a shared joke. The sentence ends there. |
| Second pair, steadiness | You'd let some of a rough moment land and then let the rest go. | Some setbacks you shake off fast, but others stick around. | She has no steadiness fact, so her name is not on the line. |
| Differ | You'd rather recharge with time alone than with a crowd. | You recharge with time to yourself after time with other people. | Reader only. Reserved wording kept. |
| Babe Ruth differ | You'd rather recharge with time alone. After games, a crowd would gather in Babe Ruth's hotel suite. | You recharge with time to yourself. After games, a crowd would gather in Babe Ruth's hotel suite. | His hotel-suite fact is in the roster. The reader's side is the reserved sentence. |

### Quote of an answer

| Line | Old | New | Reason |
|---|---|---|---|
| `conscientiousness-quote-shows` | You picked "I make the shared doc anyway" when friends wanted a spontaneous trip and nobody had a plan, so you would still put a plan together. | You picked "I make the shared doc anyway" when friends wanted a spontaneous trip and nobody had a plan, so the choice was to make the plan anyway. | The question and the real option. The plan is what that option means. |
| Other quote lines | A made-up scene attached to `{answer}` | You picked "[the option]", which is the option on the screen for that question. | Flagged. The consequence after the tap is not in the answers, so it is not invented. These lines sit at priority 5 so a trait line wins. |

### Category cards and story card 6

| Where | Old | New | Reason |
|---|---|---|---|
| Openness to life, high | You open the group chat and name a spot nobody in it has tried yet. | You name a new option even when the familiar one is still on the table. | The chat and the spot were not in the answers. One contrast. |
| Openness to life, low | You would rather a small table and a known menu than a room full of new names. | You pick a small known group over a room full of new people. | Drops the menu and the "would rather" opener. |
| Drive, low | You would rather a calm plan with clear steps than a push you have to lead alone. | You pick a calm plan with clear steps over a push you have to lead alone. | Same meaning, plain opener. |
| Steadiness, high | You keep the Tuesday plan, stay even in the group chat… | You keep the plan, stay even when the talk gets loud, and still answer when work runs late. | Drops the invented Tuesday and the chat. |
| Everyday social, try | Share one opinion in your next group chat… | Share one opinion with the people you are talking to, so your view is actually said. | A try is an action. It does not require a chat. |
| Card 6 lean, social low | you recharge in quieter company | you want less time in a crowd | Blended category. Not the reserved extraversion sentence, and not "quieter." |
| Story reveal, communication low | You'd rather step back than push. | You step back instead of pushing. | The story is fiction. The closer no longer uses the shared "You'd rather." |
| How you argue, Quiet exit | You'd rather step out than step in. | You step out of a fight instead of joining it. | Names the behavior. |
| Communication kryptonite | You'd rather step back than push your view. | You step back instead of pushing your view. | Same. |

### Buttons, errors, questions, notifications

Phase 1 wording stays. Empty state: "Answer 16 questions and this chart starts to fill in." Legend error names a failed charge instead of always promising tokens back. The notification ask says "Allow a reminder?" The evening question says "The evening reminder mentions the one you pick."

## Assembled cards now

### High dive

- You will still try something new even when a familiar option is right there.
- You can turn an ordinary task into play on an ordinary day as well.
- Some setbacks you shake off fast, but others stick around.
- The answers put two things together for you: trying something new, and play in an ordinary task.
- Other people can see that you will try something new before the choice is settled.
- What the answers suggest, in plain words, is that you will try something new even when a familiar option is right there.
- The new option won.

### Curie card

- You will still try something new even when a familiar option is right there.
- Some setbacks you shake off fast, but others stick around.
- Picture an hour with Marie Curie: she'd be testing something nobody understood yet, and you'd want in.
- What the answers suggest, in plain words, is that you will still try something new even when a familiar option is right there.
- You recharge with time to yourself after time with other people.
- The new option won.
- Ruth, for the sourced contrast: You recharge with time to yourself. After games, a crowd would gather in Babe Ruth's hotel suite.

## Flagged instead of inventing a fact

- Curie has no steadiness fact and no extraversion fact. Those lines state the reader and do not name her.
- A legend line with no roster fact for that side states the reader only. It does not say the side is separate from what they are known for, and it does not say the answers land on that side.
- A generic imagined hour still names the legend with the famous-for deed (`{deed}`), because that deed is a roster fact. The Curie openness hour uses the openness tag instead, so the sample card does not also say "radioactivity."
- Quote lines other than the real conscientiousness option do not describe what happened after the tap.
- Daily lines stay as emci approved them on 2026-10-02. A few still join two beats with "and then." They were not rewritten.
- `AXIS_POLES` stay as the approved first-person quotes.
- Question prompts and option scores stay. A scenario edit needs a retired row and a migration.
- Legend roster facts, `whoTheyWere`, and `famousFor` stay.
- Category watch-outs now open with "Sometimes" and state one possible cost. They are not a claim that this player had that evening. "For a while" stays where it means a length of time.
- `docs/NOW.md`, `PROJECT_CONTEXT.md`, and `docs/ato-finish-roadmap.md` were not edited. Scoring was not edited.
