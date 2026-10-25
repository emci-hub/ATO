# Player-facing voice

This is the source of truth for player-facing copy: stories, the Story Library, insights and Focus, trait descriptions, legends, buttons, tooltips, empty states, onboarding, and notifications.

Policy v2, meaning first (emci, 2026-10-23). It replaces the rule "show every trait through a real moment." A line does not have to be a scene, a joke, or a metaphor. A simple, direct explanation is often best.

`src/lib/voice/player-copy.ts` enforces the mechanical half. `npm run check:player-copy` runs it. The Story Library save still refuses a draft that fails the mechanical check. Accuracy, the trait link, and whether a line invents the player's history are a writer's job. The check cannot taste a line.

If this file and `docs/copy-review-rules.md` disagree, the content policy wins and this file gets a revision. Do not add exceptions in a prompt. Adult humor is still allowed there when it does not weaken a higher priority below.

## Meaning first

Every player-facing message must make sense where it actually appears. The reader should not have to invent missing information.

1. Say what you actually mean. State the intended meaning in one plain sentence first. Write that naturally. Do not decorate it until the meaning is unclear.
2. Do not assume missing context. Do not refer to a listing, a plan, a joke, a question, or an order unless that thing is introduced and visible. If a message can appear alone, it must make sense alone.
3. Do not invent the player's history. Never turn a score or an answer into a claim that an event happened. Keep three things separate: what the player said, what the answers reasonably suggest, and a hypothetical example. Never present the third as the first.
4. Keep the trait-to-description link accurate. Do not add an unrelated habit (preferring familiar things is not the same as being serious, ignoring jokes, disliking people, or planning everything).
5. Use an example only when it clarifies. Give it enough context. Mark a hypothetical as hypothetical.
6. Priority: accuracy, then clarity, then relevance, then a natural voice, then optional humor. Cut any joke or metaphor that weakens a higher priority.
7. Match the writing to the purpose. A button names the action. An error says what happened and what to do. A question makes the ask clear. An insight says what the answers suggest and why. A comparison states the actual similarity or difference. A story or a legend may use a creative scene, but the scene has to be established, and fiction stays distinct from a claim about the player's real life. Do not make every screen sound like a story card.
8. Use ordinary, direct wording. Specific nouns, clear connections. Do not replace a plain word with vague imagery. Do not force slang, jokes, side quests, group chats, or punchlines.

## Acceptance check

For every message, before it is called done:

- What does this mean, in one plain sentence?
- Why is it shown here?
- Is every referenced thing introduced or visible?
- Does it follow from the answer or the trait?
- Does it invent something the player did?
- Is it clearer without the joke or the scene?
- Does the complete assembled message make sense?

Shorter, casual, vivid, or grammatical is not enough. The line has to be understandable and grounded. If the meaning is uncertain, flag it. Do not guess.

## What changed from the moment rule

These are no longer requirements:

- A scene, a place, or an object on every line.
- One private scene phrase per trait (group chat, packing list, side quest, and the rest).
- A joke or a tease on every surface.
- A flip field that invents the opposite pole's scene. A flip note is optional, it is not shown, and it does not have to be a scene.
- A word ban on ticket, specials board, kettle, loud option, fork, bag, chair, or costume. Those words were banned to stop a private code, and the ban pushed writers into substitute imagery. Do not use an object as a code for a trait. The words themselves are allowed when they mean the actual object.
- A playful "Early read:" costume for a low-confidence line. Say the read is early, in plain words.

A Story Library card may use the same sentence shape more than once. The old one-shape cap pushed a false "when" onto lines that were not the same event. Do not add a connector only to satisfy a shape. A real "even when" is fine. A "when" that glues two unrelated facts is not.

Vary how a line opens. "You'd rather" must not start most lines in a pool. An opener used by more than about a third of the lines in a pool of three or more fails the check. A pool is the lines that share a slot, a trait, and a tier. A line written for one legend is its own pool, because a player never hears two legends in the same sitting. The spoken lines on one assembled card are a pool too. "You'd rather" and "You would rather" count as the same opener.

Use a legend fact once on a card. The match line may carry it. The scene, the meaning, and any later match line do not repeat it.

A hypothetical meeting opens with "Picture an hour with {legend}." That opening is the mark that the hour is not a memory. Do not add "That hour is imagined, not a memory." Make it one imagined scene from a roster fact, such as "Picture an hour with Marie Curie: she'd be testing something nobody understood yet, and you'd want in." Do not say the talk would stay on the known work.

Each line states one plain idea. Do not join two ideas with because, and then, or while. Do not add a cause the answers do not show. A real "even when" is one contrast. "For a while" is a length of time, not a second idea.

Name a legend only when that side has a roster fact. If it does not, state the reader and leave the legend out. Do not say the side is separate from what they are known for, and do not say the answers land on that side.

Each trait has its own closer. Do not reuse one joke, such as "The new option won.", across traits.

Reserved (low extraversion) is "You recharge with time to yourself." Use that sentence on trait cards, insights, and legend comparisons.

## Purpose

- **Trait description.** What this side of the trait means. Not a memory of the player's week.
- **Insight.** What the answers suggest, and why that matters. Hedge when it is a suggestion. Do not narrate an event that was not reported.
- **Quote of an answer.** Repeat the player's option and say what that option means in the question they were asked. If the question cannot be found, do not invent a consequence. Flag it.
- **Legend match.** The actual similarity between the player's leaning and a sourced fact about that person. The player's leaning is not something they did in the legend's life.
- **Legend contrast.** The actual difference. Both sides stay accurate. Do not glue the two with a shared scene they did not share.
- **Button.** The action.
- **Error.** What happened, and what to do.
- **Empty state.** What is empty, and the way forward.
- **Notification.** What the note is, and what it asks. It must make sense on a lock screen.
- **Onboarding question.** The ask, plus why it is asked, in words the player can check against the choices on the screen.
- **Story.** A scene is allowed. Establish it. Keep it fiction.

## Examples

Direction, not templates.

Unclear: "You had the listing open when the group chat was still stuck on the safe plan."

Clear: "You like trying new things, even when everyone else would rather stick with what they know."

Unclear: "You knew the best thing on the menu, and the group chat could not change the order."

Clear: "You stick with what you already know you enjoy."

Unrelated, if it was attached to familiar-preference: "You heard the joke and then answered the actual question." Check the trait first. Familiar-preference does not mean ignoring jokes.

Unsupported: "You picked 'I plan a whole new day,' and the packing list was done before anyone else had shoes on." Say what that option means in the question. Do not invent a packing list. If the question is not in the bank, flag it.

Bad legend link: "You tried a place nobody at the table could name when Marie Curie coined the word radioactivity." The deed is real. The dinner is not, and "when" makes them one event.

## Phrases that still fail the check

These stay banned because they hide the meaning: The untried option. Gets the first look. One look is enough. The rest can wait. Shared side. No shared side. Strong match. No match. Chased an unknown glow. Measured everything, twice. You kept to the familiar choice. You are someone who. You may find. It's important to. Embrace. Navigate. Unlock. Journey, when it is coach-speak (a sourced fact that names a real journey can stay). Vibe. Vibes. Energy.

"Tend to", "this suggests", "this reflects", and "your pattern shows" are allowed when they hedge a suggestion. A direct sentence is better when the meaning is solid. "Your answers suggest…" is the right register for an insight.

Slang stays casual-only, one term a sentence, and never required.

Low confidence is a plain hedge. "This read is early" is enough. Do not costume it as a snack-planner.

## Slots

Story, insight, and legend copy that is stored as a line stays a finished line. Slots are only names, pronouns, the legend's name, a real deed, and the player's own answer: `{Subj}`, `{subj}`, `{Name}`, `{legend}`, `{deed}`, `{answer}`. `{deed}` is a short sourced clause. `{answer}` is the option the player chose. Do not invent a quotation.

Each line keeps its id, eligibility, and priority. The highest-priority eligible line wins. A shown line does not repeat until the eligible pool is used. Legends cards and category deep dives render from this library. There is no runtime switch back to a model.

## What the check enforces

`npm run check:player-copy` fails on:

- a banned phrase from the list above
- slang outside the casual tier, or two slang terms in one sentence
- an opener used by more than about a third of a Story Library pool, or of the spoken lines on one assembled card
- a legend deed, or the word radioactivity, repeated on one assembled legend card
- "energy"

It does not fail on a missing scene phrase, a missing flip, a joke that is absent, a repeated sentence shape, or the words ticket, kettle, fork, bag, chair, or costume.
