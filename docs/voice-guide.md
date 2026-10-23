# Player-facing voice

This is the single source of truth for player-facing copy: stories, the Story Library, insights and Focus, trait descriptions, legends, buttons, tooltips, empty states, onboarding, and notifications.

`src/lib/voice/player-copy.ts` enforces the mechanical half. `npm run check:player-copy` runs it. The Story Library save refuses a draft that fails it, before that draft can be approved. Flip test, both poles, and the couch test's judgment are still a writer's job. The check cannot taste a line.

If this file and `docs/copy-review-rules.md` disagree, the content policy wins and this file gets a revision. Do not add exceptions in a prompt.

## Core rule

Don't describe a trait. Show what it looks like in a real, recognizable moment. If a line could appear in a personality test, a therapy app, a science article, a motivational poster, or product docs, rewrite it.

## Writing rules

- Real person to real person. Everyday words.
- A concrete action, place, or object. Show it. Don't label it.
- Keep the meaning accurate. Don't flatter and don't dramatize.
- Vary the rhythm. One to three sentences.
- A little attitude is welcome. Don't explain the system.
- Tease the habit, never the person's worth.
- No repeated sentence shapes across traits. Each trait keeps its own places and objects.

## Discrimination

A high-pole line fits someone high on that trait and does not fit someone low. A low-pole line is a real, likeable way of being, never an insult and never a lesser version of the high pole. Both poles are something to brag about.

Low openness sounds like: "You know the best thing on the menu, and you're ordering it again." It does not sound like "you are closed" or "you are afraid of new things."

## Acceptance checks

1. **Specific enough to be wrong.** No flattering line everyone would nod at (Barnum).
2. **Couch test.** How would a friend say it on the couch? No "energy". No "vibes".
3. **Tease the habit, never the person's worth.**
4. **One concrete detail beats a summary.** "14 tabs open about one documentary" beats "you are curious."
5. **Flip test.** Read the high-pole line to a low-pole person. If they would nod too, rewrite. Note the lines you flip-tested in `docs/copy-audit.md`.
6. **Both poles are a skill.** The low pole is its own brag, not a discount high pole.
7. **Match and contrast.** Match is one shared moment with a small difference. Contrast is both people reacting to the same thing, both likable. Never mention scores, "strong match", or "shared side".
8. **Variety.** Each trait has its own places and objects, and those don't cross over. Mix line shapes on a card (question, "X, and then Y", short punchline, quote). On a Story Library card each shape appears at most once. Elsewhere, no shape is over 25% of one card.
9. **Slang.** One term max, seasoning not the joke, still readable to someone who has never heard it. Skip very new or group-specific terms. Casual tier only. Never Legends, serious moments, or formal UI. Tap-to-see meaning, no brackets.
10. **Low confidence.** A trait that is "still learning" gets a hedged, playful line: "Early read: you might be the snack-planner."

## Banned phrases

The untried option. Gets the first look. One look is enough. The rest can wait. Shared side. No shared side. Strong match. No match. Chased an unknown glow. Measured everything, twice. You kept to the familiar choice. You tend to. You are someone who. This suggests. This reflects. Your pattern shows. You may find. It's important to. Embrace. Navigate. Unlock. Journey (coach use; a sourced history fact that names a real journey can stay). Vibe check. Anything that sounds like a horoscope, a therapist, a scientist, a coach, or a product manager.

Also banned in player-facing lines: "energy", "vibe", "vibes", and "tend to". A question the player answers is not rewritten to chase that ban. A retired insight key stays so old history still maps.

A profile drawback still opens with "You may" and then a concrete cost. It does not say "You may find".

## Match and contrast

Match: "You both say yes to the weird side quest. You just bring a spreadsheet."

Contrast: "One of you needs a plan. The other already left to find out what's down that road."

Both people stay likable. Neither line names a score or a percent.

## Scene objects

These belong to one trait. Don't reuse them on another trait.

| Trait | Object |
|---|---|
| openness | specials board |
| conscientiousness | checkbox |
| extraversion | doorbell |
| agreeableness | potluck |
| steadiness | kettle |
| attachment_anxiety | read receipt |
| attachment_avoidance | doorway |
| conflict_assertiveness | agenda |
| conflict_cooperativeness | timeslot |
| autonomy | ballot |
| competence | red pen |
| relatedness | couch night |
| growth_mindset | practice rep |
| locus_of_control | steering wheel |
| self_efficacy | guest list |
| playfulness | costume |

## Whole lines

Story, insight, and legend copy is written as finished lines. Do not assemble a verb, an aside, and a closer, and do not fill an "[adjective] [noun]" bank. Fewer good lines beat a big bank.

- Slots are only names, pronouns, and the player's own facts: `{Subj}`, `{subj}`, `{Name}`, `{legend}`, `{answer}`.
- Each line has eligibility (trait pole, confidence tier, a specific answer, a legend, recency) and a priority. The highest-priority eligible line wins. A broad fallback is always in the pool.
- Shown line ids are remembered for the player, on the device and inside the story JSON already saved for deep dives and legends. A line does not repeat until every eligible line has been used.
- Where an answer exists, a line may quote it: You picked "I plan a whole new day", and the checkbox still got its own column.
- Every line has a flip field: the opposite pole's reaction, written out. The check requires it. It is not shown.

## Sentence shapes

A card mixes question, "X, and then Y", compound ("X, and Y"), because, when, short punchline (six words or fewer), quote, and other. On a Story Library card each of those shapes appears at most once. Titles are labels and are not part of that count. Tag questions like ", right?" stay at or under about 1 in 10 lines. Each trait's scene object stays in that trait's world, and shows at most once on a card.

A quote in the Story Library is the player's own answer, passed in as `{answer}`. The line does not invent a quotation.

## Slang tier

Casual frames are `casual` and `slang`. Everywhere else, including Legends and Story Library jokes (they render on Legends), slang fails the check. One slang term per sentence. The term is seasoning. The line still makes sense if the reader has never heard it.

## Low confidence

Until a trait is a solid read, hedge it and keep it playful. "Early read: you might be the snack-planner." Don't hand out a verdict.

## Good and bad

Bad: "You dive when the group chat pings. The untried option gets the first look."

Better: "Group chat pings, and you're already looking up tickets. The safe plan never stood a chance."

Bad: "You tend to be curious."

Better: "The specials board wins, and a new ticket is already open."

Bad low pole: "You avoid new things."

Better low pole: "The specials board stays unread, and the usual dish gets ordered again."

## Final friend test

Would a real friend say this out loud about another real friend? If not, rewrite it.

## What the check enforces

`npm run check:player-copy` fails on:

- a banned phrase in a player-facing bank
- slang outside the casual tier, or two slang terms in one sentence
- a rendered Story Library card that repeats a sentence shape
- a scene object that is missing from its trait, that shows up on another trait, or that appears more than once on a card
- a tag question (", right?") on more than about 1 in 10 Story Library lines
- a Story Library line with no flip field
- "tend to" or "energy"
- a "still learning you" line that is not an "Early read:"

The same review runs when a Story Library draft is saved, before it can be approved.
