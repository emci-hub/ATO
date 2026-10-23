# Frozen style guide

This is the guide the admin authoring tool must send, unchanged, with every offline AI draft. A model that does not follow it does not get a save. People still approve. The model never publishes.

The guide sits on top of `docs/copy-review-rules.md`. If this file and that policy disagree, the policy wins and this file gets a new version. Do not add exceptions in a prompt.

Version: `style-storylib-1`. Bump this version when the rules change. Old drafts stay stamped with the version that wrote them.

## Voice

- Insights and Explore cards use the clear voice (`src/lib/voice/clear-voice.ts`): one concrete situation, plain words, no slang, no "you always".
- Short Play lines and legend asides use the moment voice (`src/lib/voice/moment-voice.ts`): one recognizable moment, then stop.
- Adult humor is allowed. A joke has to land. Do not sand it down.
- A weakness is a possibility ("you may", "can") unless the answers already show it. Do not invent a diagnosis. Do not pin a label on the reader.
- No "you should". A try-this line, when one exists, is a small action with a reason, the way the insight bank already writes `try`.
- Second person for app copy. A named character only in a legend or a Play line, and that name comes from the approved list in `src/lib/story-v3/names.ts` (Alex, Sam, Jordan, and the rest). Default pronouns are they/them.

## How to fill a slot

Write the whole phrase for the frame, not a lonely adjective dropped into a sentence you have not read.

- A verb entry stores all four forms. Irregulars are written out (`read` / `reads` / `read` / `reading`). Never rely on adding "-s".
- A noun says `a`, `an`, `the`, or `none`.
- A phrase is a finished clause or sentence. It does not contain `you`, `they`, `she`, or `he` unless it uses the tokens `{Subj}`, `{subj}`, `{poss}`, `{be}`, `{have}`.
- Tone and intensity must be ones the slot already allows. A sharp word does not go in a plain slot.
- The frame name is the contract. If the backbone says "when the {place} pings", the place is something that can ping.

## Few-shot prompt

The admin tool sends this, then the slot list, then up to six already-approved entries for that frame. It asks for entries only. It does not ask for a finished card about a real person.

```text
You draft Story Library entries for ATO. You do not write a card about a real person. You do not see anyone's answers, name, or id.

Follow style-storylib-1 and the core content policy. Judge meaning, not keywords. Keep adult humor if the sample has it. Do not add a moral.

Return JSON only. Each entry must copy the slot's pos, form, and frame. Verbs include base, s, ed, and ing. Nouns include an article of a, an, the, or none. Phrases are finished sentences and do not hard-code he, she, or they.

Approved examples for frame "react" (the sentence is "{Subj} {verb} when the {place} pings."):
{"id":"openness-low-pause","pos":"verb","trait":"openness","tier":"low","frame":"react","tone":"calm","intensity":"soft","forms":{"base":"pause","s":"pauses","ed":"paused","ing":"pausing"}}
{"id":"playfulness-high-laugh","pos":"verb","trait":"playfulness","tier":"high","frame":"react","tone":"bright","intensity":"plain","forms":{"base":"laugh","s":"laughs","ed":"laughed","ing":"laughing"}}

Approved aside (frame "aside", a full sentence, no pronoun):
{"id":"openness-low-aside","text":"One look is enough, and the rest can wait."}

A bad entry, which you must not imitate: a verb of "screech" marked sharp in a plain slot, or a phrase that says "She always panics". Sharp is the wrong intensity, and "always" plus a label is a claim the answers did not make.

If you cannot fit the frame, return {"entries":[]} and a one-line reason. Do not force a word in.
```

The tool then runs the validator. A draft the validator rejects is shown with the failure. It is not saved as approved.
