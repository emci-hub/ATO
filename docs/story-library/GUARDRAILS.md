# Guardrails

The owner's worry is the right one. A template plus a word can be grammatical and still be nonsense, and a model that keeps adding lines will drift. Four gates sit in front of that. All four run at authoring time. None of them run as a model call on the phone.

## 1. The slot only accepts a word written for it

`compatible` in `prototype/fill.ts` requires all of these:

- same part of speech
- same frame
- tone in the slot's list
- intensity in the slot's list, when the slot has one
- verb: the form the pronoun needs is stored and non-empty
- noun: singular or plural matches, and an `auto` slot has an article

A noun cannot fill a verb slot. The test asserts `openness-high-tab` is not compatible with the verb slot. The sharp decoy `openness-high-screech` matches trait, tier, and frame, and is still refused because the slot is soft/plain only.

This stops the worst drift: a later author, human or model, cannot drop "screech" into a calm line by putting it on the right trait. They would have to change the slot's intensity, which is a template edit, which re-runs the matrix.

## 2. The validator, on every save and in CI

`npx tsx docs/story-library/prototype/render-matrix.ts`

It renders every approved template against:

- 3 traits × 3 tiers × 4 pronouns (`you`, `they`, `she`, `he`)
- and, for `legend-detour`, every secondary trait and tier as well

That is 360 strings today. It fails the process if any render has:

| Check | Code | What it catches |
|---|---|---|
| Empty pool | `empty-slot` | A trait/tier/frame with no entry and no generic |
| No fallback ending | `missing-ending` | `{ending}` with nothing that matches |
| Leftover braces | `leftover` | `{slot}` or a typo token still in the text |
| Banned text | `banned` | `TODO`, `lorem`, `undefined`, `null`, `narcissist`, "you are clearly", "you're so toxic" |
| Article | `article` | "a" before a vowel, "an" before a consonant, a doubled article |
| Agreement | `agreement` | she/he with a base verb, you/they with an -s verb, or the wrong be/have |
| Approval | `unapproved` | A draft template or entry included in a shipping render |

It also checks, outside the matrix:

- every verb entry has base, -s, -ed, and -ing
- a draft template cannot ship
- avoiding the only trait verb falls back to `generic-stop`, and that line still passes
- openness high + playfulness high selects `open-play-high`
- steadiness mid selects the fallback `enough`
- the locked noun stays one entry, with the article only on the first use
- she + openness high uses "dives" and "has"

The banned list is mechanical leftovers and a few pinned-label phrases. It is not a topic ban. `docs/copy-review-rules.md` still judges meaning. The matrix does not try to guess whether a joke is fair.

What the matrix does **not** prove: that the line is good. "She dives before anyone else speaks" is grammatical and on-trait, and it is a thinner sentence than the insight-bank lines. Someone still reads `sample-output.md` from top to bottom before a version is approved. That read is the same job as the existing copy-review docs.

When the real library exists, CI should run this against every approved template and every trait that template claims to support, not only the three in the sample. Sixteen traits times three tiers times four pronouns times a handful of backbones is a few thousand short strings. That is a file, not a problem. Combo endings are rendered when both traits are in the test set. You do not render a full 16 × 16 grid unless a combo ending exists for that pair.

## 3. Offline AI review, optional, authoring only

After the validator is green, an admin may press a review button. It sends:

- the frozen prompt in [STYLE.md](STYLE.md) (`style-storylib-4`), on top of `docs/voice-guide.md`
- the backbone
- up to six approved entries for that frame
- a sample of the matrix, not a person's profile

It may return notes or proposed entries. It may not set `approved`, and it may not write a card into `library_add_cards`. If the vendor call fails, the draft is unchanged.

This replaces the current drift loop (the cron writes a card, the card validator checks that one card, the next person reads it) with a loop that never touches the runtime.

## 4. Version and approval

Statuses on every template and every entry:

| Status | Meaning |
|---|---|
| `draft` | Saved. Not in the shipping set. The validator may already be red. |
| `validated` | The matrix is green for this version of the library. |
| `approved` | An admin said yes after the green matrix. This is the only status the phone can load. |

A save in the admin tool runs the validator before status can leave `draft`. CI runs the same script and fails the build if approved content does not match a green matrix. The prototype's shipping renders pass `requireApproved: true`.

`storylib-0` is the grammar version, same idea as `LIBRARY_VERSION` on the AI cards. Bump it when a frame or a card shape changes. Adding an approved synonym inside a frame does not bump it. Old phones keep rendering the grammar they shipped with.

Nothing goes live because a model liked it. The path is: draft → validator green → human approval → CI green on the merge → the phone's bundle. The cron does not get a vote.

## Why this does not drift the way the card library does

The live library stores finished paragraphs. Two cards in one bucket can contradict each other, and the only check is the per-card parser (`checkLibraryAnswer`). There is no render of "this adjective in that sentence for every pronoun".

The Story Library stores pieces that have already been crossed with every backbone that can hold them. A new piece that does not fit is rejected at save time, in the tool, in front of the admin. The phone cannot invent a fifth combination. It can only pick among combinations the matrix already printed.
