# Frozen style guide

Player-facing wording follows `docs/voice-guide.md`. This file is the slot contract on top of that guide. The admin draft prompt loads the voice guide, then these slot rules.

This is the guide the admin authoring tool must send, unchanged, with every offline AI draft. A model that does not follow it does not get a save. People still approve. The model never publishes.

The guide sits on top of `docs/copy-review-rules.md`. If this file and that policy disagree, the policy wins and this file gets a new version. Do not add exceptions in a prompt.

Version: `style-storylib-6`. Bump this version when the rules change. Old drafts stay stamped with the version that wrote them.

## Voice

Meaning first (`docs/voice-guide.md`). Say what the line means. Do not invent the player's history.

- Insights and Explore cards use the clear voice (`src/lib/voice/clear-voice.ts`): plain words, no slang, no "you always". A scene is optional.
- The generation block in `src/lib/voice/moment-voice.ts` is the same policy. The export name is historical. A story may use a scene. A trait line should not.
- Adult humor is allowed when it does not weaken accuracy. Cut a joke that does.
- A weakness is a possibility ("you may", "can") unless the answers already show it. Do not invent a diagnosis. Do not pin a label on the reader.
- No "you should". A try-this line, when one exists, is a small action with a reason, the way the insight bank already writes `try`.
- Second person for app copy. A named character only in a legend or a Play line, and that name comes from the approved list in `src/lib/story-v3/names.ts` (Alex, Sam, Jordan, and the rest). Default pronouns are they/them.

## Whole lines

A Story Library entry is one finished sentence. Do not assemble a verb, an aside, and a closer. Do not fill an "[adjective] [noun]" bank.

- Tokens are only `{Subj}`, `{subj}`, `{Name}`, `{legend}`, `{deed}`, and `{answer}`. `{answer}` is the player's own chosen answer, quoted. `{deed}` is a short sourced clause about what the legend did. Put that fact on the match line once. Do not repeat it on the scene, the meaning, or a later match line. Do not use an object as a private code for a trait.
- A flip note is optional. It is not shown. It does not have to be a scene.
- Every line has a priority and eligibility (trait pole, confidence tier, a specific answer, a legend, recency). The highest-priority eligible line wins. A broad fallback stays available.
- Shown line ids are remembered per player. A line does not repeat until every eligible line has been used.
- Tag questions like ", right?" stay at or under about 1 in 10 lines. A sentence shape may repeat. Do not add a "when" only to change the shape. Vary the opening: one opener on more than about a third of a pool fails. A scene phrase is not required. A hypothetical hour opens with "Picture an hour with {legend}."

## Few-shot prompt

The admin tool sends this, then up to six already-approved lines for that slot. It asks for lines only. It does not ask for a finished card about a real person.

```text
You draft Story Library lines for ATO. You do not write a card about a real person. You do not see anyone's answers, name, or id.

Follow docs/voice-guide.md, style-storylib-6, and the core content policy. Judge meaning, not keywords. Humor is optional. Do not add a moral.

Return JSON only. Each entry is one finished sentence. Tokens are {Subj}, {subj}, {Name}, {legend}, {deed}, and {answer}. Include priority and the eligibility conditions. A flip note is optional.

Approved line:
{"id":"openness-high-shows-when","slot":"shows","trait":"openness","tier":"high","priority":30,"text":"{Subj} would rather try something new, even when other people stick with what they know.","flip":"Preferring a familiar option would not match this description."}

A bad line, which you must not imitate: "The untried option gets the first look." or "She always panics."

If you cannot write the whole line, return {"entries":[]} and a one-line reason. Do not force a word in.
```

The tool then runs the validator. A draft the validator rejects is shown with the failure. It is not saved as approved.
