# Frozen style guide

Player-facing wording follows `docs/voice-guide.md`. This file is the slot contract on top of that guide. The admin draft prompt loads the voice guide, then these slot rules.

This is the guide the admin authoring tool must send, unchanged, with every offline AI draft. A model that does not follow it does not get a save. People still approve. The model never publishes.

The guide sits on top of `docs/copy-review-rules.md`. If this file and that policy disagree, the policy wins and this file gets a new version. Do not add exceptions in a prompt.

Version: `style-storylib-4`. Bump this version when the rules change. Old drafts stay stamped with the version that wrote them.

## Voice

- Insights and Explore cards use the clear voice (`src/lib/voice/clear-voice.ts`): one concrete situation, plain words, no slang, no "you always".
- Short Play lines and legend asides use the moment voice (`src/lib/voice/moment-voice.ts`): one recognizable moment, then stop.
- Adult humor is allowed. A joke has to land. Do not sand it down.
- A weakness is a possibility ("you may", "can") unless the answers already show it. Do not invent a diagnosis. Do not pin a label on the reader.
- No "you should". A try-this line, when one exists, is a small action with a reason, the way the insight bank already writes `try`.
- Second person for app copy. A named character only in a legend or a Play line, and that name comes from the approved list in `src/lib/story-v3/names.ts` (Alex, Sam, Jordan, and the rest). Default pronouns are they/them.

## Whole lines

A Story Library entry is one finished sentence. Do not assemble a verb, an aside, and a closer. Do not fill an "[adjective] [noun]" bank.

- Tokens are only `{Subj}`, `{subj}`, `{Name}`, `{legend}`, `{deed}`, and `{answer}`. `{answer}` is the player's own chosen answer, quoted. `{deed}` is a short sourced clause about what the legend did. A legend line has to mention that real deed. Do not invent a symbol (ticket, specials board, kettle, loud option, fork, bag, chair, costume) to stand in for a trait.
- Every line has a flip: what the opposite pole would actually do. The flip is not shown. The check requires it.
- Every line has a priority and eligibility (trait pole, confidence tier, a specific answer, a legend, recency). The highest-priority eligible line wins. A broad fallback stays available.
- Shown line ids are remembered per player. A line does not repeat until every eligible line has been used.
- Tag questions like ", right?" stay at or under about 1 in 10 lines. Each sentence shape appears at most once on a card. Each trait's scene object stays in that trait's world, at most once on a card.

## Few-shot prompt

The admin tool sends this, then up to six already-approved lines for that slot. It asks for lines only. It does not ask for a finished card about a real person.

```text
You draft Story Library lines for ATO. You do not write a card about a real person. You do not see anyone's answers, name, or id.

Follow docs/voice-guide.md, style-storylib-4, and the core content policy. Judge meaning, not keywords. Keep adult humor if the sample has it. Do not add a moral.

Return JSON only. Each entry is one finished sentence. Tokens are {Subj}, {subj}, {Name}, {legend}, {deed}, and {answer}. Include flip, priority, and the eligibility conditions.

Approved line:
{"id":"openness-high-shows-when","slot":"shows","trait":"openness","tier":"high","priority":30,"text":"{Subj} had the listing open when the group chat was still stuck on the safe plan.","flip":"The usual dish was already the plan, and a new listing would have been a hassle."}

A bad line, which you must not imitate: "The untried option gets the first look." or "She always panics."

If you cannot write the whole line, return {"entries":[]} and a one-line reason. Do not force a word in.
```

The tool then runs the validator. A draft the validator rejects is shown with the failure. It is not saved as approved.
