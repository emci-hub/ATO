# Design

A RimWorld / Tracery slot grammar, with the Left 4 Dead / Crusader Kings rule that the most specific match wins. The research notes in the task are the source of that shape. This page says how it sits on ATO's data.

The prototype in [prototype/](prototype/) is a working copy of this design. It is not imported by the app. If this is built for real, extend `src/lib/story-v3/tracery.ts` or replace that expander once. Do not add a third renderer beside v3 and this prototype.

## What runs where

- **Authoring.** An admin, in a root-only dev tool, writes templates and bank entries. An optional model may draft entries. It sees the style guide and the slot, never a person's answers. See [STYLE.md](STYLE.md).
- **Check.** Every save, and CI, renders the matrix in [GUARDRAILS.md](GUARDRAILS.md).
- **Phone.** The app picks a template, reads the person's trait bands, fills slots, and shows the string. No network call for the words. Percents, match tags, and museum facts stay computed or hand-written, as they are today.

## Tiers and traits

Use the bands the category cards already use.

| Band | Rule in `traitBand` | Feel of the words |
|---|---|---|
| low | value under 0.35 | careful, small, familiar |
| mid | 0.35 up to 0.65 | plain, in the middle |
| high | 0.65 and up | the strong version of that trait |

Dominant trait: the highest absolute lean among the traits the template is allowed to read (a deep dive reads the category's axes; a legend reads the matched sides; an insight reads the clear leans the focus picker already uses). Secondary trait: the next one, if it clears mid. Verbs and asides come from the dominant. Adjectives come from the secondary when there is one, otherwise from the dominant. That is the blend from the research, and it is what `legend-detour` does.

A combo ending names both traits. It beats a one-trait ending because it matches more facts. You only write a combo when the pair really changes the outcome. You do not write a grid of all 16 × 16.

Pronouns on the reader: `you`, `they`, `she`, `he`. App insights lock this to `you`. Legends and Play can use a name plus a set. Default is they/them, and the verb stays in the base form ("they pause", not "they pauses"). `you` uses the same base form, and `{be}` is "are".

## Slot syntax

A backbone is a sentence a person can read aloud. Slots are names in braces, not `{1}`.

```text
{Name} {beName} in the {where}. {Subj} {verb} before anyone else speaks. {aside}
{Subj} {be} {mood} about {find}.
{ending}
```

Built-in tokens, resolved from the reader, never from the bank:

| Token | you | they | she | he |
|---|---|---|---|---|
| `{Name}` | You | the name | the name | the name |
| `{beName}` | are | is | is | is |
| `{Subj}` / `{subj}` | You / you | They / they | She / she | He / he |
| `{poss}` | your | their | her | his |
| `{obj}` | you | them | her | him |
| `{be}` | are | are | is | is |
| `{have}` | have | have | has | has |
| `{ending}` | the winning ending's text | | | |

`{Name}` is "You" when the pronoun is you, so the line does not become "Alex are".

## Typed slots

Each `{name}` in the body has one slot spec. An entry can fill it only when part of speech, frame, tone, and intensity all match.

```ts
type Pos = 'verb' | 'adj' | 'noun' | 'phrase';
type SlotForm = 'agree' | 'base' | 's' | 'ed' | 'ing' | 'singular' | 'plural' | 'clause';

interface SlotSpec {
  id: string;
  pos: Pos;
  form: SlotForm;          // verbs: 'agree' picks base or -s from the pronoun
  frame: string;           // the sentence shape this word was written for
  trait: 'dominant' | 'secondary' | 'generic';
  tones: Tone[];           // entry.tone must be in this list
  intensities?: Intensity[];
  lock?: string;           // shared lock id → one pick for the whole story
  article?: 'auto' | 'none';
}
```

`frame` is what stops the mad-libs. "Dive" is legal in "when the group chat pings" because that entry was written for frame `react`. It is not legal in "through the vault" unless someone writes a `motion-through` entry whose whole phrase works there. The prototype keeps one verb frame, `react`, and uses it only in sentences every stored verb can finish.

Forms:

- **Verb.** The slot says `agree` (or a fixed form). The entry stores all four: base, -s, -ed, -ing. The filler never adds "-s" itself, so `read` / `reads` / `read` / `reading` stays correct.
- **Noun.** `singular` or `plural`, plus an article of `a`, `an`, `the`, or `none`. `article: 'auto'` on the slot puts that article in front. A locked second slot can show the same noun bare ("an open tab" the first time, "open tab" the second).
- **Adjective.** A single word or a short modifier that fits "{be} {mood} about {find}".
- **Phrase.** A finished clause or sentence (`form: 'clause'`). This is the piece that should do most of the talking. The research is right that a phrase breaks less than a single word.

Tone is `calm | steady | warm | dry | bright`. Intensity is `soft | plain | sharp`. A slot that only allows soft and plain will not take a sharp entry, even when the trait and tier match. The sample bank includes `openness-high-screech` as a sharp decoy. It is never picked. The test checks that.

## Word entries

```ts
interface WordEntry {
  id: string;
  pos: Pos;
  text?: string;             // adj, noun, phrase
  forms?: { base; s; ed; ing }; // verb
  trait: string | 'generic'; // a TRAIT_AXES id, or the fallback
  tier: 'low' | 'mid' | 'high' | 'any';
  frame: string;
  tone: Tone;
  intensity: Intensity;
  article?: 'a' | 'an' | 'the' | 'none';
  number?: 'singular' | 'plural';
  status: 'draft' | 'validated' | 'approved';
}
```

Lookup, first pool that still has a fresh entry:

1. That trait and that tier.
2. That trait, any tier.
3. `generic`, any tier.

If every fresh entry was used already, the same ladder may repeat. A render never leaves `{slot}` in the output. An empty ladder is a failed save, not a blank shown to someone.

Generic lines are written for the same frame, so the fallback sentence is dull on purpose and still grammatical. "They stop when the group chat pings" is the generic verb in the sample.

## Endings

An ending is not a word swap. It is another piece of text, chosen by how specific it is.

```ts
interface EndingSpec {
  id: string;
  when: {
    trait?: string;
    tier?: Tier;
    alsoTrait?: string;
    alsoTier?: Tier;
  };
  text: string; // may use pronoun tokens and slots already picked
}
```

Rules:

- Every fact in `when` has to be true, or the ending is out.
- Score is the number of facts named (a tier counts as its own fact).
- Highest score wins. Ties break with a stable hash of the seed, not `Math.random`.
- `when: {}` is the fallback. Score 0. It always matches. A template that contains `{ending}` must have one.
- A combo (`openness` high and `playfulness` high) scores higher than `openness` high alone, so the combo is the one that shows.
- Mid, in the sample, has no special ending, so it gets the fallback. That is deliberate: write the special cases, don't fill a grid.

The two facts have to be two different traits. An ending cannot match `openness` against both slots of one person.

## Locks, no-repeat, seed

- **Lock.** Slots that share `lock` reuse one entry. `insight-keep` shows the noun as "an open tab" and later as "the same open tab".
- **No-repeat.** Inside one story, an entry id is spent. The next slot walks the ladder for a fresh one. The caller can also pass ids to avoid from recent stories (the same idea as the insight bank's no-repeat window). If that empties the trait pool, generic is used. The test avoids `openness-low-pause` and expects `generic-stop`.
- **Seed.** Hash of template id, traits, tiers, and pronoun. The same person on the same day gets the same text. This matches `fnv1a` in the daily-line bank.

## Sample library

| Template | Kind | What it shows |
|---|---|---|
| `insight-ping` | insight | Verb agreement and an aside. |
| `insight-keep` | insight | a/an, `{have}`, and a locked noun. |
| `legend-room` | legend | Name plus pronoun, no branch. |
| `legend-detour` | legend | Adjective from the secondary trait, and a branching ending. |

Traits in the sample: `openness`, `steadiness`, `playfulness`. Three tiers each, plus generic fallbacks. One sharp decoy that must never appear.

A few real renders (the full 360 are in [prototype/sample-output.md](prototype/sample-output.md)):

**Insight, openness high, she**

> She dives when the group chat pings. The untried option gets the first look.

**Insight, openness low, you**

> You pause when the group chat pings. One look is enough, and the rest can wait.

**Legend, steadiness low, he** — ending `steady-low`

> Alex is in the back room. He flinches before anyone else speaks. The wobble shows, and it is allowed to. He is uneasy about a loose plan. The day can wobble. He is still here after it.

**Legend, openness high + playfulness high, they** — ending `open-play-high`, not the single-trait ending

> Alex is in the waiting room. They dive before anyone else speaks. The untried option gets the first look. They are delighted about an open tab. The detour takes the whole evening, and their grin says the night was worth it.

**Legend, steadiness mid, she** — no special ending, so the fallback

> Alex is in the kitchen. She waits before anyone else speaks. The pace does not change for this. She is settled about a ticked step. The night stays small, and that is enough.

The locked insight:

> She dives when the unread thread pings. The untried option gets the first look. What she has in hand is an open tab. The same open tab is still there later.

"What she has in hand" is stiff on purpose. It is there to prove the article and the lock. A production insight should keep leaning on phrase slots and the existing full-sentence bank until a new backbone sounds like `src/lib/insight-bank/`. The validator can prove grammar. It cannot prove the line is one you would want on Home. A person still reads the matrix.

## Card shapes to grow into

Not in the prototype. When a surface moves, its template's slots should line up with the fields the screen already shows, so the UI does not change.

- **Deep dive.** Slots for title, up to three shows-up lines (one per top lean), mix, notice, closing. Angle (`people` / `work` / `solo`) picks the backbone. Middle traits use mid-tier words and must not name a side.
- **Legend.** Slots for title, one line per matched moment (the moment text stays the museum's), meeting scene, differ line, closing. The ending keys off the differ trait as well as the match.
- **Story.** Leave v3 as the runtime until a v3 backbone is expressed in this schema. New topics get authored here only after the filler replaces `expandGrammar`, not before.
- **Play.** Optional later. Kind `play`. Pet-knows-you lines become phrase entries keyed by axis and tier, still capped at 10 words and 48 characters.

## Version

`StoryLibrary.version` is `storylib-0` in the sample. Ship it the way `LIBRARY_VERSION` works today: a phone asks for a version, and a newer grammar does not render an older template. Bump it when a frame or a card shape changes, not when one adjective is added. Adding an approved entry inside a frame does not bump the version. Changing what `{verb}` is allowed to mean does.
