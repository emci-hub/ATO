# Intake sweep + IQ fallback copy — DRAFT for emci review

**Status: UNREVIEWED.** Same discipline as crisis card copy. `INTAKE_SWEEP_COPY_REVIEWED` is `false` until this set is signed off. Do not treat this as shipped-final.

This is the 15-item Infinite Questions fallback bank. Offline / Gemini-unreachable uses it. The one-page intake (Part 5) pulls from full-sweep mode, which now always serves straight from this bank (no model call). Structured MC only (2–3 options). Single-axis. `self_situation`. No true/false type. No free text.

The first six items were already live as the locked few-shot / fallback set. They are listed again so the full intake set is in one place. New items are marked **NEW**.

Tone target: plain language, a few seconds to read, no jargon, no framework names, no diagnosis.

---

## openness *(existing)*
Your Do today was writing down one thing you're walking into. Was today's version the safe pick or the different one?
- The different one, easily (0.8)
- Somewhere in between (0.5)
- The safe, familiar one (0.2)

## conscientiousness **NEW**
A plan you made last week hits a boring stretch today.
- I still see it through (0.8)
- I keep it if it stays easy (0.5)
- I switch to whatever feels better (0.2)

## extraversion **NEW**
Saturday afternoon, nobody has plans yet.
- I'd rather text a few people and make something happen (0.8)
- Either way, I'm fine (0.5)
- I'd rather keep the time quiet (0.2)

## agreeableness **NEW**
A group chat is picking a place you don't really like.
- I go along, it's not worth a fuss (0.8)
- I mention it once, then let it go (0.5)
- I say I'd rather go somewhere else (0.2)

## steadiness **NEW**
A small thing goes wrong first thing in the morning.
- I'm mostly over it by lunch (0.8)
- It sits with me a bit, then fades (0.5)
- It colors the rest of the day (0.2)

## attachment_anxiety **NEW**
Someone you like takes a while to reply.
- I start wondering if they're pulling away (0.8)
- I notice, then I get on with my day (0.5)
- I don't think much of it (0.2)

## attachment_avoidance *(existing)*
Someone close to you wants to talk something out in person instead of over text.
- Sure, that's fine when it matters (0.2)
- I'd rather keep it lighter, over text (0.8)

## conflict_assertiveness **NEW**
You disagree with someone in the room.
- I say so, even if it gets a little sharp (0.8)
- I wait to see if it blows over (0.5)
- I let it go rather than push (0.2)

## conflict_cooperativeness *(existing)*
When you and someone else both want different things with no obvious middle ground, who usually gives first?
- Probably me (0.8)
- Depends who cares more (0.5)
- Rarely me (0.2)

## autonomy **NEW**
Someone hands you a plan that would work fine.
- I'd still rather do it my way (0.8)
- I'll use theirs if it saves time (0.5)
- I'm glad I don't have to figure it out (0.2)

## competence **NEW**
A hard task lands on your plate.
- I feel like I can handle it (0.8)
- Depends how hard, honestly (0.5)
- I doubt I can pull it off (0.2)

## relatedness *(existing)*
A friend cancels same-day, no real reason given.
- I'd want to talk it through (0.8)
- I'd let it go, check in eventually (0.2)

## growth_mindset *(existing)*
You try something new and it goes badly the first time. What actually happens next?
- I look at what I'd do differently (0.8)
- I probably don't try that again (0.2)

## locus_of_control **NEW**
A plan you were in on falls apart.
- I look first at what I might have done differently (0.8)
- Some of it was me, some of it wasn't (0.5)
- It was bound to happen (0.2)

## self_efficacy *(existing)*
Everyone at the table already knows their order. You don't.
- I panic-order whatever's closest (0.2)
- Takes me a sec but I land on something (0.5)
- I ask what everyone else got (0.75)

---

## Gut-call second stems (Part 4) — also UNREVIEWED

Weekly Ask still uses the original six stems. Token-spend / standalone can use these when that axis already has a reading.

- **locus_of_control** — The thing you were counting on does not happen. / What could I have set up differently / That's just how it goes sometimes
- **growth_mindset** — You flub a thing you thought you were decent at. / Okay, what would I change next time / Maybe that just isn't my thing
- **self_efficacy** — A bigger-than-usual ask lands in your lap. / I can figure this out / Not sure I'm the one for this
- **autonomy** — A friend offers to plan the whole day for you. / I'd rather pick it myself / Sure, save me the deciding
- **competence** — Someone asks you to take the hard part of a shared job. / Yeah, I can take that / I'd rather they keep it
- **relatedness** — A quiet evening, phone in the other room. / I'd rather have someone to check in with / Quiet on my own is enough
