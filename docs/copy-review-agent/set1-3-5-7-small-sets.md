# Copy review: small sets (staged intake, polish, daily pick, profile card, team names)

Flags covered: STAGED_INTAKE_COPY_REVIEWED, POLISH_COPY_REVIEWED, DAILY_PICK_COPY_REVIEWED, PROFILE_CARD_COPY_REVIEWED, TEAM_COPY_REVIEWED. Read-only review; no source edited.

## Summary
- Reviewed about 195 strings: roughly 165 OK, 26 FIX, 3 REMOVE or rework (the card WEAKNESS label and its quotes).
- Biggest sensitive item: the profile card says STRENGTH / WEAKNESS and "Less natural: Quiet" (or Hesitant, Sensitive, Cautious). It calls the lower end of a trait a weakness, and shows distress-sounding quotes as "strengths".
- One guilt-adjacent pick: p50 ("missed six days" language app). One safety-adjacent pick: p25 (share your location with someone you just met).
- Patterns: straight apostrophes in staged-intake-copy.ts (house style is curly); "group chat / voice note" jokes repeat 10+ times across the sets; set-done lines duplicate the milestone payoff lines (same moment, two different texts); some team words are slang (Chill, Unbothered, Hot-Take, Energy, Era, Squad).
- Teams: the code has 42 phrases (14 traits x 3), not 48, plus 10 endings. All fine in tone; none clinical.

## FIX / REMOVE table

| id or file:line | original | verdict | suggested replacement | reason |
|---|---|---|---|---|
| PROFILE_CARD profile-card.tsx:112 | "WEAKNESS" label | REMOVE | "THE OTHER END" | Calls a person's lower-end trait a weakness; breaks the rule that a quieter side never reads as a flaw |
| PROFILE_CARD profile-history.ts:155 | "Less natural: Quiet" | FIX | "Other end: Direct" (show the opposite end, no judgment) | Same; also tells a reader what is hard for them |
| PROFILE_CARD profile-card.tsx:109 | "STRENGTH" + low-end quotes ("Hesitant: “That’s a lot. I don’t know.”", "Cautious: “I’m not sure I can do this.”", "Quiet: “It’s fine, never mind.”", "Watchful: “Did I say something wrong?”", "Settled: “Maybe this just isn’t my thing.”", "Sensitive: “I’m still thinking about this morning.”") | REMOVE (for low-end and anxiety-pole leans) | Label "STRONGEST LEAN"; for those axes show only the pole word, no quote | These quotes read as distress or self-doubt, shown under "Strength". Quotes were approved for the Full Profile, not for a collectible card |
| PROFILE_CARD profile-history.ts:40 | "Before Start Fresh" | FIX | "Before a reset" | Start Fresh/Start over was replaced by Reset account; old name confuses |
| PROFILE_CARD profile-history.ts:39 | "Before changes" | FIX | "Before you changed answers" | Unclear alone on a card |
| DAILY_PICK p50 | "The language app says you’ve missed six days." | FIX | "You haven’t opened the language app in six days." | "Missed days" is streak-loss/guilt framing |
| DAILY_PICK p25 | "Someone you just met wants to share locations." | FIX | "A new friend asks to follow you on every app." | Choosing "sure, send it" to a stranger's location request reads as encouraging an unsafe habit |
| DAILY_PICK p14 | "A friend asks if their new haircut looks good. It doesn’t." | FIX | "A friend asks if their new haircut looks good. You’re not sure." | Judges someone's looks as a flat fact |
| DAILY_PICK p13/p15/p36 | pizza / movie seen twice / sushi vs burgers | FIX (swap one) | Replace p36 with "Your friend wants a quiet café. You want a loud bar." | Three near-identical "group wants X, you want Y" setups |
| DAILY_PICK p64 | "A kid challenges you to a dance-off in the supermarket." | FIX | "A kid in the supermarket dares you to a dance-off." | Reads as an odd stranger scenario; smoother wording |
| STAGED_INTAKE staged-intake-copy.ts:44 | "No tokens for this one — you've earned today's two." | FIX | "No tokens this time. Today’s two rounds already paid out." | Straight apostrophes; "earned today's two" is unclear |
| STAGED_INTAKE staged-intake-copy.ts:60 | "Optional — nothing you've opened goes anywhere." | FIX | "Optional. Skip them and nothing changes." | Confusing; straight apostrophe |
| STAGED_INTAKE progressive-unlock.ts:68 | "Another look at the traits that are still settling or pulled two ways, out of your 16" | FIX | "Another look at traits that are still settling or pulled two ways" | Clunky, trailing clause |
| STAGED_INTAKE full-profile-banner.tsx:60 | "Insight, categories and your next 16 are open." | FIX | "Insight, categories and your next 16 questions are open." | "Next 16" alone is ambiguous |
| STAGED_INTAKE trait-stability.ts:472 | "Still settling — 1 of 3 answers. 2 more and this read firms up." | FIX | "Still settling: 1 of 3 answers so far. Two more and it firms up." | Sentence starts on a digit; slightly stiff |
| STAGED vs POLISH duplicates | Payoff "Sixteen down — quicker than you answer most texts." and SET_DONE "Sixteen answers. More than the group chat got all week." (same for 32 and 48) | FIX (keep one set) | Keep the polish SET_DONE lines; make payoff lines short and factual, e.g. "Sixteen down. Every trait has a first lean." | Two different texts for one moment; both lean on the same joke |
| POLISH SEALED_READ_KICKER | "Today’s read" | FIX | "Today’s insight" | The Read + Do card is gone; app now says insight |
| POLISH TOKEN_NEXT_LABEL | "Next +21" | FIX | "Next: +21 tokens" | Unclear to a new reader; also hardcodes the number |
| POLISH yourWeekLine(0) | "A quiet week. Like a group chat on mute." | FIX | "A quiet week. The app waited." | Repeats the muted-group-chat joke from SHAPE_EMPTY_LINE |
| POLISH SHAPE_EMPTY_LINE | "Like a group chat everyone muted. Sixteen answers draw the first lines." | FIX | "Blank for now. Sixteen answers draw the first lines." | Same repeated joke; slightly gloomy for an empty state |
| TEAM teams.ts extraversion m | Maybe-Later | FIX | Depends-On-the-Night | Reads flaky/noncommittal; rule says the middle side gets an upside |
| TEAM teams.ts agreeableness l | Hot-Take | FIX | Straight-Talk | "Hot take" is slang and a bit combative; Frank should read warm |
| TEAM teams.ts autonomy l | Group-Plan | FIX | Follow-the-Plan | Too close to "Group-Chat" (Connected); two different traits look alike |
| TEAM teams.ts locus_of_control m | Steer-Some | FIX | Shared-Wheel | Awkward; unclear |
| TEAM teams.ts steadiness h / m | Unbothered / Mostly-Chill | FIX | Steady-Hand / Mostly-Calm | Slang ("unbothered", "chill"); "Unbothered" can sound dismissive |
| TEAM teams.ts playfulness m | Low-Key | FIX | Easy-Going-Fun (or Laid-Back) | Slang, and confusable with "Low-Key" as a mood word |
| TEAM teams.ts endings | Energy, Era, Squad | FIX (optional) | Spirit, Chapter, Team | Gen-Z phrasing ("main character energy", "in my era") dates quickly; "Energy" pairs oddly with "Calm Core" |

## Eight OK items for spot-checking
1. "All 48. You finished something without leaving it in a tab. Your full profile is open." (STAGED_INTAKE)
2. "Settled, loosely — your answers pulled two ways. The next round checks again." (STAGED_INTAKE)
3. "Opened more often than the banking app. Probably." (POLISH)
4. "Thirty-two in. Somewhere a half-finished to-do list feels seen." (POLISH)
5. "The typing bubble appears, disappears, appears again." (DAILY_PICK p23)
6. "Karaoke. Your name is next on the screen." (DAILY_PICK p43)
7. "Small-Steps", "Soft-Spoken", "Feels-It-All" (TEAM; the quieter sides get kind images)
8. "A trait settles after three answers. All 48 give every trait three; a trait whose answers pulled two ways gets asked again next round." (STAGED_INTAKE)

## Notes
- Daily picks: 64 total; 58 OK as written. All use curly apostrophes and never "you are". Group-chat setups appear in p1, p7, p9, p32, p62; fine individually but heavy.
- Staged-intake strings with straight apostrophes need curly: staged-intake-copy.ts lines 44 and 60.
- The profile card Strength/Weakness text borrows from axis-poles.ts, which is marked reviewed (POLE_COPY_REVIEWED = true) for the Full Profile; the quotes were not reviewed for use as a card "strength".
- Milestone streak lines (streak_3/7/21) are outside this slice; they read fine (no loss framing).
- docs/team-names-review.md matches teams.ts exactly; any phrase change needs that doc regenerated (scripts/gen-team-names-review.ts) and check:ai-library re-run.
