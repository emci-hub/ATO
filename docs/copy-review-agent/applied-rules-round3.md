# Applied rules, round 3 (emci, 2026-10-19)

Core rule: **context, not blanket bans.** Clear, honest, adult language; not sanitizing.
Nothing here is committed, deployed or applied. `wave99d` is NOT applied. The ai-library bundle is stale until
`npm run gen:ai-library` + `supabase functions deploy ai-library` (emci's call; `LIBRARY_VERSION` bump to consider, since
the shared prompts changed).

## A. Strong swearing

| | Before | After |
|---|---|---|
| Client harm filter (`JOKE_HARM_FILTER`, `src/lib/voice/card-joke.ts`) | `/\bfuck/i` refused "fuck" in every form | removed; "fuck" as an expletive passes. New: `fuck/shag` describing sex ("fucked in the car", "each other") is refused as explicit. Slur list gains `sluts?`, `slutty`, `whores?` so client and server match (`cunt` was already a slur on the client) |
| Joke prompts (`STORY_JOKE_ALLOWED`, used by `CARD_JOKE_RULES`, Story, deep dive, Legends) | "…mild swearing" | "Adult swearing is allowed, strong swearing included ("fuck"), when it earns its place in the joke; never as filler." |
| Reviewer rules (`docs/copy-review-rules.md` Humor, CLAUDE.md Humor bullet) | "fuck is still refused until emci decides" | allowed when it earns its place; do not flag a joke for swearing |
| Server (`wave99d`) | `(fuck\|\mslut\|\mwhore\|\mcunt)` → `swear` | no swear refusal. `slur` (same list as the client) and `explicit` (same list as the client) |
| Checks | pinned "fuck stays refused" | `fuck` joke kept in check:category-deep-dive, check:story-thread, check:legend-roster, check:daily-insights-bank; server examples in check:ai-library |

Other swear rules, left alone (none inherited the joke filter's blanket ban):
- Stored tips (insight-bank, category-bank): the clear voice's "no slang" prompt/style rule. Unchanged.
- Pet lines (`check:pet-knows-you`): no swear rule of their own (only Play's gambling words). Unchanged.
- Daily lines (`daily-line/bank.ts`): no swear rule (framework fence only). Unchanged.
- Daily-insights lines (🎯 tasks, superpower, conflict) DID inherit the joke filter, so strong swearing now passes there
  too; they are hand-written and human-reviewed.
- Play name filter (`src/play/play-settings.ts BLOCKED_STEMS`): user-typed public names, a different job. Unchanged
  (not owned, and not a joke rule).

## B. 🎯 tasks: action, cost, consent and risk

`src/lib/daily-insights/rules.ts`. A task stays small, practical and optional: fine to skip, under 15 minutes when a time
is stated. Decided scale: **`SMALL_TREAT_MAX = 10`** (dollars, euros or pounds), about the price of a coffee, spent on
yourself. A named small item (`SMALL_ITEM`: coffee, tea, snack, pastry, fruit, ice cream, smoothie, sandwich, flowers,
notebook…) passes when bought for yourself or one person; buying for a group ("for the team", "the next round") does not.

Rules (each is an instruction: verb in command position + the object that makes it risky):
1. spends money beyond a small treat for yourself (buy / order / pay for / treat X to with a non-small object, a stated
   amount over 10 or not on yourself, "go shopping", "spend money");
2. large or irreversible money move (send / lend / tip money, loans, investing, stocks/crypto, donations, sign-ups,
   subscriptions, bookings);
3. a trip or a paid ride, not an ordinary errand (drive somewhere, fly, a train to a new town, taxi/Uber, a night out at a
   bar/club/cinema/mall, a new city);
4. alcohol or substances as the goal (have a beer, get drunk or high, invite someone "for drinks");
5. gambling; 6. quits a job;
7. contacts an ex or someone who has not invited contact (ghosted/blocked you, a stranger, showing up unannounced);
8. risky to body or safety (skip meals/sleep, fast, hold breath, ice bath, roofs, alone at night, tattoo, hitchhike,
   meeting strangers from the internet);
9. long block of time (minutes ≥ 15, hours, long activities; NEW: meeting someone in person — meet-ups, meals, visits,
   nights out — is a long block, not a safety problem; inviting them is a quick task).

Removed: the blanket "solo" rule ("needs someone else in person") and the blanket "spends money" / "travels" rules.

Pass (44, in the check): Eat lunch away from your desk · Write down what you spent this week · Drink a glass of water
before your next chat · Write down one good thing your ex taught you. Keep it to yourself · Name the bar you would open,
and its worst cocktail · Picture your dream job for five minutes · Text a friend about the best pizza you ever had · Check
your bank balance without flinching · Plan your weekend in three lines · Take a 10-minute walk at lunch · Cook something
with what is already in the fridge · Let your coffee go cold on purpose · Sit in the car for two quiet minutes before you go
in · Quit scrolling for five minutes · Text a friend for a minute · Call a friend and say one nice thing · Write a letter to
your ex. Do not send it · Watch a 5-minute clip and then stop · Take a long walk in 10 minutes flat · Clean one shelf · Tip
your head back and stretch · Climb the stairs once · Fast-forward through the boring part of your to-do list · Sign up for
nothing today · **NEW:** Buy yourself a coffee and drink it slowly · Pick up a fruit you like · Spend 5 dollars on yourself ·
Spend $8 on a coffee for yourself · Treat yourself to a pastry · Buy a coffee for a friend · Order a hot chocolate and drink
it outside · Walk to the corner shop · Take the stairs · Take the bus one stop earlier · Take the bus home and look out the
window · Invite a friend for a coffee this week · Invite a friend to dinner this week · Text someone you miss · Ask a coworker
how their weekend was · Bring a friend along · Grab a coffee with a coworker · Commute without your headphones · Order your
thoughts on paper · Spend ten minutes with zero chats.

Fail (65, in the check), by reason:
- spends money: Order takeout for the team · Treat yourself to a new hoodie · Pay for the next round · Buy a coffee for the
  whole office · Spend 50 dollars on yourself · Spend $12 on a coffee for yourself · Spend 5 dollars on a stranger · Go
  shopping after work · Buy yourself a new phone
- money move: Book a massage after work · Send your friend 5 dollars · Tip someone · Sign up for the gym · Take out a loan
  for the trip · Invest in crypto before lunch · Buy some stocks · Lend a friend money
- trip or paid ride: Drive somewhere new · Take the train to a town you have never seen · Go to the bar and say hi to a
  stranger · Take an Uber home · Fly somewhere this weekend
- alcohol: Have a beer with lunch · After work, grab a drink with one person · Get drunk and call it research · Invite a
  friend for drinks · Sip a beer · Open a beer · Crack a cold one · Get high before the meeting
- gambling: Bet a friend on the game tonight · Buy a scratch card
- quits: Quit your job. You know you want to · Hand in your notice before lunch · Tell your boss you quit
- no consent: Text your ex · Just call your ex and ask why · Write a letter to your ex and send it · Text the person who
  ghosted you · Message someone who blocked you · DM a stranger and say hi · Show up unannounced at a friend's place
- body/safety: Skip lunch and see how long you last · Hold your breath as long as you can · Walk alone at night with no
  phone · Climb onto the roof · Fast today · Take an ice bath · Stay up all night · Get a tattoo on a whim · Meet someone
  from a dating app tonight · Meet a stranger from the internet
- over 15 minutes: Take a 20-minute walk · Read for twenty minutes · Spend an hour on the hard task · Clean all afternoon ·
  Watch a movie · Watch an episode · Take a long walk · Clean the whole kitchen · Binge a show · Meet up with a friend · Go
  out with your coworkers · Have lunch with a friend · Visit your parents

Verdict changes vs round 2 (fixtures only): **now pass** — Spend 5 dollars on yourself; Buy a coffee for a friend;
Bring a friend along. **Same verdict, new reason** — Book a massage / Send your friend 5 dollars / Tip someone / Sign up
for the gym (money move); Take an Uber home (trip or paid ride: cost beyond a small treat); Invite a friend for drinks
(alcohol only, no longer "needs someone in person"); Meet up with a friend / Go out with your coworkers (long block of
time). Every one of the 44 bank tasks passed before and passes now.

## C. Labels on the reader, not vocabulary

`src/lib/voice/clinical.ts` (`READER_LABEL_PATTERNS`, `readerLabelHit`, `hasClinicalLabel`, `CLINICAL_ADVICE`), used by
dive.ts CLINICAL, story-card.ts CLINICAL, rules.ts CLINICAL_EXTRA, banned.ts `STORY_CLINICAL_CARD6` (now therapy-speak
phrases + the shared rule), check-pet-knows-you. The old word lists (`DIAGNOSIS_TERMS`, `ATTACHMENT_LABELS`,
`SHAMING_LABELS`) are gone.

Patterns (case-insensitive):
1. `you are <label>`: you're / you are / were / seem / sound / look / come across as / act / become / can be / might be… +
   up to 4 fillers (so, clearly, a bit, kind of, a walking…) + label. ("You feel needy" is a feeling and passes.)
2. `people like you are <label>`.
3. `your <label|condition>[ side|style|attachment…] (is|shows|explains|means|kicks in|… or end of clause)`.
4. `your <behaviour> is <label>`: your habit / texting / vibe / side / personality… is (so) toxic.
5. `you have <condition>`: you have / you've got / you might have / you suffer from + ADHD, trauma, a disorder, panic attacks…
6. `<label> of you`: so bipolar of you, very narcissistic of you.
7. `a classic <label>`: classic / textbook / typical / certified + narcissist, ADHD, avoidant, codependent…
8. `<condition> in you`: depression in how you plan, a narcissist in you.
9. `signs of <condition>`: signs / symptoms of depression.
10. `diagnos…` anywhere (the one word still refused everywhere: ATO copy has no reason to talk about a diagnosis).

Labels: toxic, needy, clingy, codependent, red flag, avoidant (not "avoidant of / about / around"), fearful/dismissive-
avoidant, anxiously/securely/insecurely/disorganized attached, emotionally unavailable, neurotic, narcissist(ic),
psychopath(ic), sociopath(ic), gaslighter, bipolar, ADHD, OCD, PTSD, autistic, borderline personality, manic, psychotic,
depressed, depressive, mentally ill, crazy, insane, traumatized, damaged, defective, broken (not "broken up / in / down").

Framework fence (`framework-fence.ts`): "avoidant", "neurotic", "fearful-avoidant", "anxious/secure attachment",
"anxiously/securely attached" removed (labels, now reader-directed). Kept as framework names: "attachment style",
"attachment theory" (added), "anxious-preoccupied", "neuroticism", Big Five, MBTI, type codes… (the separate "no test or
framework words" rule; dev-lab-check and daily-line-check pin "attachment style").

Prompts: moment voice rule 6, dive.ts (RULES, STYLE, GENTLE), story-card.ts NEVER line, sage-story.ts rule 2 and
`STORY_JOKE_BANS` now say "never apply a diagnosis or label to the reader; everyday and contextual use is fine".
Titles keep their stricter tone list (a shareable title is a name for the reader).

Pass/fail pairs (check:daily-insights-bank, 24 pairs, same word both sides):

| Passes (context) | Fails (verdict on the reader) |
|---|---|
| A toxic workplace finally let you leave on time. | You're toxic when the plan changes. |
| My clingy cat sat on the laptop again. | You're clingy when the chat goes quiet. |
| You may feel needy when the chat goes quiet. | You come across as a bit needy in group chats. |
| Your attachment to old photos is a whole archive. | Your avoidant attachment style explains this. |
| Avoidant of small talk, you head for the snacks. | You are so avoidant with friends. |
| Bipolar weather again, so you packed two jackets. | You are clearly bipolar about weekends. |
| The group chat needs therapy. | You need therapy for that habit. (clinical advice) |
| Trauma-bonded by a bad haircut, you both laughed. | Your trauma explains the group chat. |
| The book on narcissism sat unread. | That is so narcissistic of you. |
| A narcissist in a film made you laugh. | A classic narcissist move, honestly. |
| The codependent houseplants share one pot. | You can be codependent with your best friend. |
| Your red flag emoji game is strong. | You're a walking red flag. |
| A depressing Monday, as usual. | You are so depressed lately. |
| An anxiety attack of a to-do list. | You have panic attacks before calls. |
| The ADHD-friendly timer helps the whole office. | You have ADHD, the tabs prove it. |
| That disorderly desk has a system. | Your anxiety disorder is showing. |
| A crazy week, honestly. | You're crazy for replying that fast. |
| Neurotic dog energy from the neighbours again. | People like you are neurotic about plans. |
| Your clingy cat is asleep on the keyboard. | Your clingy side is showing again. |
| The group chat turned toxic, so you muted it. | Your texting is so toxic lately. |
| Emotionally unavailable plants, the best kind. | You're emotionally unavailable at dinner. |
| Symptoms of a Monday: three coffees. | Signs of depression in how you plan. |
| The OCD joke landed badly at work. | You're so OCD about the dishwasher. |
| You get anxious before a big call. | You've been diagnosed by the group chat. |

Verdict changes vs round 2 (fixtures only; no stored bank string changed verdict — every bank passed before and after):
now pass — "That habit is toxic." (a judgment on a habit, not "your"), "An anxiety attack is not a plan.", "Your
securely-attached friend wins." (about a friend), "You may feel needy or clingy when friends go quiet…" (a feeling), "An
anxiety attack can hit when a plan changes late…", "The whole table turns codependent…" (about others; the fixture was
reworded to "Your friends turn codependent…" because "the whole table" is a banned cliché), "You may notice
a disorderly desk / mental health days…" (unchanged pass). Replacements added to the fail lists: "Your texting habit is
toxic.", "That's so toxic of you.", "Your securely-attached side wins.", "You come across as needy or clingy…", "You have
panic attacks…", "Your clingy side shows…", "People like you are toxic…", "Your toxic side kicks in…".

Residual risk (client): regexes judge form, not meaning. Missed: a verdict without "you/your" in an all-about-you card
("Classic avoidant energy" is caught; "Pure clingy behaviour, honestly" is not); "you get clingy" (treated as a described
moment, by decision). Over-caught: "you're crazy good at this", "a classic toxic workplace" is fine but "you're a toxic
waste of a Monday" fails. Human review (docs/copy-review-rules.md) covers the rest.

## wave99d vs wave93 (`_library_card_ok`, the only changed lines)

```diff
   if body ~* '(https?://|www\.|\.com\M|@|<|>|\[|\]|#)' then return 'link or markup'; end if;
-  if body ~* '(fuck|shit|bitch|asshole|\mslut|\mwhore|\mcunt)' then return 'swear'; end if;
+  if body ~* '\m(n[i1]gg(a|er|ers|as|uh|az)|fag(s|got|gots|gy)?|retard(s|ed)?|trann(y|ies)|kikes?|spics?|wetbacks?|gooks?|dykes?|cunts?|sluts?|slutty|whores?)\M' then return 'slur'; end if;
+  if body ~* '\m(porn[a-z]*|nudes|orgasm[a-z]*|horny|blow ?jobs?|hand ?jobs?|masturbat[a-z]*|dildos?|boners?|erections?|cumming|cumshots?|cocks?|puss(y|ies)|genitals?)\M' then return 'explicit'; end if;
   if p_kind <> 'legend' and body ~ '[0-9]' then return 'digit'; end if;
   if p_kind <> 'legend'
-     and body ~* '\m(anxious|anxiety|insecure|insecurity|avoidant|disorder|trauma|toxic|needy|clingy|codependent|diagnos|therapy|therapist|symptom)' then
+     and (body ~* '\myou(''re|’re| are| seem| sound| come across as| can be)\s+((so|clearly|really|totally|a|an|the|bit|little|kind|of|pretty|very|such|just|obviously|definitely|probably|basically|literally|textbook|classic)\s+){0,4}(toxic|needy|clingy|co-?dependent|avoidant(?! (of|about|around)\M)|narcissists?|narcissistic|psychopaths?|psychopathic|sociopaths?|sociopathic|bipolar|adhd|ocd|ptsd|neurotic|mentally ill|emotionally unavailable|red flags?|(anxiously|securely|insecurely)[- ]attached)\M'
+       or body ~* '\myour\s+(avoidant attachment|anxious attachment|attachment style|anxiety disorder|[a-z]+ disorder|trauma|depression|adhd|ocd|ptsd|narcissism|codependency|toxic side|needy side|clingy side|avoidant side)\s+(is|are|was|shows|showing|explains|means|kicks in)\M'
+       or body ~* '\m(you have|you''ve got|you’ve got|you might have|you probably have|you clearly have)\s+((a|an|some|full-blown|textbook|classic|clinical)\s+){0,2}(depression|bipolar|adhd|ocd|ptsd|autism|[a-z]+ disorder|trauma|attachment issues|narcissistic personality|borderline personality|mental illness)\M'
+       or body ~* '\m(narcissistic|bipolar|toxic|co-?dependent|psychopathic|sociopathic|clingy|needy|neurotic|crazy)\s+of you\M'
+       or body ~* '\m(classic|textbook|typical|certified)\s+(narcissist|narcissistic|psychopath|sociopath|adhd|ocd|bipolar|avoidant|codependent|neurotic)\M'
+       or body ~* '\mpeople like you (are|get|can be)\s+([a-z]+\s+){0,2}(toxic|needy|clingy|codependent|avoidant|narcissistic|neurotic|crazy)\M'
+       or body ~* '\mdiagnos') then
     return 'clinical word';
```

Same function, signature and grants. Server residual risk: only the clear verdict forms; the Edge Function runs the
full client checks first, so the SQL is a backstop for a check that was skipped, not the judge. Not run against
Postgres: the patterns are run as JS (`\m`/`\M` → `\b`) in check:ai-library on 11 pass and 16 fail examples. Postgres
ARE supports the one look-ahead used. Apply only with emci's ok.

## Test counts (all run 2026-10-19)

| Check | Result |
|---|---|
| typecheck | pass |
| check:daily-insights-bank | 15 groups pass (24 label pairs, 6×2 attachment fixtures, 18 fail + 17 pass validator lines, 7 swear fixtures, 65 refused + 44 passing tasks, 44 bank tasks) |
| check:category-deep-dive | 9 groups pass (17 condition-in-you words, 4 verdicts, 11 everyday-word passes + 11 feeling/context lines, 9 label fails, 4 harm jokes dropped, 1 swear joke kept, 3 prompt pins) |
| check:story-thread | 9 pass (6 pass hooks, 8 fail hooks, 4 swear pins) |
| check:story-templates / story-bank / story-card6 | 10 / 11 / 3 pass (244 card-6 blocks) |
| check:legend-roster | 20 groups pass (+2 joke fixtures) |
| check:pet-knows-you | 16 groups pass (+6 rule fixtures) |
| check:insights-no-ai / play-isolation / release-mode | pass |
| also run: daily-line, dev-lab, traits, library, questions, question-bank, full-profile, jargon, daily-pick, intake, story-clarity, story-gender | pass |
| check:ai-library | fails on the stale bundle (expected). With that line skipped, a second, unrelated failure: "no test word in a team phrase: Steady-Hand" from another uncommitted edit to `src/lib/ai-library/teams.ts` (not this round). With both skipped: 14 groups pass, including the new wave99d block |
| eslint (changed files) | 0 errors (1 old warning in story-thread-check.ts) |
