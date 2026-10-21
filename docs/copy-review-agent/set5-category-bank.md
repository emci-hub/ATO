# Set 5: Explore category card bank review

Source: `docs/category-bank-review.md` (read in full; wordings match the review doc, source files not edited).

## Summary
1. Bank is in good shape: curly apostrophes everywhere in source, no clinical words, no "always", no banned phrases, no "you are" labels. Mechanical rules not re-run; run `check:category-bank` after any edit.
2. Biggest issue: a few LOW cells lean on deficit words (hard, doubt, unsure, heavy) that the HIGH cells never use. Fixes below reword them in everyday sensation words.
3. Two Communication-high lines reuse approved examples from `clear-voice.ts` almost verbatim (rule: match, never reuse).
4. Near-duplicate tries across cells (Resilience mid/low Try 1; Drive low / Independence ll Try 1) and a few idioms (keep your cool, anchor, fire you up, your gut).
5. Bundle: `category-bank` is referenced 14 times in `supabase/functions/_shared/ai-library.bundle.js`, so ANY accepted fix needs `npm run gen:ai-library` + `supabase functions deploy ai-library` (`check:ai-library` fails on a stale bundle). Batch all fixes into one regen. 0 REMOVE verdicts.

## FIX table

| id / cell | original | verdict | replacement | reason |
|---|---|---|---|---|
| cat_resilience low / Summary 3 | You tend to find stressful times hard and need extra time to recover. | FIX | You tend to feel stressful stretches strongly, and you usually take a little longer to settle afterward. | "find hard / need extra" reads as a deficit; high version says "handle well" |
| cat_resilience low / Summary 2 | When something goes wrong, you usually feel it deeply and doubt yourself afterward. | FIX | When something goes wrong, you usually feel it deeply and replay it for a while afterward. | "doubt yourself" is a shame framing as a default |
| cat_resilience low / Watch-out 3 | Sometimes your doubt after a mistake lasts longer than the mistake does. | FIX | Sometimes a mistake stays on your mind long after everyone else has moved on. | Same; avoids "doubt" and the quiet judgment |
| cat_resilience low / Try 1 | Write down one hard thing you got through before, so you remember you can do it. | FIX | Write down one rough week you got through before, so you have proof of how you handled it. | Near-duplicate of mid Try 1 ("one setback you got through...remember you can do it") |
| cat_agency low / Summary 3 | You tend to feel unsure about taking on hard things, and you're happy with what you know. | FIX | You tend to stick with what you know well, and you take on new challenges when they feel worth it. | Opens with "unsure" and "hard things"; reads as a deficit |
| cat_drive low / Watch-out 3 | Sometimes you doubt you can do something you'd actually do well. | FIX | Sometimes you wait to feel fully ready for something you'd probably do well. | "doubt" framing; sensation-style wording |
| cat_drive low / Try 1 + cat_independence ll / Try 1 | Set one small goal for yourself this week, so you get to choose the direction. / ...so you choose the direction. | FIX | Drive low Try 1 keep; Independence ll Try 1 becomes: Choose one small thing to do on your own this week, so the plan is yours. | Same try twice across cells |
| cat_levity low / Summary 3 | You tend to handle hard moments quietly and without humor. | FIX | You tend to handle tense moments quietly, with your focus on the person in front of you. | "without humor" defines low by absence |
| cat_levity low / Watch-out 1 | Sometimes tense moments feel heavier for you than they need to. | FIX | Sometimes a tense moment stays with you more than it seems to stay with others. | "than they need to" is judgmental |
| cat_communication high / Strength 1 | When you disagree with someone, you usually focus on fixing the problem together. | FIX | When you and a friend disagree, you usually keep the talk about the problem, not the person. | Near-copy of approved example in `clear-voice.ts` |
| cat_communication high / Watch-out 1 | Sometimes you jump to fixing it before the other person has had their say. | FIX | Sometimes you offer a solution while the other person is still explaining how they feel. | Near-copy of approved example ("jump to fixing it before ... feels heard") |
| cat_steadiness high / Strength 1 | When plans get messy, you usually keep your cool and get things back on track. | FIX | When plans get messy, you usually stay calm and sort out what needs to happen next. | Idiom ("keep your cool") |
| cat_steadiness mid / Try 1 | Pick one small routine to keep this week no matter what, so busy days have an anchor. | FIX | Pick one small routine to keep this week, so busy days still have one steady part. | Metaphor ("anchor") |
| cat_steadiness low / Strength 3 | You can switch plans quickly when your gut tells you something's off. | FIX | You can switch plans quickly when something feels off to you. | Idiom ("your gut") |
| cat_steadiness high / Summary 3 | You tend to be the steady one your friends and coworkers can count on day to day. | FIX | Your friends and coworkers can usually count on you to stay steady from day to day. | "the steady one" is a label |
| cat_drive mid / Summary 1 | ...some things fire you up and others feel like a chore. | FIX | ...some things get you excited and others feel like a chore. | Idiom ("fire you up") |
| cat_openness low / Watch-out 2 | Because you like the familiar, friends might stop inviting you to new things. | FIX | Because you like the familiar, friends might not think to include you in new plans. | "stop inviting" is a warning/prediction and a mild shame hit; Watch rule says no warnings |
| cat_social low / Try 1 | Smile and say hi to one new person this week, so they see your friendly side. | FIX | Say hi to one new person this week, so you get a first hello out of the way. | Implies low side is not friendly; also nudges toward extroversion |
| cat_social low / Try 3 | Send a friend a funny message today, so they see your lighter side. | FIX | Send a friend a funny message today, so they get a small smile from you. | "lighter side" implies low side lacks one |
| cat_love hl / Watch-out 3 | Sometimes you reach out to calm a worry rather than to connect. | FIX | Sometimes you reach out because a quiet stretch feels uncomfortable, and the message says more than you meant. | Sensitive category; "rather than to connect" judges the motive |
| cat_love hh / Summary 2 | When a relationship matters, you usually worry about it and also need your space. | FIX | When a relationship matters to you, you usually think about it a lot and also like having your own space. | "worry" as default, Love is sensitive; keep it neutral |
| cat_independence hl / Watch-out 3 | Sometimes you handle hard things alone when help was there for you. | FIX | Sometimes you handle a hard thing alone even though someone nearby would gladly help. | Awkward phrasing ("help was there for you") |
| cat_independence ll / Watch-out 3 | Sometimes your friendships fade because nobody reaches out. | FIX | Sometimes weeks go by with a friend before either of you reaches out. | Warning/prediction; "fade" is a loaded outcome |
| cat_independence ll / Strength 1 | You tend to be low-drama and easy to work with. | FIX | You tend to keep things calm and easy to work with. | "low-drama" is slang |

## 8 spot-check OK items
- cat_steadiness high / Watch-out 1 and Try 2 (kind, clear who is involved, reason on the try).
- cat_openness mid / all Strengths (balanced, nothing deficit).
- cat_agency high / Watch-out 1 ("blame yourself" is a real, gentle flip side).
- cat_social mid / Strength 3 ("know when to be social and when to recharge", equally kind to both poles).
- cat_communication low / Strength 1-3 (low framed as calm and thoughtful).
- cat_love lh / Strength 1 and Watch-out 2 (no jealousy shaming; "might read it as you not caring" is plain and kind).
- cat_love ll / Try 1-3 (self-aware, aimed at the other person's pace).
- cat_structure ll / Strength 2 and Try 3 (ok, easygoing treated as valid; try has a reason).

## Notes
- Overall HIGH vs LOW kindness: Steadiness, Openness, Social, Structure, Communication read evenly. Resilience low, Agency low, Drive low and Levity low are the lopsided ones (all addressed above).
- After accepting fixes: update the matching lines in `src/lib/category-bank/<id>.ts`, then `npm run gen:ai-library`, deploy `ai-library`, run `check:category-bank`. If copy changes shape/meaning, consider bumping `LIBRARY_VERSION` (CLAUDE.md rule applies to prompt/card shape changes only, so likely not needed).
