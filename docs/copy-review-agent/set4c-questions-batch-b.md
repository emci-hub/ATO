# Set 4c questions, batch B (22 non-intake questions x 6 traits = 132)

Traits: locus_of_control, openness, playfulness, relatedness, self_efficacy, steadiness
(the 12 trait files minus the 4 excluded and minus the first 6 alphabetical: agreeableness, autonomy, competence, conscientiousness, extraversion, growth_mindset).

## Summary
- 132 reviewed; 26 FIX (see table), 0 REMOVE, rest OK. Meaning and trait direction (score values) kept in every replacement; only the text changes.
- Main themes: clinical-adjacent body/anxiety words in steadiness (panic, heart racing, sick), self-blame/absolutes in locus_of_control and self_efficacy ("I'll never finish it", "Too late for me"), slang (situationship, vibe, keep it real), and a few options that measure something else (workload, money, dismissing a partner).
- Systemic, not listed below: every apostrophe in the bank is a straight one (') and the brief asks for curly. If the UI does not convert them, do one global pass in the data (not per-question).
- Minor contraction slips folded into one row below (we will / what is up).
- Near-duplicate scenes worth knowing (kept, different traits): locus_09 vs steadiness_08 (date slow to text back); relatedness_25 vs relatedness_04 (fixed below); self_efficacy_25 vs _02/_12 (tech/home fix-it, kept); playfulness_11 vs _15 (serious message, funny reply, kept).

## FIX / REMOVE
Format: option text with score in brackets where options change. Unchanged options are not repeated.

| id | original | verdict | replacement | reason |
|---|---|---|---|---|
| locus_of_control_05 | "I go over what I did wrong" [0.8] | FIX | "I look at what I could have done better" | "did wrong" is guilt framing; same ownership meaning |
| locus_of_control_06 | "They must have liked my vibe" [0.2]; "I prepped hard for it" [0.8] vs "Prep and a good day" [0.5] | FIX | [0.8] "I earned it with prep"; [0.5] "Prep and a good day"; [0.2] "They just happened to like me" | slang "vibe"; 0.8 and 0.5 were near-identical |
| locus_of_control_10 | "I ask what is up" [0.5] | FIX | "I ask what's up" | contraction; (the 0.8 option also overlaps anxious worry, so keep it light) |
| locus_of_control_15 | "I should have checked the link" [0.8] | FIX | "I'll check links more carefully now" | victim-blaming / shame about being scammed; keeps the ownership direction |
| locus_of_control_22 | "I should have reminded her" [0.8] | FIX | "I could have mentioned it earlier" | self-blame for someone else forgetting; softer, same direction |
| locus_of_control_24 | "The sign was hard to see" [0.5]; "The city is out to get me" [0.2] | FIX | [0.5] "The sign was hard to see, and I rushed"; [0.2] "Parking rules are a trap" | 0.5 option was a pure external excuse (sat at the wrong point); "out to get me" is paranoid-sounding |
| openness_07 | "Your situationship wants to do the exact same thing every weekend." | FIX | "Your partner wants to do the exact same thing every weekend." | slang; dating tag still fits |
| openness_18 | "I suggest somewhere new to all of us" [0.8] | FIX | "I suggest somewhere new" | grammar |
| openness_21 | "Guilty. I'll open more" [0.8] | FIX | "Yep, and I keep opening more" | "Guilty" is a shame frame |
| openness_24 | "Can we stick to the plan" [0.2] | FIX | "Can we stick to the plan?" | missing question mark |
| playfulness_07 | "I listen and keep it real" [0.2] | FIX | "I listen and stay serious" | slang |
| playfulness_21 | "Your partner is upset and wants to talk seriously." [options: "I try to make them laugh first" 0.8 / "I listen, then lighten it" 0.5 / "I stay serious with them" 0.2] | FIX | Scenario: "Your partner is grumpy about something small." Options unchanged | as written, 0.8 rewards joking over someone who asked to talk; reads as dismissive and invites shame |
| relatedness_08 | "We will catch up soon" [0.5] | FIX | "We'll catch up soon" | contraction (voice is contracted elsewhere) |
| relatedness_25 | "Your desk at the office gets moved to a quiet corner alone." | FIX | Scenario: "Your coworkers invite you to eat lunch together." Options: "I join them every day" [0.8]; "A few times a week" [0.5]; "I like my own break" [0.2] | near-duplicate of relatedness_04 (alone at work, miss people) |
| self_efficacy_04 | "I'm already stretched" [0.2] (and "Yes, I can fit it in" [0.8]) | FIX | [0.8] "Yes, I can handle it"; [0.5] "Maybe, if I can move things"; [0.2] "I don't think I could" | options measure workload, not belief in yourself |
| self_efficacy_10 | "We should hire movers" [0.2]; "I can run the whole move" [0.8] | FIX | [0.8] "I can organize the whole move"; [0.5] "I can handle a few rooms"; [0.2] "It's too big for me" | hiring movers is a sensible money choice, not low confidence |
| self_efficacy_13 | "I'll never finish it" [0.2] | FIX | "I probably wouldn't finish it" | absolute ("never") and self-judging; hedged |
| self_efficacy_18 | "A friend in a crisis calls and asks you to drop everything." | FIX | "A friend is having a rough night and calls you." | "crisis" is a sensitive word given the helpline-only policy; options still fit |
| self_efficacy_23 | "Too late for me" [0.2] | FIX | "I doubt I could learn now" | age-shaming absolute; same low-belief meaning |
| steadiness_09 | "Your partner is upset about something, and you think it's small." / "I stay calm, it'll pass" [0.8] | FIX | Scenario: "Your partner is upset about something small." [0.8] "I stay calm and listen"; [0.5] "I feel a bit of it too"; [0.2] "I get upset too" | original rewards brushing off a partner; leading |
| steadiness_11 | "I assume the worst" [0.2] | FIX | "I worry something's wrong" | "assume the worst" is catastrophizing language |
| steadiness_12 | "That never happens to me" [0.8] | FIX | "I shrug and fall asleep" | not a reaction; and mismatched with the scenario |
| steadiness_15 | "Full panic mode" [0.2] | FIX | "I start stressing hard" | "panic" reads clinical |
| steadiness_16 | "I feel sick about it all week" [0.2] | FIX | "It weighs on me all week" | symptom-style wording |
| steadiness_18 | "My heart is racing" [0.2] | FIX | "I get really tense" | physical anxiety symptom |

## Spot-check OK (8)
- locus_of_control_20 (friend says you never make plans): all three options fair, no shame.
- openness_10 (free night, streaming app): clean, three even steps.
- playfulness_16 (split the dinner bill): light, even scale.
- playfulness_22 (nephew pretends): good scene; "I become a dragon" is on voice.
- relatedness_13 (chatty train neighbor): low pole ("headphones in right away") is neutral, not bad.
- self_efficacy_20 (karaoke mic): kind to all three, readable.
- steadiness_13 (spilled coffee): clear, no clinical words, even steps.
- steadiness_25 (harsh feedback): plain, no shame, good gradient from "move on" to "replay for a week".
