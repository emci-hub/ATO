# Set 4b questions, batch A

Traits reviewed (first 6 alphabetical, minus the 4 excluded; define.ts and index.ts are not traits): agreeableness, autonomy, competence, conscientiousness, extraversion, growth_mindset. 22 non-intake questions each (ids 04 to 25), 132 total.

## Summary
- 112 OK, 20 FIX, 0 REMOVE. No clinical or diagnosis words, no shame framing, no double-barrelled questions found. Scale fit is good.
- Biggest theme: alcohol and bar scenes in a 16+ app (extraversion_06, 07, 22). Replaced with food, party and waiter.
- Second theme: "will / has been" without contractions in conscientiousness (07, 08, 14) while the rest of the bank contracts. Also stems that contradict their own options (conscientiousness_11, extraversion_13).
- Near-duplicate scenes, kept but worth knowing: "first try in an app fails" (growth_mindset_15, 16, 24, 25); friend late/owes money (agreeableness_07, 16, conscientiousness_07, 21); sibling borrows an item (agreeableness_11, conscientiousness_25); stranger service moments (agreeableness_03, 12, 23).
- Global: every string in these 6 files uses straight apostrophes and quotes (' and "). If house style is curly, do one scripted bulk conversion in the bank files, not per-item edits.

## FIX / REMOVE
Replacements keep the same option order and the same trait direction (0.2 / 0.5 / 0.8 stay on the same meaning). Only text that changes is shown.

| id | original | verdict | replacement | reason |
|---|---|---|---|---|
| agreeableness_18 | opt "I tell them not to" | FIX | "I tell them not to talk to me like that" | "not to" has no object; unclear |
| autonomy_24 | "A coworker offers to set up your retirement plan for you." opts "I take their advice" / "I'd rather learn it" / "Yes, please do it" | FIX | "A friend offers to set up your new phone for you." opts "Sure, but I watch how" (0.5) / "I'd rather learn it" (0.8) / "Yes, please do it" (0.2) | Retirement plan is off for a 16+ audience; also a third money scene next to autonomy_15 and 16 |
| competence_08 | "Your date scrolls your photos and says you have real talent." | FIX | "Your date sees your art on your phone and says you have real talent." | "Talent" at what? Options assume a skill |
| competence_15 | opt "I use an app and hope" | FIX | "I follow the steps and double-check" (0.5) | The stem already files in an app, so the option repeats it; "hope" is vague |
| competence_18 | "The day before your exam, the class changes the topic." | FIX | "The day before your exam, the teacher swaps half the topics." | "The class changes the topic" is awkward and unclear |
| conscientiousness_07 | opt "They will ask if it matters" | FIX | "They'll ask if it matters" | Contraction, matches the bank voice |
| conscientiousness_08 | "We will just text and see" / "It has been booked since Monday" | FIX | "We'll just text and see" / "It's been booked since Monday" | Contractions |
| conscientiousness_11 | "Packing for a family trip the night before the flight." opts incl. "I packed two days ago" | FIX | "Your family trip flies out tomorrow morning." | Stem says it is the night before, but one option says packed two days ago; also a fragment |
| conscientiousness_14 | "...a voice note you haven't listened to yet. It has been a week." | FIX | "...a voice note you haven't listened to yet. It's been a week." | Contraction |
| conscientiousness_15 | "Your phone home screen right now." | FIX | "Think about your phone's home screen right now." | Fragment, not a question or scene |
| conscientiousness_23 | "A friend sends a payment request for concert tickets." opts "I pay when they remind me" / "Paid by the weekend" / "Paid within the hour" | FIX | "A form you need to sign sits in your inbox, due next week." opts "I do it when someone reminds me" (0.2) / "I do it before the weekend" (0.5) / "I do it within the hour" (0.8) | Near-duplicate of conscientiousness_07 (paying a friend); same trait signal, fresh scene |
| conscientiousness_24 | "It's your turn to remember the anniversary dinner booking." | FIX | "It's your turn to book the anniversary dinner." | Awkward wording |
| extraversion_06 | "First day at a new job, and there's an after-work drinks thing." opts "I go for one drink" / "I'm there and staying late" / "I skip the first one" | FIX | "First day at a new job, and the team is getting food after work." opts "I go for a bit" (0.5) / "I'm there and staying late" (0.8) / "I skip the first one" (0.2) | Alcohol scene in a 16+ app |
| extraversion_07 | opt "A busy bar with friends of friends" | FIX | "A busy party with friends of friends" (0.8) | Bar, age fit |
| extraversion_10 | "Your mom puts you on speaker with the whole family at dinner." | FIX | "Your mom calls during family dinner and puts you on speaker." | Original is confusing: if you are at dinner, why speaker |
| extraversion_13 | opt "I post rarely, so no" | FIX | "I like a few and move on" (0.2) | Contradicts the stem (the story did get replies) |
| extraversion_17 | "Your bank app shows how much went on going out this month." | FIX | "Your bank app shows how much you spent going out this month." | Awkward grammar |
| extraversion_19 | opt "I cancel on myself" | FIX | "I'd rather stay in" (0.2) | Unclear idiom |
| extraversion_22 | "On a first date, the bartender starts chatting with you both." | FIX | "On a first date, the waiter starts chatting with you both." | Bar, age fit |
| growth_mindset_14 | opt "I adjust and push harder" | FIX | "I adjust the plan and keep going" (0.8) | "Push harder" nudges toward overdoing it in fitness; same direction |

## 8 spot-check OK items
- agreeableness_10 (relative's unfair comment): clear, three even options, no leading.
- autonomy_09 (date orders for both): single idea, options span the scale, polite tone.
- competence_10 (fix parents' phone): short, plain, scale fits.
- conscientiousness_16 (subscription renews): concrete, three clean steps.
- extraversion_09 (big family birthday): warm joke, no judgment of the quiet pole.
- extraversion_21 (plans canceled): kind to both poles ("Secretly thrilled" is fine).
- growth_mindset_05 (bad first exam): plain, no shame, middle option realistic.
- growth_mindset_20 (friend beats you at a game): gentle, "rematch" is a good 0.5.
