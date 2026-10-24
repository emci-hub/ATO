# Copy audit

Player-facing copy follows `docs/voice-guide.md`. An earlier clinical-voice proposal lived in this file; that draft is in git history and is not the rule.

`STORY_LIBRARY_RUNTIME` still ships off. Trait ids and what each pole means are unchanged. Story lines are finished sentences a friend could say out loud. The private metaphor code (ticket, specials board, kettle, loud option, fork, bag, chair, costume) is gone.

## What changed in this pass

| File | Old | New | Why |
|---|---|---|---|
| `src/lib/story-library/lines.ts` | 386 lines built from private symbols ("opened a new ticket when the specials board still had a blank line") | 786 literal scenes. Each pole has its own line. Legend lines name a real deed via `{deed}` | A reader can tell what happened. The friend test is the bar |
| `src/lib/story-library/deed.ts` | Legend lines invented a fork and a bag | `{deed}` fills from a sourced clause. Marie Curie: "coined the word radioactivity" | The real person has to have done the thing the line says |
| `src/lib/voice/player-copy.ts` | Scene objects were the symbols (kettle, costume, checkbox) | Real phrases (group chat, packing list, side quest) plus `metaphorSymbolIssues` | The check rejects the symbol words inside Story Library lines |
| `src/lib/trait-bands.ts` | opens a new ticket | tries a new place | The share card was still using the ticket metaphor |
| `src/lib/traits.ts` pole lines | "They open a new ticket…", "the wobble", "the last box" | A listing, a midnight reply, a packing list | Same habits, said the way a friend would |
| Insights | A few focuses still named no scene ("when something is not working, you usually leave it") | The recipe fails and you order dinner; a hard text still leaves the afternoon meeting; the Saturday plan is written down | Those three failed the friend test. The rest of the bank already named a real moment and stayed |

Questions were not rewritten. Retired insight keys still hold the old wording so history maps. Pole display names are unchanged. The insight bank was re-read; only the lines that failed the friend test were rewritten, so ids, try/watch openers, and the retired-title map stay valid.

## Budgets the check enforces

- Tag questions like ", right?": 0 of 786 lines (cap about 1 in 10).
- Each sentence shape at most once on a spoken card. Titles are labels and stay out of that count.
- Each trait's scene phrase stays in that trait's world, at most once on a card, at most 12 times in that trait's bank.
- "energy", "tend to", and the banned list in the voice guide.
- Story Library lines reject ticket, specials board, kettle, loud option, fork, bag, chair, and costume.
- Every line has a flip field: the opposite pole's reaction. It is not shown.

`npm run check:story-library` and `npm run check:player-copy` are green.

## Friend test

Every Story Library line was rewritten as a literal scene and then read against "would a friend say this out loud?" Lines that still needed a private object, or that hid the event inside a symbol, were rewritten again before the check. The samples below were also flip-tested: the low pole would not nod at the high line.

| Line | Opposite pole |
|---|---|
| You had the listing open when the group chat was still stuck on the safe plan. | The usual dish was already the plan, and a new listing would have been a hassle. |
| You knew the best thing on the menu, and the group chat could not change the order. | A new listing would already be open before the usual dish got a second look. |
| You heard the new plan and then let it wait until morning. | The reply would already be sent, and the thread would still be open at midnight. |
| You left the argument alone when a reply could wait until morning. | The reply would already be sent at midnight. |
| You picked "I plan a whole new day", and the packing list was done before anyone else had shoes on. | Dinner would already be on the stove, and the list could stay half done. |
| You tried a place nobody at the table could name when Marie Curie coined the word radioactivity. | Ordering the usual dish would not be trying a place nobody could name. |
| You stayed with one friend because that was the choice, and Marie Curie coined the word radioactivity. | The other choice is telling the whole table. Both are fine. |

## Samples

Same seed (`sample-dive`). High reader: openness high, playfulness high, steadiness mid. Low reader: steadiness high, openness low, playfulness low.

### Before (the symbol pass)

- You opened a new ticket when the specials board still had a blank line.
- You brought the costume, and the plain errand turned into a bit.
- You heard the loud option and then let it wait by the kettle.
- Marie Curie reached the same fork with a different bag.

A reader could not tell what happened.

### After, high reader — the new place

- You had the listing open when the group chat was still stuck on the safe plan.
- You turned the grocery run into a side quest, and the list took longer on purpose.
- You heard the new plan and then let it wait until morning.
- You said yes to the weird errand because the spreadsheet came along too.
- You already had a new city pulled up before anyone sat down to pick a place.
- Would you still talk the table into a place nobody has tried if the usual restaurant were the only one with a free table tonight?
- The safe plan lost.

### After, low reader — the quiet morning

- You left the argument alone when a reply could wait until morning.
- You knew the best thing on the menu, and the group chat could not change the order.
- You heard the joke and then answered the actual question without a side quest.
- You named a place out loud because the other friend was still tying a shoe at the door.
- You already looked settled before the rest of the thread had finished typing.
- Would you still leave a messy thread unanswered overnight if the person on the other end was clearly upset and still waiting?
- The reply waited.

The low openness line is the brag: you know the best thing on the menu and you order it. It is not a smaller version of opening a listing.

### Quote

You picked "I plan a whole new day", and the packing list was done before anyone else had shoes on.

That line wins only when the chosen answer contains those words. Without an answer, the trait's own line is used.

### Legend match (Marie Curie)

You tried a place nobody at the table could name when Marie Curie coined the word radioactivity.

You spent one ordinary hour on those notes after Marie Curie coined the word radioactivity, with a new place still open on the phone.

She coined the word. You tried the place nobody could name. No score.

### Legend contrast

You stayed with one friend because that was the choice, and Marie Curie coined the word radioactivity.

You kept the night small. She did the work she is known for. Both are likable. Neither names a percent.

Screenshots, 390×844: `dive-high.png`, `dive-low.png`, `legend.png`.
