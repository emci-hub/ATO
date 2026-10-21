# Applied: set 1 small sets (staged intake, polish, daily pick, teams)

- Re-judged every flagged item under docs/copy-review-rules.md: 23 FIX applied, 8 KEEP, 3 UNRESOLVED (daily-pick prompts blocked, see below).
- Fixes are clarity/duplicate/meaning only. No honest line was softened; the old reviewer's over-sanitizing picks (haircut verdict aside) were mostly rejected.
- teams.ts IS in the ai-library bundle (supabase/functions/_shared/ai-library.bundle.js): the lead must run `npm run gen:ai-library` and `scripts/gen-team-names-review.ts` (docs/team-names-review.md). `check:ai-library` fails now only on that stale bundle.

| key | action | final text | what it fixes |
|---|---|---|---|
| INTAKE_SET_PAYOFF_LINES[0] | FIX | Sixteen down. Every trait has a first lean now. | duplicate (same joke as polish SET_DONE set1) |
| INTAKE_SET_PAYOFF_LINES[1] | FIX | Thirty-two down. Every trait has two answers. One more set. | duplicate, unclear joke |
| INTAKE_SET_PAYOFF_LINES[2] | FIX | All 48. Every trait has three answers, and your full profile is open. | duplicate, unnatural ("left it in a tab") |
| roundCapLine | FIX | No tokens this time. You already earned tokens from two rounds today. (one round / N rounds) | unclear ("earned today's two"), apostrophe; wave81-check pin updated |
| legacyNewQuestionsLine | FIX | One trait has a new third question. Optional, and skipping it changes nothing. | unclear ("nothing you've opened goes anywhere") |
| MIXED_TRAIT_LINE | KEEP | Settled, loosely — your answers pulled two ways. The next round checks again. | already clear, honest |
| categoryWaitingLine, intakeSetHeader, INTAKE_SET_PAYOFF_TITLES | KEEP | unchanged | clear |
| progressive-unlock NEXT_ROUND_UNLOCKS[0] | FIX | Another look at traits that are still settling or pulled two ways | unnatural (trailing clause); unused import removed |
| full-profile-banner BUDDY_AFTER_50_BODY | FIX | Insight, categories and your next 16 questions are open. | unclear ("next 16") |
| trait-stability settlingLine | FIX | Still settling: 1 of 3 answers so far. 2 more and this read firms up. | unnatural |
| milestones.ts | KEEP | (reads payoff lines from staged-intake-copy; fixed there) | duplicate resolved at source |
| SHAPE_EMPTY_LINE | FIX | Sixteen answers draw the first lines. | duplicate joke (muted group chat), gloomy |
| SEALED_READ_KICKER | FIX | Today’s insight | unclear (Read card is gone) |
| TOKEN_NEXT_LABEL | FIX | Next +21 tokens | unclear |
| yourWeekLine(0) | FIX | A quiet week. Nothing is lost. | duplicate joke; avoids missed-week guilt |
| SET_DONE_COPY (4), SHAPE_CAPTION, roundRingLine, other yourWeekLine | KEEP | unchanged | clear, distinct from payoff lines now |
| TEAM extraversion m | FIX | Pick-Your-Nights | unclear/noncommittal ("Maybe-Later" reads flaky) |
| TEAM agreeableness l | FIX | Straight-Talk | slang, combative ("Hot-Take") |
| TEAM steadiness h | FIX | Level-Headed (was Steady-Hand; "steady" is a trait-pole word the team-name check bans, fixed 2026-10-20) | slang, can sound dismissive ("Unbothered") |
| TEAM steadiness m | FIX | Mostly-Calm | slang ("Mostly-Chill") |
| TEAM locus_of_control m | FIX | Shared-Wheel | unnatural ("Steer-Some") |
| TEAM playfulness m | FIX | Laid-Back | slang/confusable ("Low-Key") |
| TEAM_ENDINGS cat_steadiness | FIX | Spirit | slang ("Energy" meme) |
| TEAM_ENDINGS cat_structure | FIX | Camp | slang ("Era" meme) |
| TEAM autonomy l "Group-Plan", cat_openness "Squad", other phrases | KEEP | unchanged | clear to an adult; not style-only rewrites |
| DAILY_PICK p36, p64, p13/p15 | KEEP | unchanged | distinct scenes, clear; reviewer wanted style-only edits |
| DAILY_PICK p14 | UNRESOLVED | proposed: A friend asks what you think of their new haircut. It’s not your favorite. | meaning: states a looks verdict as a fact |
| DAILY_PICK p25 | UNRESOLVED | proposed: A close friend suggests sharing locations so you can always see each other. | meaning: declining a stranger's location request is a safety choice, scored as distance |
| DAILY_PICK p50 | UNRESOLVED | proposed: You haven’t opened the language app in six days. | meaning: "missed six days" is streak guilt |

## UNRESOLVED
The three daily-pick prompt fixes are NOT applied. The server pool (supabase/migrations/wave82_daily_pick.sql, already applied) holds the prompt text and `check:daily-pick` pins it to bank.ts exactly, so a wording change needs a new additive migration (update prompt by id, same ids/values) plus a check update. My edit to scripts/daily-pick-check.ts was blocked by the permission system, so I reverted bank.ts (no diff) and removed the migration I had drafted.
1. Daily-pick p14, p25, p50: ok to add `wave99_daily_pick_copy.sql` (three `update ... set prompt` lines, copy-the-wave82 path) and loosen the check to accept reworded prompts carried by it? Proposed texts are in the table.
2. p25: is "close friend" the right fix, or should the pick be about a different personal-space moment so a stranger-safety choice is never scored?
3. Team endings "Spirit" and "Camp": fine, or prefer other words?
