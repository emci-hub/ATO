# Question bank in the moment voice — before / after (2026-10-05)

Draft behind `QUESTION_VOICE_COPY_REVIEWED = false`. Every row keeps its trait,
its set and the value at every option position — only words changed, so no
score moves (`check:question-voice`). Old wording: `src/lib/questions/bank-v1.ts`.
The server accepts both wordings (wave84), so phones on an older update are fine.

**Changed:** 37 of 48 intake, 21 of 22 round questions.

## Ones that did not make sense (fixed)

- **"Your Do today was writing down one thing you're walking into…"** — pointed at the
  Read + Do card, which no longer exists. Now: a new place opened next to your usual spot.
- **"Everyone at the table already knows their order. You don't."** — "I ask what
  everyone else got" scored as the MOST self-belief. The question stays; the top
  answer is now "I pick something and own it" (same value).
- **"Someone asks how next year's looking."** / **"How next year goes is mostly up to you."** —
  two near-copies; one is now "New year, blank calendar", the other a job email.
- **"Someone sends a short reply that could be read two ways."** — a near-copy of an
  intake question; now a manager's "can we talk tomorrow?".
- **Statements, not moments:** "You need reassurance more often…", "Winning the point
  matters more…", "You can get noticeably better at almost anything…", "People would say
  you are one of the sillier people…" — each is now a scene with reactions.
- **"you are" / "you're" in the question** (9) and **"same as always"** in an option.
- **Options that read as the right answer:** "New one. Obviously", "Yes, easily".

## How the options were balanced (research)

- Options are reactions in the same shape and length, every one easy to admit to
  out loud. How flattering an option is and how plausible it sounds explain about a third
  of how people answer (Kaminski et al. 2019, *Int. J. Selection & Assessment*,
  https://onlinelibrary.wiley.com/doi/10.1111/ijsa.12233; item-writing guide:
  https://support.testgorilla.com/hc/en-us/articles/9028585383707-Writing-situational-judgement-questions).
- Forced choices only work when the choices are equally desirable
  (https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2017.00806/full).
- On screens people lean to the first option (primacy), so order is mixed per person;
  for a scale, reversing is safer than a full shuffle — the middle stays in the middle
  (https://academic.oup.com/poq/article/72/5/914/1832496,
  https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9619315/).

## New ideas from the research (not built — your call)

1. **Light "who would you text first" pairs** for Connection / Personal space — fast,
   modern, very low social pressure.
2. **A "skip, not me" tap** on a round question that does not fit someone's life (no
   coworkers, no roommate) — today they must pick something that is not true.
3. **Retire round questions people skip or reroll a lot** — the pool already counts
   `times_served`; adding a reroll count per row would show which ones miss.

## Intake (48)

| # | Trait | Set | Before | After |
|---|---|---|---|---|
| 1 | Curiosity | 1 | **Your Do today was writing down one thing you're walking into. Was today's version the safe pick or the different one?**<br>The different one, easily (0.8) / Somewhere in between (0.5) / The safe, familiar one (0.2) | **A new place opened next to your usual spot, and your usual order is already in the app.**<br>I try the new place (0.8) / I save it for next week (0.5) / Usual order. It's right there (0.2) |
| 2 | Curiosity | 2 | **Same restaurant, and there is a menu item you have never tried.**<br>New one. Obviously (0.8) / Depends on the day (0.5) / I know what I like (0.2) | **Same restaurant, same order, and a dish you have never tried is on the menu.**<br>I order the new one (0.8) / Depends on the day (0.5) / I know what I like (0.2) |
| 3 | Curiosity | 3 | **A friend wants to drag you to something you would never pick yourself.**<br>I'm in, that's the fun part (0.8) / I'd probably pass (0.2) | **A friend sends an invite to something you would never pick yourself.**<br>I'm in, that's the fun part (0.8) / I'd probably pass (0.2) |
| 4 | Follow-through | 1 | **A plan you made last week hits a boring stretch today.**<br>I still see it through (0.8) / I keep it if it stays easy (0.5) / I switch to whatever feels better (0.2) | **The plan you put in your calendar last week hits its boring part today.**<br>I still see it through (0.8) / I keep it if it stays easy (0.5) / I switch to whatever feels better (0.2) |
| 5 | Follow-through | 2 | **Something is due Friday. It is Monday.**<br>I start chipping at it now (0.8) / I start once it feels close (0.5) / Thursday night, same as always (0.2) | **Monday. Your calendar says it is due Friday.**<br>I start chipping at it now (0.8) / I start once it feels close (0.5) / Thursday night, like last time (0.2) |
| 6 | Follow-through | 3 | **You said you would do a small thing for someone and nobody followed up.**<br>I still do it (0.8) / It quietly disappears (0.2) | **You said you'd send someone a link. Nobody followed up.**<br>I still send it (0.8) / It quietly disappears (0.2) |
| 7 | Sociability | 1 | **Saturday afternoon, nobody has plans yet.**<br>I'd rather text a few people and make something happen (0.8) / Either way, I'm fine (0.5) / I'd rather keep the time quiet (0.2) | **Saturday afternoon and the group chat is quiet.**<br>I text a few people and make plans (0.8) / Either way, I'm fine (0.5) / I keep the afternoon quiet (0.2) |
| 8 | Sociability | 2 | **You walk into a party and know maybe two people.**<br>I start talking to someone new (0.8) / I find the two I know (0.5) / I'm counting the minutes (0.2) | **You walk into a party and know two people. Both are on their phones.**<br>I start talking to someone new (0.8) / I go stand with the two I know (0.5) / I'm counting the minutes (0.2) |
| 9 | Sociability | 3 | **A long week just ended.**<br>Going out would recharge me (0.8) / Being alone would recharge me (0.2) | **Friday, 6pm. Three invites in the group chat.**<br>I'm going to at least one (0.8) / Couch. Phone on silent (0.2) |
| 10 | Harmony | 1 | _unchanged_ **A group chat is picking a place you don't really like.**<br>I go along, it's not worth a fuss (0.8) / I mention it once, then let it go (0.5) / I say I'd rather go somewhere else (0.2) | — |
| 11 | Harmony | 2 | **Someone takes credit for something that was mostly yours.**<br>I let it slide (0.8) / I mention it lightly, later (0.5) / I correct it on the spot (0.2) | **On the team call, someone shares your idea as their own.**<br>I let it slide (0.8) / I mention it lightly, later (0.5) / I correct it on the spot (0.2) |
| 12 | Harmony | 3 | **A stranger is clearly in the wrong and clearly having a bad day.**<br>I give them the benefit of the doubt (0.8) / Bad day or not, wrong is wrong (0.2) | **The delivery driver gets your order wrong and looks like their day has been rough.**<br>I give them the benefit of the doubt (0.8) / Bad day or not, wrong is wrong (0.2) |
| 13 | Composure | 1 | **A small thing goes wrong first thing in the morning.**<br>I'm mostly over it by lunch (0.8) / It sits with me a bit, then fades (0.5) / It colors the rest of the day (0.2) | **Your phone hits 3% before you have left the house.**<br>I'm mostly over it by lunch (0.8) / It sits with me a bit, then fades (0.5) / It colors the rest of the day (0.2) |
| 14 | Composure | 2 | **Plans change on you an hour before.**<br>Fine, I roll with it (0.8) / Mild whiplash, then fine (0.5) / It throws off the whole evening (0.2) | **An hour before, the group chat moves the plan somewhere else.**<br>Fine, I roll with it (0.8) / Mild whiplash, then fine (0.5) / It throws off the whole evening (0.2) |
| 15 | Composure | 3 | _unchanged_ **A one-word reply lands and it could be read two ways.**<br>I read it plain and move on (0.8) / I reread it once, then let it go (0.5) / I reread it a few times (0.2) | — |
| 16 | Reassurance | 1 | **Someone you like takes a while to reply.**<br>I start wondering if they're pulling away (0.8) / I notice, then I get on with my day (0.5) / I don't think much of it (0.2) | **Someone you like has had your message for three hours.**<br>I wonder if they're pulling away (0.8) / I notice, then get on with my day (0.5) / I don't think much of it (0.2) |
| 17 | Reassurance | 2 | **A close friend has been quieter than usual this week.**<br>I assume I did something (0.8) / I wonder for a second, then drop it (0.5) / People get busy (0.2) | **Your closest friend has gone quiet in the chat this week.**<br>I assume I did something (0.8) / I wonder for a second, then drop it (0.5) / People get busy (0.2) |
| 18 | Reassurance | 3 | _unchanged_ **You sent a long message an hour ago. It says Read.**<br>I check back more than I'd admit (0.8) / I notice, then put the phone down (0.5) / I forget I sent it (0.2) | — |
| 19 | Personal space | 1 | _unchanged_ **Someone close to you wants to talk something out in person instead of over text.**<br>Sure, that's fine when it matters (0.2) / I'd rather keep it lighter, over text (0.8) | — |
| 20 | Personal space | 2 | **A rough week. Someone asks how you actually are.**<br>I tell them the real version (0.2) / I give them the short version (0.5) / I say I am fine and change the subject (0.8) | **A rough week, and someone texts 'how are you, really?'**<br>I tell them the real version (0.2) / I give them the short version (0.5) / I say I'm fine and change the subject (0.8) |
| 21 | Personal space | 3 | _unchanged_ **Someone starts texting you good morning every day.**<br>I like it (0.2) / Nice, in small doses (0.5) / My replies get slower (0.8) | — |
| 22 | Directness | 1 | **You disagree with someone in the room.**<br>I say so, even if it gets a little sharp (0.8) / I wait to see if it blows over (0.5) / I let it go rather than push (0.2) | **On a work call, someone says something you think is wrong.**<br>I say so, even if it gets a bit sharp (0.8) / I wait to see if it blows over (0.5) / I let it go rather than push (0.2) |
| 23 | Directness | 2 | _unchanged_ **The order is wrong and the place is busy.**<br>I send it back (0.8) / Depends how wrong (0.5) / I eat it (0.2) | — |
| 24 | Directness | 3 | **You want something and asking might annoy someone.**<br>I ask anyway (0.8) / I let it go (0.2) | **Your roommate's music is loud and asking might annoy them.**<br>I ask anyway (0.8) / I let it go (0.2) |
| 25 | Compromise | 1 | **When you and someone else both want different things with no obvious middle ground, who usually gives first?**<br>Probably me (0.8) / Depends who cares more (0.5) / Rarely me (0.2) | **You and a friend each sent a different dinner spot. Who gives first?**<br>Probably me (0.8) / Depends who cares more (0.5) / Rarely me (0.2) |
| 26 | Compromise | 2 | **An argument is going nowhere and it is getting late.**<br>I look for something we both can live with (0.8) / I park it for tomorrow (0.5) / I hold my line (0.2) | **A text argument is ten messages deep and it is getting late.**<br>I find something we can both live with (0.8) / I park it for tomorrow (0.5) / I hold my line (0.2) |
| 27 | Compromise | 3 | **The group chat is arguing and you know you're right.**<br>I let it go to keep the chat calm (0.8) / I say it once, then drop it (0.5) / I send the link that proves it (0.2) | **The group chat is arguing and you know the right answer.**<br>I let it go to keep the chat calm (0.8) / I say it once, then drop it (0.5) / I send the link that proves it (0.2) |
| 28 | Independence | 1 | **Someone hands you a plan that would work fine.**<br>I'd still rather do it my way (0.8) / I'll use theirs if it saves time (0.5) / I'm glad I don't have to figure it out (0.2) | **A friend sends the whole trip plan in the chat, and it would work fine.**<br>I'd still rather do it my way (0.8) / I'll use theirs if it saves time (0.5) / I'm glad I don't have to figure it out (0.2) |
| 29 | Independence | 2 | **You get told exactly how to do something you already know how to do.**<br>It gets under my skin (0.8) / I notice it, then let it go (0.5) / Fine by me, less to think about (0.2) | **Someone messages you step-by-step instructions for a thing you already know how to do.**<br>It gets under my skin (0.8) / I notice it, then let it go (0.5) / Fine by me, less to think about (0.2) |
| 30 | Independence | 3 | _unchanged_ **Saturday's calendar is empty and nobody has texted.**<br>Perfect, the day is mine (0.8) / Nice for a morning, then I make plans (0.5) / I start texting people for plans (0.2) | — |
| 31 | Confidence | 1 | **A hard task lands on your plate.**<br>I feel like I can handle it (0.8) / Depends how hard, honestly (0.5) / I doubt I can pull it off (0.2) | **A hard task lands in your inbox with your name on it.**<br>I feel like I can handle it (0.8) / Depends how hard, honestly (0.5) / I doubt I can pull it off (0.2) |
| 32 | Confidence | 2 | **You are learning something new and you are still bad at it.**<br>I can feel myself getting better (0.8) / Some days it clicks (0.5) / I mostly feel behind (0.2) | **Three weeks into a language app, and it still marks you wrong.**<br>I can feel myself getting better (0.8) / Some days it clicks (0.5) / I mostly feel behind (0.2) |
| 33 | Confidence | 3 | **Someone at work says 'this is your area, right?'**<br>Fair, it is (0.8) / Probably, I'd double-check (0.5) / I'm sure they mean someone else (0.2) | **Someone at work messages: 'this is your area, right?'**<br>Fair, it is (0.8) / Probably, I'd double-check (0.5) / I'm sure they mean someone else (0.2) |
| 34 | Connection | 1 | **A friend cancels same-day, no real reason given.**<br>I'd want to talk it through (0.8) / I'd let it go, check in eventually (0.2) | **A friend cancels by text an hour before, no real reason given.**<br>I'd want to talk it through (0.8) / I'd let it go, check in eventually (0.2) |
| 35 | Connection | 2 | **Something good happens to you on an ordinary Tuesday.**<br>I'm texting someone before I sit down (0.8) / It comes up next time we talk (0.5) / I just enjoy it (0.2) | **Good news pops up on your phone on an ordinary Tuesday.**<br>I'm texting someone before I sit down (0.8) / It comes up next time we talk (0.5) / I just enjoy it (0.2) |
| 36 | Connection | 3 | _unchanged_ **A whole day with no messages from anyone.**<br>I feel the gap (0.8) / Bliss (0.2) | — |
| 37 | Growth | 1 | **You try something new and it goes badly the first time. What actually happens next?**<br>I look at what I'd do differently (0.8) / I probably don't try that again (0.2) | **Your first try at a recipe from a video goes badly. What actually happens next?**<br>I look at what I'd do differently (0.8) / I probably don't try that again (0.2) |
| 38 | Growth | 2 | **Someone is much better than you at a thing you care about.**<br>I want to know how they got there (0.8) / Good for them, different lane (0.5) / Some people just have it (0.2) | **Someone online is much better than you at a thing you care about.**<br>I want to know how they got there (0.8) / Good for them, different lane (0.5) / Some people just have it (0.2) |
| 39 | Growth | 3 | _unchanged_ **A friend posts day 60 of learning something new.**<br>Give me 60 days and I could too (0.8) / Depends on the thing (0.5) / Some people are just built for it (0.2) | — |
| 40 | Ownership | 1 | **A plan you were in on falls apart.**<br>I look first at what I might have done differently (0.8) / Some of it was me, some of it wasn't (0.5) / It was bound to happen (0.2) | **The group trip you helped plan falls apart in the chat.**<br>I look at what I could have done (0.8) / Some of it was me, some wasn't (0.5) / It was bound to happen (0.2) |
| 41 | Ownership | 2 | **A good week. Where does the credit actually go?**<br>Mostly to what I did (0.8) / A bit of both (0.5) / Mostly to how things fell (0.2) | **A good week, and someone texts 'how did you pull that off?'**<br>Honestly, I worked for it (0.8) / A bit of both (0.5) / Good timing, mostly (0.2) |
| 42 | Ownership | 3 | **Someone asks how next year's looking.**<br>Mostly up to what I do (0.8) / Half me, half luck (0.5) / Depends what happens (0.2) | **New year, blank calendar. How it goes is mostly…**<br>Up to what I do (0.8) / Half me, half luck (0.5) / Up to what happens (0.2) |
| 43 | Self-belief | 1 | **Everyone at the table already knows their order. You don't.**<br>I panic-order whatever's closest (0.2) / Takes me a sec but I land on something (0.5) / I ask what everyone else got (0.8) | **Everyone at the table already knows their order. You don't.**<br>I panic-order whatever's closest (0.2) / Takes a sec, but I land on something (0.5) / I pick something and own it (0.8) |
| 44 | Self-belief | 2 | **Something breaks and you have never fixed one before.**<br>I'll figure it out (0.8) / I look it up first (0.5) / I find someone who knows (0.2) | **The wifi drops and you have never fixed it yourself before.**<br>I'll figure it out (0.8) / I look it up first (0.5) / I find someone who knows (0.2) |
| 45 | Self-belief | 3 | _unchanged_ **A big task has sat in your to-do app for two weeks.**<br>I pick any piece and start (0.8) / I break it down, then wait a bit (0.5) / I keep moving it to tomorrow (0.2) | — |
| 46 | Playfulness | 1 | **A dull stretch with nothing required of you.**<br>I'd mess around and see what happens (0.8) / Either way, I am fine (0.5) / I'd rather just get through it (0.2) | **A 40-minute delay at the gate, and your phone is at 20%.**<br>I'd mess around and see what happens (0.8) / Either way, I am fine (0.5) / I'd rather just get through it (0.2) |
| 47 | Playfulness | 2 | **A serious conversation hits a genuinely funny moment.**<br>I take the joke (0.8) / Depends who is in the room (0.5) / I keep it serious (0.2) | **A serious work call, and someone's cat walks across their keyboard.**<br>I take the joke (0.8) / Depends who is on the call (0.5) / I keep it serious (0.2) |
| 48 | Playfulness | 3 | _unchanged_ **The group chat has a running joke.**<br>I started it (0.8) / I keep it going (0.5) / I just react with a laugh (0.2) | — |

## Round-only (22)

| # | Trait | Set | Before | After |
|---|---|---|---|---|
| 1 | Curiosity | round | **You're picking a show to watch and there's something new in your queue you haven't tried.**<br>New one (0.8) / Depends on my mood (0.5) / Something familiar (0.2) | **Something new is sitting in your watch queue, right next to an old favorite.**<br>New one (0.8) / Depends on my mood (0.5) / Something familiar (0.2) |
| 2 | Curiosity | round | **A coworker suggests doing the project a totally different way than you planned.**<br>I'm curious, let's see (0.8) / I'll hear them out (0.5) / I'd rather stick to the plan (0.2) | **A coworker drops a totally different plan into the project chat.**<br>I'm curious, let's see (0.8) / I'll hear them out (0.5) / I'd rather stick to the plan (0.2) |
| 3 | Curiosity | round | **You have a free Saturday and someone mentions a class or hobby you've never tried.**<br>I'd sign up (0.8) / Maybe another time (0.2) | **A friend sends a link to a class for a hobby you have never tried.**<br>I'd sign up (0.8) / Maybe another time (0.2) |
| 4 | Follow-through | round | _unchanged_ **Your alarm goes off and you already know today's to-do list is long.**<br>I get moving right away (0.8) / I ease into it (0.5) / I hit snooze (0.2) | — |
| 5 | Follow-through | round | **You told yourself you'd clean up before bed, and you're tired.**<br>I still do it (0.8) / I do the bare minimum (0.5) / It waits until tomorrow (0.2) | **Midnight, dishes in the sink, and you promised yourself you'd do them tonight.**<br>I still do them (0.8) / I do the bare minimum (0.5) / They wait until tomorrow (0.2) |
| 6 | Follow-through | round | **A form needs three pieces of information and you only have two handy.**<br>I track down the third one now (0.8) / I fill in what I can and come back (0.2) | **An online form wants three things and you only have two handy.**<br>I track down the third one now (0.8) / I fill in what I can, come back later (0.2) |
| 7 | Sociability | round | **You've been working alone for hours and hit a wall.**<br>I go find someone to talk to (0.8) / Either way (0.5) / I push through alone (0.2) | **Hours alone with your laptop, and you just hit a wall.**<br>I go find someone to talk to (0.8) / Either way (0.5) / I push through alone (0.2) |
| 8 | Sociability | round | **A coworker asks if you want to grab lunch with the group instead of eating at your desk.**<br>Yes, easily (0.8) / Depends on the day (0.5) / I'd rather eat alone (0.2) | **The team chat asks who's in for lunch.**<br>Count me in (0.8) / Depends on the day (0.5) / I'd rather eat at my desk (0.2) |
| 9 | Sociability | round | **You're the one who has to make small talk with someone new at an event.**<br>I don't mind starting it (0.8) / I'll follow their lead (0.2) | **At an event, you end up next to someone new and nobody is talking.**<br>I don't mind starting it (0.8) / I'll follow their lead (0.2) |
| 10 | Harmony | round | **Someone asks for a favor that's a genuine inconvenience for you.**<br>I usually say yes anyway (0.8) / Depends how big a favor (0.5) / I say no if it's a real hassle (0.2) | **A friend texts asking for a favor that would eat your whole evening.**<br>I usually say yes anyway (0.8) / Depends how big a favor (0.5) / I say no if it's a real hassle (0.2) |
| 11 | Directness | round | **A friend keeps borrowing money and hasn't paid you back.**<br>I bring it up directly (0.8) / I hint at it (0.5) / I let it slide (0.2) | **A friend still hasn't paid you back for the last three dinners.**<br>I bring it up directly (0.8) / I hint at it (0.5) / I let it slide (0.2) |
| 12 | Connection | round | **You just finished something you're proud of.**<br>I want to tell someone right away (0.8) / It can wait until it comes up (0.5) / I keep it to myself (0.2) | **You just finished something and it came out better than you hoped.**<br>I want to tell someone right away (0.8) / It can wait until it comes up (0.5) / I keep it to myself (0.2) |
| 13 | Composure | round | **Someone sends a short reply that could be read two ways.**<br>I read it the plain way and move on (0.8) / I reread it a few times (0.2) | **Your manager messages 'can we talk tomorrow?' and nothing else.**<br>I read it plain and move on (0.8) / I reread it a few times (0.2) |
| 14 | Reassurance | round | **You need reassurance more often than you would like to admit.**<br>Yeah, that lands (0.8) / Not really me (0.2) | **After a good night out, you scroll back through the chat to check it really went well.**<br>Yeah, that lands (0.8) / Not really me (0.2) |
| 15 | Personal space | round | **Things are getting closer with someone.**<br>I lean in (0.2) / I want a bit of room (0.8) | **The person you've been seeing starts saying 'we' in texts.**<br>I lean in (0.2) / I want a bit of room (0.8) |
| 16 | Compromise | round | **Winning the point matters more than keeping the peace.**<br>Not for me, usually (0.8) / Honestly, sometimes yes (0.2) | **Mid-argument, you find the screenshot that proves your point.**<br>I keep it to myself (0.8) / I send it (0.2) |
| 17 | Independence | round | **A free day with nothing scheduled and nobody asking anything of you.**<br>That is the best kind of day (0.8) / I'd rather have a plan (0.2) | **A day off, notifications muted, and nobody needs anything from you.**<br>That is the best kind of day (0.8) / I'd rather have a plan (0.2) |
| 18 | Confidence | round | **Someone says you are good at something you do a lot.**<br>Yeah, I think so too (0.8) / I brush it off (0.2) | **A coworker messages 'how are you so good at this?'**<br>Yeah, I think so too (0.8) / I brush it off (0.2) |
| 19 | Growth | round | **You can get noticeably better at almost anything with enough reps.**<br>I believe that (0.8) / Only up to a point (0.2) | **Day 1 of a 30-day challenge in an app, and it shows.**<br>I'll be better by day 30 (0.8) / Some things just are not for me (0.2) |
| 20 | Ownership | round | **How next year goes is mostly up to you.**<br>Mostly, yes (0.8) / Timing decides more than I do (0.2) | **The email lands: the job you wanted went to someone else.**<br>Next time I'll do it differently (0.8) / Timing decides more than I do (0.2) |
| 21 | Self-belief | round | **A big thing you have to do, and no obvious first step.**<br>I start somewhere and adjust (0.8) / I stall until it gets urgent (0.2) | **You move apartments next month and the to-do list is just a title.**<br>I start somewhere and adjust (0.8) / I stall until it gets urgent (0.2) |
| 22 | Playfulness | round | **People would say you are one of the sillier people they know.**<br>That tracks (0.8) / Not the word they would use (0.2) | **Someone asks who sends the most memes in the group chat.**<br>Guilty, that's me (0.8) / Not me, I just react (0.2) |
