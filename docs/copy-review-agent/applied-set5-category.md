# Set 5 applied: Explore category card bank

1. 25 flagged items re-judged: 12 FIX (applied in source), 13 KEEP, 0 UNRESOLVED. Plus 1 extra clear-win fix from the bank pass (drive mid "coast").
2. Old reviewer softenings that swapped a plain limitation for a gentler word were rejected (doubt, find hard, unsure, without humor, worry); only idioms, near-copies of approved examples, a duplicate try, slang and awkward grammar were fixed.
3. `check:category-bank` 7/7 pass, `typecheck` clean. Bank is in the ai-library bundle: lead must run `gen:ai-library` later (`check:ai-library` fails on the stale bundle until then).

## FIX

| key | action | final text | what it fixes |
|---|---|---|---|
| cat_resilience low / Try 1 | FIX | Write down one rough week you got through before, so you have proof you can get through another. | duplicate of mid Try 1 |
| cat_agency low / Summary 3 | FIX (wording only, "unsure about hard things" kept) | You tend to feel unsure about taking on hard things, and you're content with what you already know. | unnatural ("happy with what you know") |
| cat_independence ll / Try 1 | FIX | Choose one small thing to do on your own this week, so the plan is yours. | duplicate of drive low Try 1 |
| cat_independence ll / Strength 1 | FIX | You tend to keep things calm and easy to work with. | slang ("low-drama") |
| cat_independence hl / Watch-out 3 | FIX | Sometimes you handle a hard thing alone even though someone nearby could help. | awkward grammar |
| cat_communication high / Strength 1 | FIX | When you and a friend disagree, you usually keep the talk about the problem, not the person. | near-copy of approved example |
| cat_communication high / Watch-out 1 | FIX | Sometimes you offer a solution while the other person is still explaining how they feel. | near-copy of approved example |
| cat_steadiness high / Strength 1 | FIX | When plans get messy, you usually stay calm and sort out what needs to happen next. | idiom ("keep your cool") |
| cat_steadiness mid / Try 1 | FIX | Pick one small routine to keep this week no matter what, so busy days still have one steady part. | metaphor ("anchor") |
| cat_steadiness low / Strength 3 | FIX | You can switch plans quickly when something feels off to you. | idiom ("your gut") |
| cat_steadiness high / Summary 3 | FIX | Your friends and coworkers can usually count on you to stay steady from day to day. | label ("the steady one") |
| cat_drive mid / Summary 1 | FIX | Your drive tends to come and go with the task: some things get you excited and others feel like a chore. | idiom ("fire you up") |
| cat_drive mid / Summary 2 (bank pass) | FIX | You usually push hard for things you care about and put in less effort on things you don't. | idiom ("coast") |

## KEEP (honest limitation or already clear)

- cat_resilience low Summary 3 ("find stressful times hard and need extra time to recover"): plain, supported limitation.
- cat_resilience low Summary 2 ("doubt yourself afterward"): plain emotion, no shame label.
- cat_resilience low Watch-out 3 ("doubt after a mistake lasts longer"): same.
- cat_drive low Watch-out 3 ("you doubt you can do something you'd do well"): honest, hedged with "Sometimes".
- cat_drive low Try 1: kept (the duplicate was changed on the independence side).
- cat_levity low Summary 3 ("quietly and without humor"): plain description of the low pole.
- cat_levity low Watch-out 1 ("heavier ... than they need to"): same phrase already used in levity mid Strength 3; clear.
- cat_openness low Watch-out 2 ("friends might stop inviting you"): hedged with "might", real consequence.
- cat_social low Try 1 and Try 3 ("friendly side", "lighter side"): clear, consistent with Watch-out 1 (people may read quiet as cold).
- cat_love hl Watch-out 3 ("reach out to calm a worry rather than to connect"): honest, hedged.
- cat_love hh Summary 2 ("worry about it"): honest for the Watchful side.
- cat_independence ll Watch-out 3 ("friendships fade because nobody reaches out"): plain, hedged consequence.

## UNRESOLVED

None.
