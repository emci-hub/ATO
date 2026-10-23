# Copy audit

Player-facing copy now follows `docs/voice-guide.md`. An earlier clinical-voice proposal lived in this file; that draft is in git history and is not the rule.

`STORY_LIBRARY_RUNTIME` still ships off. Trait ids and what each pole means are unchanged. Story, insight, and legend lines are finished sentences. The fragment bank (verb + aside + closer) is gone.

## What changed

| File | Old | New | Why |
|---|---|---|---|
| `src/lib/story-library/lines.ts` | Verb, aside, closer, and "[adj] [noun]" fragments assembled per card | 386 finished lines, one moment per trait × pole × tier, plus a fallback | A friend says the whole sentence. Fewer lines, each one specific. |
| `src/lib/story-library/pick.ts` | First fragment that fit the slot | Highest-priority eligible line. Shown ids are skipped until that pool is used up | Salience, then no-repeat |
| `src/lib/story-library/shown.ts` | No memory across cards | Device key `ato.story-library.shown`, and the same ids inside the story JSON already saved on deep dives and legends | Don't repeat a line the player has seen |
| Quote lines | No quotation was allowed in a library line | `You picked "I plan a whole new day", and the checkbox still got its own column.` | The line can use the player's own answer when one was passed in |
| `src/lib/trait-bands.ts` | How you tend to move | How you move | "tend to" is banned in player-facing lines |
| `src/lib/category-bands.ts` | When it falls apart, you tend to figure it was going to… | When it falls apart, you figure it was going to, and that road can feel closed. | Same habit, without "tend to" |
| `src/lib/traits.ts` `TRAIT_POLE_LINES` | They tend to… | A concrete habit for each pole. The low pole is its own brag | Flip test: a low-openness person orders the usual dish and would not nod at a new ticket |

Questions were not rewritten. Retired insight keys still hold the old wording so history maps. Pole display names are unchanged.

## Budgets the check now enforces

- Tag questions like ", right?": 0 of 386 lines (cap about 1 in 10).
- Each sentence shape at most once on a spoken card. Titles are labels and stay out of that count.
- Each trait's scene object stays in that trait's world, at most once on a card, at most 12 times in that trait's bank.
- "energy", "tend to", and the banned list in the voice guide.
- Every line has a flip field: the opposite pole's reaction. It is not shown.

`npm run check:story-library` and `npm run check:player-copy` are green.

## Flip test

Every shipped Story Library line has a written flip. These are the ones read both ways for the samples below.

| Line | Opposite pole |
|---|---|
| You opened a new ticket when the specials board still had a blank line. | The usual dish was the whole point, and a new ticket would have been a hassle. |
| You skipped the specials board, and the usual dish got ordered again. | A new ticket would already be open before the usual dish got a second look. |
| You heard the loud option and then let it wait by the kettle. | The loud option would already be in the room. |
| You kept the kettle on low when the loud option knocked. | The wobble would already have a seat. |
| You picked "I plan a whole new day", and the checkbox still got its own column. | Dinner would already be on the stove, and the last box could stay blank. |
| You opened a new ticket when Marie Curie reached the same fork with a different bag. | Match: same fork, different bag. Both still did the thing. |
| You stayed with the extra chair because Marie Curie kept the other bag closed. | Contrast: one stays with the chair, one keeps the bag. Both are fine. |

## Samples

Same seed (`sample-dive`). High reader: openness high, playfulness high, steadiness mid. Low reader: steadiness high, openness low, playfulness low.

### Before (fragment assembly)

Title: the open order

Shows up: You wander when the group chat pings. The specials board wins the order, and a new ticket is already open.

Mix: The silly friend names a place out loud because the other friend is still tying a shoe.

Means: You took the detour before anyone agreed, right?

The means line was a tag question, and the shows line was two sentences glued from a verb and an aside.

### After, high reader — the open ticket

- You opened a new ticket when the specials board still had a blank line.
- You brought the costume, and the plain errand turned into a bit.
- You heard the loud option and then let it wait by the kettle.
- You took the detour before anyone agreed because the grin was the whole point of leaving.
- You already had a new ticket pulled up before anyone sat down to order.
- Would tomorrow still recognize the little detour you wrote down before the group chat even picked a place to sit?
- The new ticket packed itself.

### After, low reader — the steady pour

- You kept the kettle on low when the loud option knocked.
- You skipped the specials board, and the usual dish got ordered again.
- You heard the joke and then answered the actual question without a costume.
- You named a place out loud because the other friend was still tying a shoe at the door.
- You already had the loud option parked outside before the room noticed.
- Would tomorrow still recognize the quiet pour you wrote down before the group chat even picked a place to sit?
- The loud option waited outside.

The low openness line is the brag: the usual dish, on purpose. It is not a smaller version of opening a ticket.

### Quote

You picked "I plan a whole new day", and the checkbox still got its own column.

That line wins only when the chosen answer contains those words. Without an answer, the trait's own line is used.

### Legend match (Marie Curie)

You opened a new ticket when Marie Curie reached the same fork with a different bag.

Same fork. Different bag. No score.

### Legend contrast

You stayed with the extra chair because Marie Curie kept the other bag closed.

Both reactions are likable. Neither names a percent.

Screenshots, 390×844: `dive-high.png`, `dive-low.png`, `legend.png`.
