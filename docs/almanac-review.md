# Almanac review (PHASE-11c)

Tick `[x]` the cards you approve, then run `npm run load:almanac`. Rows without an id get one from `npm run load:almanac -- --assign`. Nothing is ticked yet, so nothing ships (`ALMANAC_COPY_REVIEWED = false`). Sections: A base Picks (304), B events (159), C arcs (72), D micro-events (20), E try-today (160), F reflect (60), G recaps (40), H year archetype names (32). `[r]` retires a row and keeps its id.

## A. Base Picks (304 = 19 per trait; PHASE-11d appends them to the 64 shipped, taking the bank to 368)

One either/or a day, the same for everyone. `[H]` marks the answer that leans to the trait's high end, `[L]` the low end; the order shown is the order the reader sees. Moment voice: one modern moment, teased kindly, no advice. Both ends are written to feel equally normal.

### `basepick | openness`
- [ ] `alm_basepick_openness_01` A coworker brings in a snack from a country you’ve never visited. || I’ll try it [H] || I’ll stick to my snack [L]
- [ ] `alm_basepick_openness_02` Your streaming app suggests a subtitled film from a genre you skip. || Back to my regulars [L] || Press play [H]
- [ ] `alm_basepick_openness_03` The menu has one dish you can’t picture. || Ordering what I know [L] || Ordering that one [H]
- [ ] `alm_basepick_openness_04` A friend offers to teach you a hobby you’ve never heard of. || Sure, when? [H] || I have enough hobbies [L]
- [ ] `alm_basepick_openness_05` Your route home is blocked and the detour goes down a street you’ve never walked. || Kind of fun [H] || Back to the main road [L]
- [ ] `alm_basepick_openness_06` The bookstore has a staff-picks table of authors you’ve never read. || Heading to my usual shelf [L] || Buying the odd one [H]
- [ ] `alm_basepick_openness_07` A new coffee shop opens next to your regular one. || Trying it tomorrow [H] || Loyal to my regular [L]
- [ ] `alm_basepick_openness_08` You’re handed a blank weekend with no plans. || A favorite, again [L] || Something I’ve never done [H]
- [ ] `alm_basepick_openness_09` A friend shares a playlist of songs from 40 countries. || Shuffle it [H] || Back to my own songs [L]
- [ ] `alm_basepick_openness_10` The community center has a workshop in something you know nothing about. || Not my area [L] || Signing up [H]
- [ ] `alm_basepick_openness_11` Your usual takeout is closed on a Friday night. || A new place it is [H] || Cooking something familiar [L]
- [ ] `alm_basepick_openness_12` A stranger at a party describes a job you didn’t know existed. || Nodding politely [L] || Asking ten questions [H]
- [ ] `alm_basepick_openness_13` There’s a festival in town celebrating a tradition you’ve never seen. || Going [H] || Watching clips later [L]
- [ ] `alm_basepick_openness_14` Your phone offers to switch to a layout you’ve never used. || Keeping my layout [L] || Why not [H]
- [ ] `alm_basepick_openness_15` The recipe calls for an ingredient you can’t pronounce. || Swapping in something I know [L] || Hunting for it [H]
- [ ] `alm_basepick_openness_16` The group picks a trivia night on a topic nobody knows. || Can we do the usual? [L] || Love it [H]
- [ ] `alm_basepick_openness_17` You could paint, bake, or code something this weekend, and you’ve done none of them. || Picking one now [H] || Doing what I’ve done before [L]
- [ ] `alm_basepick_openness_18` A travel site shows two trips: one you know well, one you don’t. || The one I know [L] || The unfamiliar one [H]
- [ ] `alm_basepick_openness_19` Your barber asks if you want something different this time. || Same as always [L] || Surprise me [H]

### `basepick | conscientiousness`
- [ ] `alm_basepick_conscientiousness_01` Your desk has three open tabs and a sticky note from last week. || Clearing the note first [H] || Adding another tab [L]
- [ ] `alm_basepick_conscientiousness_02` The new gadget arrives with a 40-page manual. || Pressing buttons until it works [L] || Reading it through [H]
- [ ] `alm_basepick_conscientiousness_03` The meeting has no agenda. || Writing one on the spot [H] || Seeing where it goes [L]
- [ ] `alm_basepick_conscientiousness_04` You land in a new city for the weekend. || Itinerary done [H] || We’ll wander [L]
- [ ] `alm_basepick_conscientiousness_05` Your inbox shows 112 unread. || Opening whichever looks interesting [L] || Sorting by sender first [H]
- [ ] `alm_basepick_conscientiousness_06` The bill splits five ways and the app is open. || Rounding and moving on [L] || Exact to the cent [H]
- [ ] `alm_basepick_conscientiousness_07` You’re packing the night before a three-day trip. || A list, then the bag [H] || Throwing things in [L]
- [ ] `alm_basepick_conscientiousness_08` A friend texts: can you help me move on Saturday? || Saying yes, sorting it out later [L] || Asking for the details first [H]
- [ ] `alm_basepick_conscientiousness_09` Your files live in a folder system you named yourself. || Folders, labeled [H] || One big pile [L]
- [ ] `alm_basepick_conscientiousness_10` The recipe says “season to taste.” || Tossing in what feels right [L] || Measuring it anyway [H]
- [ ] `alm_basepick_conscientiousness_11` Sunday afternoon, and the week’s chores are on the fridge. || Doing them in order [H] || Doing the fun ones first [L]
- [ ] `alm_basepick_conscientiousness_12` A project is due in two weeks. || Starting when it gets close [L] || Splitting it into daily chunks [H]
- [ ] `alm_basepick_conscientiousness_13` The group trip has a shared doc with times and a backup plan. || A lot of rules for a trip [L] || Love it [H]
- [ ] `alm_basepick_conscientiousness_14` Halfway through a task you spot a better way. || Finishing the old way [L] || Restarting clean [H]
- [ ] `alm_basepick_conscientiousness_15` Your keys have a hook by the door. || On the hook [H] || Wherever I dropped them [L]
- [ ] `alm_basepick_conscientiousness_16` You spot the perfect gift a week early. || Buying it now [H] || Deciding later [L]
- [ ] `alm_basepick_conscientiousness_17` The oven says it’s still heating. || Putting the tray in anyway [L] || Waiting for the beep [H]
- [ ] `alm_basepick_conscientiousness_18` Your to-do list runs long. || Scrawled and loose [L] || Ranked and numbered [H]
- [ ] `alm_basepick_conscientiousness_19` Your alarm is set for 7:00 and the meeting is at 9:00. || Leaving early to be safe [H] || Leaving when it feels right [L]

### `basepick | extraversion`
- [ ] `alm_basepick_extraversion_01` A coworker invites the team out after work. || Home sounds good [L] || Count me in [H]
- [ ] `alm_basepick_extraversion_02` The elevator has one other person in it. || Small talk [H] || Eyes on my phone [L]
- [ ] `alm_basepick_extraversion_03` You’re seated at a wedding table of strangers. || Waiting to be spoken to [L] || Introducing myself [H]
- [ ] `alm_basepick_extraversion_04` Your Saturday is wide open. || Texting five people [H] || Not texting anyone [L]
- [ ] `alm_basepick_extraversion_05` It’s 11 p.m. and the party is still loud. || Looking for the exit [L] || Just getting started [H]
- [ ] `alm_basepick_extraversion_06` Your phone rings. || Letting it go to voicemail [L] || Picking up [H]
- [ ] `alm_basepick_extraversion_07` A friend asks for a quick call about nothing. || Sure, right now [H] || Can we text instead? [L]
- [ ] `alm_basepick_extraversion_08` A new class starts with an icebreaker. || Hoping it skips me [L] || Volunteering first [H]
- [ ] `alm_basepick_extraversion_09` Your weekend plans just got canceled. || Quiet relief [L] || Finding another group [H]
- [ ] `alm_basepick_extraversion_10` The work event ends and there’s an after-party. || Staying until the lights come on [H] || Saying goodbye early [L]
- [ ] `alm_basepick_extraversion_11` Your seatmate on a long flight is chatty. || Headphones on [L] || Chatting back [H]
- [ ] `alm_basepick_extraversion_12` The cafe is full and a stranger offers you a seat at their table. || Taking my coffee to go [L] || Sitting and chatting [H]
- [ ] `alm_basepick_extraversion_13` You just finished a hard week. || Seeing everyone [H] || Seeing no one [L]
- [ ] `alm_basepick_extraversion_14` A group photo is about to be taken. || Standing at the edge [L] || Pulling people in [H]
- [ ] `alm_basepick_extraversion_15` The group chat has 14 unread messages. || Jumping in [H] || Catching up later [L]
- [ ] `alm_basepick_extraversion_16` The new neighbor waves from their balcony. || Waving back [L] || Heading over [H]
- [ ] `alm_basepick_extraversion_17` A friend asks to bring someone you haven’t met. || The more the merrier [H] || Maybe next time [L]
- [ ] `alm_basepick_extraversion_18` Your birthday is next month. || One close friend [L] || A big gathering [H]
- [ ] `alm_basepick_extraversion_19` Karaoke night is on the calendar. || Happy to watch [L] || First on the list [H]

### `basepick | agreeableness`
- [ ] `alm_basepick_agreeableness_01` A friend shows you a haircut they love and you don’t. || It looks great [H] || It’s not for me [L]
- [ ] `alm_basepick_agreeableness_02` Dinner is picked and you wanted something else. || Saying so [L] || Going along [H]
- [ ] `alm_basepick_agreeableness_03` A coworker asks how their uneven presentation went. || Naming the weak part [L] || Pointing out what worked [H]
- [ ] `alm_basepick_agreeableness_04` A relative gives you a gift you won’t use. || Thanking them warmly [H] || Admitting it’s not my style [L]
- [ ] `alm_basepick_agreeableness_05` A friend asks how their new business idea sounds. || Honest about the risks [L] || Cheering them on [H]
- [ ] `alm_basepick_agreeableness_06` The group wants to watch a movie you’ve already seen. || Telling them I’ve seen it [L] || Happy to rewatch [H]
- [ ] `alm_basepick_agreeableness_07` A friend’s cooking is just okay. || Saying it’s fine [L] || Saying it’s delicious [H]
- [ ] `alm_basepick_agreeableness_08` Someone gets a fact wrong in casual conversation. || Letting it pass [H] || Correcting them [L]
- [ ] `alm_basepick_agreeableness_09` A teammate misses a small deadline. || Mentioning it [L] || Giving them a pass [H]
- [ ] `alm_basepick_agreeableness_10` Someone asks for a ride the minute you sit down. || Grabbing the keys [H] || Asking for ten minutes [L]
- [ ] `alm_basepick_agreeableness_11` A friend vents about the same thing again. || Listening again [H] || Noting it’s the third time [L]
- [ ] `alm_basepick_agreeableness_12` Your neighbor asks you to water their plants for two weeks. || Of course [H] || Let me check my week [L]
- [ ] `alm_basepick_agreeableness_13` A friend asks for your honest take on their outfit. || Saying what I’d change [L] || Saying it works [H]
- [ ] `alm_basepick_agreeableness_14` A friend is 30 minutes late. || No worries [H] || Mentioning it [L]
- [ ] `alm_basepick_agreeableness_15` A group chat argument breaks out over plans. || Picking a side [L] || Smoothing it over [H]
- [ ] `alm_basepick_agreeableness_16` You’re asked to rate a restaurant out of five. || A fair three [L] || A generous four [H]
- [ ] `alm_basepick_agreeableness_17` A coworker’s new idea has a hole in it. || Pointing at the hole [L] || Building on it [H]
- [ ] `alm_basepick_agreeableness_18` A friend shows off their new apartment. || Loving everything [H] || Mentioning the tiny kitchen [L]
- [ ] `alm_basepick_agreeableness_19` Someone’s joke lands badly at dinner. || Laughing anyway [H] || Staying quiet [L]

### `basepick | steadiness`
- [ ] `alm_basepick_steadiness_01` Your flight is delayed by two hours. || There go my plans [L] || Fine, I’ll read [H]
- [ ] `alm_basepick_steadiness_02` Your boss sends “can we talk?” || Probably nothing [H] || Replaying the whole week [L]
- [ ] `alm_basepick_steadiness_03` A harsh review of your work shows up. || Thinking about it all day [L] || Over it by lunch [H]
- [ ] `alm_basepick_steadiness_04` You spill coffee on your shirt before a meeting. || Shrug and go [H] || It stays on my mind [L]
- [ ] `alm_basepick_steadiness_05` A loud argument starts on the train. || Feeling it in my chest [L] || Staying calm [H]
- [ ] `alm_basepick_steadiness_06` Your phone buzzes at 2 a.m. || Wide awake now [L] || Back to sleep [H]
- [ ] `alm_basepick_steadiness_07` A friend cancels at the last minute. || It stings a bit [L] || No big deal [H]
- [ ] `alm_basepick_steadiness_08` A pop quiz is announced. || Bring it on [H] || Heart rate up [L]
- [ ] `alm_basepick_steadiness_09` A stranger is rude at the counter. || Carrying it home [L] || Forgotten by the door [H]
- [ ] `alm_basepick_steadiness_10` Your vacation day falls apart. || Making new plans [H] || Taking a while to recover [L]
- [ ] `alm_basepick_steadiness_11` A sad movie ends. || Teary for an hour [L] || Dry eyes [H]
- [ ] `alm_basepick_steadiness_12` A deadline moves up by two days. || Feeling the squeeze [L] || Rearranging calmly [H]
- [ ] `alm_basepick_steadiness_13` A rumor about layoffs reaches you. || Checking every five minutes [L] || Waiting for facts [H]
- [ ] `alm_basepick_steadiness_14` A friend snaps at you after a long day. || Letting it slide [H] || Thinking about it later [L]
- [ ] `alm_basepick_steadiness_15` The wifi dies in the middle of a call. || Frustration spiking [L] || Reconnecting, no stress [H]
- [ ] `alm_basepick_steadiness_16` You’re about to speak in front of a crowd. || Steady hands [H] || Shaky hands [L]
- [ ] `alm_basepick_steadiness_17` Your mistake at work gets noticed. || Feeling bad all evening [L] || Fixing it and moving on [H]
- [ ] `alm_basepick_steadiness_18` Someone gives you tough feedback. || Needing a walk first [L] || Taking notes [H]
- [ ] `alm_basepick_steadiness_19` The line is long and the day is hot. || Patience running thin [L] || Waiting it out [H]

### `basepick | attachment_anxiety`
- [ ] `alm_basepick_attachment_anxiety_01` You sent a long message and it says “read” with no reply. || Phone down, fine [L] || Checking again in ten minutes [H]
- [ ] `alm_basepick_attachment_anxiety_02` A friend is quieter than usual tonight. || Wondering if it’s me [H] || Giving them space [L]
- [ ] `alm_basepick_attachment_anxiety_03` A friend takes three days to text back. || Rereading my last message [H] || They’re busy [L]
- [ ] `alm_basepick_attachment_anxiety_04` Plans with a close friend get moved. || Fine [L] || Wondering what changed [H]
- [ ] `alm_basepick_attachment_anxiety_05` A friend posts a trip with people you didn’t know they knew. || A small pang [H] || Happy for them [L]
- [ ] `alm_basepick_attachment_anxiety_06` The group chat goes silent after your joke. || Moving on [L] || Replaying it [H]
- [ ] `alm_basepick_attachment_anxiety_07` A friend says “we should talk” and nothing else. || Waiting until later [L] || Spiraling until then [H]
- [ ] `alm_basepick_attachment_anxiety_08` You haven’t heard from a close friend in a week. || Reaching out to check we’re okay [H] || They’ll reach out [L]
- [ ] `alm_basepick_attachment_anxiety_09` Your usual weekend group skips you this once. || A one-off [L] || Reading into it [H]
- [ ] `alm_basepick_attachment_anxiety_10` A friend replies with just “k.” || Just “k” [L] || “k” means something [H]
- [ ] `alm_basepick_attachment_anxiety_11` Someone you care about sends a one-word answer. || Short is fine [L] || Searching for the tone [H]
- [ ] `alm_basepick_attachment_anxiety_12` A close friend makes a new close friend. || Glad for both [L] || Counting my own place [H]
- [ ] `alm_basepick_attachment_anxiety_13` A friend doesn’t react to your message. || Moving on [L] || Doubting it [H]
- [ ] `alm_basepick_attachment_anxiety_14` Someone you like doesn’t say goodnight. || It happens [L] || Noticing [H]
- [ ] `alm_basepick_attachment_anxiety_15` A friend forgets a small thing you told them. || Telling them again [L] || Feeling unseen [H]
- [ ] `alm_basepick_attachment_anxiety_16` You’re left off a casual get-together. || It’s fine [L] || It’s hard not to wonder [H]
- [ ] `alm_basepick_attachment_anxiety_17` A long-distance friend goes quiet for a month. || Life gets busy [L] || Writing a long message [H]
- [ ] `alm_basepick_attachment_anxiety_18` Your friend texts someone else all through dinner. || Letting them [L] || Feeling a bit left out [H]
- [ ] `alm_basepick_attachment_anxiety_19` You share something personal and the topic changes. || Natural [L] || Worrying I shared too much [H]

### `basepick | attachment_avoidance`
- [ ] `alm_basepick_attachment_avoidance_01` A friend wants to talk about feelings over dinner. || Leaning in [L] || Steering to another topic [H]
- [ ] `alm_basepick_attachment_avoidance_02` You had a rough day and a friend asks how you are. || Telling them [L] || Saying fine [H]
- [ ] `alm_basepick_attachment_avoidance_03` A close friend wants to spend the whole weekend together. || Sounds nice [L] || Needing a day to myself [H]
- [ ] `alm_basepick_attachment_avoidance_04` A friend offers to help with your stressful week. || Accepting [L] || Handling it alone [H]
- [ ] `alm_basepick_attachment_avoidance_05` Someone says they missed you after a short trip. || Missing them back [L] || Feeling a bit crowded [H]
- [ ] `alm_basepick_attachment_avoidance_06` You’re sick and a friend offers to bring soup. || Yes please [L] || I’ll be fine [H]
- [ ] `alm_basepick_attachment_avoidance_07` A friend hugs you hello every single time. || Hugging back [L] || Stiffening a little [H]
- [ ] `alm_basepick_attachment_avoidance_08` Someone asks what you need right now. || Saying it [L] || Not sure how to say it [H]
- [ ] `alm_basepick_attachment_avoidance_09` A friend shares something vulnerable. || Sharing something back [L] || Listening, sharing less [H]
- [ ] `alm_basepick_attachment_avoidance_10` You get good news. || Keeping it to myself for a while [H] || Calling someone [L]
- [ ] `alm_basepick_attachment_avoidance_11` A friend proposes a weekly call. || Love that [L] || Maybe monthly [H]
- [ ] `alm_basepick_attachment_avoidance_12` You feel overwhelmed at a friend’s place. || Saying so [L] || Hiding it until I leave [H]
- [ ] `alm_basepick_attachment_avoidance_13` A close friend ends the call with “love you.” || Saying it back [L] || Saying “you too” [H]
- [ ] `alm_basepick_attachment_avoidance_14` Someone you’re getting close to asks about your childhood. || Telling stories [L] || Keeping it light [H]
- [ ] `alm_basepick_attachment_avoidance_15` A friend wants you to meet their whole crew. || Excited [L] || Needing some time [H]
- [ ] `alm_basepick_attachment_avoidance_16` A friend leans on you after a rough breakup. || Happy to be the one [L] || Glad when others help too [H]
- [ ] `alm_basepick_attachment_avoidance_17` A friend asks to be roommates. || A warm yes [L] || Wanting my own space [H]
- [ ] `alm_basepick_attachment_avoidance_18` A friend texts “thinking of you” out of nowhere. || Smiling [L] || Not sure how to answer [H]
- [ ] `alm_basepick_attachment_avoidance_19` A friend wants a photo of you two framed for their desk. || Aw [L] || Feels like a lot [H]

### `basepick | conflict_assertiveness`
- [ ] `alm_basepick_conflict_assertiveness_01` The restaurant brings the wrong order. || Eating it anyway [L] || Saying so right away [H]
- [ ] `alm_basepick_conflict_assertiveness_02` A coworker keeps interrupting you. || Pointing it out [H] || Waiting for a gap [L]
- [ ] `alm_basepick_conflict_assertiveness_03` Your roommate leaves dishes for a third day. || Doing them myself [L] || Bringing it up tonight [H]
- [ ] `alm_basepick_conflict_assertiveness_04` A friend’s joke stings a little. || Telling them [H] || Letting it pass [L]
- [ ] `alm_basepick_conflict_assertiveness_05` You disagree with the plan in a meeting. || Writing it down for later [L] || Speaking up [H]
- [ ] `alm_basepick_conflict_assertiveness_06` Your rent goes up with a week’s notice. || Pushing back today [H] || Hoping it’s a mistake [L]
- [ ] `alm_basepick_conflict_assertiveness_07` A friend cancels for the third time. || Saying it’s fine [L] || Saying it bugs me [H]
- [ ] `alm_basepick_conflict_assertiveness_08` A stranger takes your seat. || Finding another one [L] || Asking for it back [H]
- [ ] `alm_basepick_conflict_assertiveness_09` The group chat decides something you disagree with. || Going along quietly [L] || Saying so [H]
- [ ] `alm_basepick_conflict_assertiveness_10` Your food arrives cold. || Eating and moving on [L] || Sending it back [H]
- [ ] `alm_basepick_conflict_assertiveness_11` A teammate’s work needs to be redone. || Redoing it myself [L] || Telling them directly [H]
- [ ] `alm_basepick_conflict_assertiveness_12` Someone talks over you at dinner. || Finishing my sentence [H] || Letting them finish [L]
- [ ] `alm_basepick_conflict_assertiveness_13` A neighbor’s music is loud at midnight. || Earplugs [L] || Knocking [H]
- [ ] `alm_basepick_conflict_assertiveness_14` A friend asks to borrow something you’d rather not lend. || Saying yes [L] || Saying no [H]
- [ ] `alm_basepick_conflict_assertiveness_15` Your manager hands you a task that isn’t yours. || Taking it on [L] || Saying it isn’t mine [H]
- [ ] `alm_basepick_conflict_assertiveness_16` A friend gives advice you didn’t ask for. || Nodding along [L] || Saying thanks, but no [H]
- [ ] `alm_basepick_conflict_assertiveness_17` A salesperson won’t take no for an answer. || Polite stalling [L] || A firm no [H]
- [ ] `alm_basepick_conflict_assertiveness_18` A group project is splitting unfairly. || Taking the extra work [L] || Raising it with everyone [H]
- [ ] `alm_basepick_conflict_assertiveness_19` You think a friend is making a mistake. || Staying out of it [L] || Telling them [H]

### `basepick | conflict_cooperativeness`
- [ ] `alm_basepick_conflict_cooperativeness_01` You and a friend want different movies. || Holding out for mine [L] || Picking theirs [H]
- [ ] `alm_basepick_conflict_cooperativeness_02` A coworker wants to split the work differently. || Meeting in the middle [H] || Sticking with my plan [L]
- [ ] `alm_basepick_conflict_cooperativeness_03` Your sibling asks to swap holidays. || Keeping our usual [L] || Happy to swap [H]
- [ ] `alm_basepick_conflict_cooperativeness_04` The dinner debate drags on. || Letting them have it [H] || Making my case [L]
- [ ] `alm_basepick_conflict_cooperativeness_05` A teammate insists on their approach. || Defending mine [L] || Trying theirs [H]
- [ ] `alm_basepick_conflict_cooperativeness_06` A friend wants a quieter night than you planned. || Adjusting [H] || Keeping the plan [L]
- [ ] `alm_basepick_conflict_cooperativeness_07` Your roommate wants the thermostat lowered. || Not budging [L] || Okay, sweater [H]
- [ ] `alm_basepick_conflict_cooperativeness_08` Two friends ask you to pick a side. || Finding the middle [H] || Picking what I believe [L]
- [ ] `alm_basepick_conflict_cooperativeness_09` A negotiation is stuck on one point. || Holding the point [L] || Trading for something else [H]
- [ ] `alm_basepick_conflict_cooperativeness_10` A friend wants to leave the party early. || Staying, see you tomorrow [L] || Leaving with them [H]
- [ ] `alm_basepick_conflict_cooperativeness_11` The group splits on which route to take. || Taking mine [L] || Following the majority [H]
- [ ] `alm_basepick_conflict_cooperativeness_12` A coworker asks you to shift your schedule. || Shifting [H] || Offering a different day [L]
- [ ] `alm_basepick_conflict_cooperativeness_13` A friend and you want different trips. || Booking mine [L] || Booking theirs [H]
- [ ] `alm_basepick_conflict_cooperativeness_14` A disagreement is five minutes from resolved. || Conceding a bit [H] || Waiting them out [L]
- [ ] `alm_basepick_conflict_cooperativeness_15` Two plans collide on Saturday. || Keeping mine [L] || Moving mine [H]
- [ ] `alm_basepick_conflict_cooperativeness_16` A team vote ties. || Keeping my vote [L] || Switching my vote [H]
- [ ] `alm_basepick_conflict_cooperativeness_17` A friend says your idea needs changes. || Explaining why not [L] || Taking their edit [H]
- [ ] `alm_basepick_conflict_cooperativeness_18` The group picks a game you dislike. || Playing along [H] || Offering another [L]
- [ ] `alm_basepick_conflict_cooperativeness_19` You’re sure you’re right, and so are they. || Standing firm [L] || Compromising [H]

### `basepick | autonomy`
- [ ] `alm_basepick_autonomy_01` A new project arrives with no instructions. || Asking how it’s usually done [L] || Making my own plan [H]
- [ ] `alm_basepick_autonomy_02` Your manager offers a daily check-in. || A little much [H] || Helpful [L]
- [ ] `alm_basepick_autonomy_03` A friend tells you what they’d do in your place. || Following their lead [L] || Interesting, but my call [H]
- [ ] `alm_basepick_autonomy_04` You’re picking a new hobby. || With a coach [L] || By myself [H]
- [ ] `alm_basepick_autonomy_05` A big decision, two options. || Asking three people [L] || Deciding alone [H]
- [ ] `alm_basepick_autonomy_06` A job where tasks are assigned or a job where you choose them. || Assigned [L] || Choosing mine [H]
- [ ] `alm_basepick_autonomy_07` A trip with a guide or a trip on your own. || On my own [H] || With a guide [L]
- [ ] `alm_basepick_autonomy_08` You get a surprise day off. || My own list [H] || Waiting for ideas [L]
- [ ] `alm_basepick_autonomy_09` A group is stuck waiting for someone to lead. || Waiting for someone [L] || I’ll start [H]
- [ ] `alm_basepick_autonomy_10` A friend hands you a map and says go. || Excellent [H] || Can I get directions? [L]
- [ ] `alm_basepick_autonomy_11` You’re learning a skill online. || Following the course [L] || My own order [H]
- [ ] `alm_basepick_autonomy_12` Your manager says “use your judgment.” || Could you be more specific? [L] || Nice [H]
- [ ] `alm_basepick_autonomy_13` A schedule you set or one set for you. || Set for me [L] || Mine [H]
- [ ] `alm_basepick_autonomy_14` Friends vote on where you should live. || Counting the votes [L] || Thanks, I’ll decide [H]
- [ ] `alm_basepick_autonomy_15` A rule doesn’t make sense to you. || Following it [L] || Asking why [H]
- [ ] `alm_basepick_autonomy_16` You want a new look. || Polling friends [L] || Just doing it [H]
- [ ] `alm_basepick_autonomy_17` Group work or solo work. || Group [L] || Solo [H]
- [ ] `alm_basepick_autonomy_18` A big purchase. || Wanting a second opinion [L] || Deciding by myself [H]
- [ ] `alm_basepick_autonomy_19` Someone offers you a clear plan for your week. || I have my own [H] || Yes please [L]

### `basepick | competence`
- [ ] `alm_basepick_competence_01` Your boss asks who can lead a new task. || Waiting to see [L] || Raising my hand [H]
- [ ] `alm_basepick_competence_02` A repair needs doing and you’ve never done it. || I’ll figure it out [H] || Calling someone [L]
- [ ] `alm_basepick_competence_03` You’re asked to give a toast. || Practicing for days [L] || Sure [H]
- [ ] `alm_basepick_competence_04` A friend asks for advice on something you know well. || Maybe not me [L] || Happy to [H]
- [ ] `alm_basepick_competence_05` A new tool arrives at work. || Slow and careful [L] || Quick study [H]
- [ ] `alm_basepick_competence_06` A job posting wants five years and you have three. || Applying [H] || Not yet [L]
- [ ] `alm_basepick_competence_07` You’re asked to explain something to a group. || Rehearsing first [L] || Winging it [H]
- [ ] `alm_basepick_competence_08` You just finished a project. || Looking for flaws [L] || Proud of it [H]
- [ ] `alm_basepick_competence_09` A new game starts at a party. || Watching one round [L] || Jumping in [H]
- [ ] `alm_basepick_competence_10` A stranger asks you for directions. || Offering to check my phone [L] || A confident answer [H]
- [ ] `alm_basepick_competence_11` You’re asked to decide something quickly at work. || Wanting more info [L] || Deciding [H]
- [ ] `alm_basepick_competence_12` Someone compliments your work. || Oh, it was nothing [L] || Thanks, I worked on it [H]
- [ ] `alm_basepick_competence_13` You’re asked to volunteer for something unfamiliar. || Why not [H] || Not unless I’m ready [L]
- [ ] `alm_basepick_competence_14` An interview question you didn’t prepare for. || Freezing a little [L] || Answering calmly [H]
- [ ] `alm_basepick_competence_15` You’re cooking for ten people. || Panic menu [L] || Easy [H]
- [ ] `alm_basepick_competence_16` Someone asks if you can finish a task by tomorrow. || Let me check first [L] || Yes [H]
- [ ] `alm_basepick_competence_17` A hard problem is on the table. || Making sure I can [L] || Starting [H]
- [ ] `alm_basepick_competence_18` You notice a typo in something you posted. || Fixing it and moving on [H] || Rereading it for days [L]
- [ ] `alm_basepick_competence_19` A friend asks you to teach them. || Sure [H] || I’m not an expert [L]

### `basepick | relatedness`
- [ ] `alm_basepick_relatedness_01` Two weeks to yourself or two weeks with friends. || With friends [H] || To myself [L]
- [ ] `alm_basepick_relatedness_02` A dinner for one or a dinner for six. || Dinner for one [L] || Dinner for six [H]
- [ ] `alm_basepick_relatedness_03` You land a small win at work. || Enjoying it quietly [L] || Telling everyone [H]
- [ ] `alm_basepick_relatedness_04` A hobby to do alone or with people. || Alone [L] || With people [H]
- [ ] `alm_basepick_relatedness_05` A quiet Tuesday evening. || Calling someone [H] || Enjoying the quiet [L]
- [ ] `alm_basepick_relatedness_06` A group trip or a solo trip. || Solo [L] || Group [H]
- [ ] `alm_basepick_relatedness_07` A friend is moving away. || Staying in touch lightly [L] || Planning visits [H]
- [ ] `alm_basepick_relatedness_08` A team role or a solo role. || Team [H] || Solo [L]
- [ ] `alm_basepick_relatedness_09` A work-from-home day. || Perfect [L] || Missing people [H]
- [ ] `alm_basepick_relatedness_10` The neighbors invite you to a block party. || Waving from the window [L] || Heading out [H]
- [ ] `alm_basepick_relatedness_11` A book club or just the book. || Club [H] || Just the book [L]
- [ ] `alm_basepick_relatedness_12` A friend’s dinner is short a chair. || Pulling one up [H] || Taking a polite pass [L]
- [ ] `alm_basepick_relatedness_13` A busy shared house or a quiet apartment. || Quiet apartment [L] || Busy house [H]
- [ ] `alm_basepick_relatedness_14` A long weekend with nothing planned. || Plans with a book [L] || Plans with friends [H]
- [ ] `alm_basepick_relatedness_15` A volunteer day with strangers. || Donating instead [L] || Signing up [H]
- [ ] `alm_basepick_relatedness_16` A big feeling to work through. || Thinking it through alone [L] || Talking it out [H]
- [ ] `alm_basepick_relatedness_17` You’ve just moved to a new city. || Exploring alone [L] || Joining a club [H]
- [ ] `alm_basepick_relatedness_18` A friend asks if you want to just hang out. || I need a reason to go [L] || That sounds great [H]
- [ ] `alm_basepick_relatedness_19` A weekend entirely alone. || Feels empty [H] || Feels full [L]

### `basepick | growth_mindset`
- [ ] `alm_basepick_growth_mindset_01` You fail a first attempt at something new. || Not my thing [L] || Trying again [H]
- [ ] `alm_basepick_growth_mindset_02` A friend is much better at a game you play. || Asking how they do it [H] || Sticking with what I’m good at [L]
- [ ] `alm_basepick_growth_mindset_03` Feedback says your work needs a rewrite. || Defending the draft [L] || Starting the rewrite [H]
- [ ] `alm_basepick_growth_mindset_04` A skill you’ve avoided for years. || Moving on [L] || Starting small [H]
- [ ] `alm_basepick_growth_mindset_05` You’re the beginner in a class. || Wanting to leave [L] || Staying [H]
- [ ] `alm_basepick_growth_mindset_06` You make the same mistake twice. || Shrugging [L] || Studying why [H]
- [ ] `alm_basepick_growth_mindset_07` A coworker is better than you at something. || Learning from them [H] || Keeping to my strengths [L]
- [ ] `alm_basepick_growth_mindset_08` You get a low score on a test. || Looking at what I missed [H] || Putting it away [L]
- [ ] `alm_basepick_growth_mindset_09` A language app sends a reminder. || Deleting the app [L] || One more lesson [H]
- [ ] `alm_basepick_growth_mindset_10` A friend says you’ve changed. || Hope so [H] || Same as ever [L]
- [ ] `alm_basepick_growth_mindset_11` The first lesson goes badly. || That’s that [L] || Keep going [H]
- [ ] `alm_basepick_growth_mindset_12` A hard puzzle. || One more try [H] || Moving on [L]
- [ ] `alm_basepick_growth_mindset_13` Someone suggests a different way to do your routine job. || My way works [L] || Trying it [H]
- [ ] `alm_basepick_growth_mindset_14` An app update changes everything. || Exploring [H] || Hating it [L]
- [ ] `alm_basepick_growth_mindset_15` An article disagrees with what you believe. || Closing the tab [L] || Reading closely [H]
- [ ] `alm_basepick_growth_mindset_16` A friend teaches you something simple. || Forgetting by Friday [L] || Writing it down [H]
- [ ] `alm_basepick_growth_mindset_17` You’re 40 and want to learn piano. || Too late [L] || Starting this week [H]
- [ ] `alm_basepick_growth_mindset_18` Your work gets mixed reviews. || Ignoring them [L] || Learning from them [H]
- [ ] `alm_basepick_growth_mindset_19` You hit a plateau. || Accepting my level [L] || Changing the method [H]

### `basepick | locus_of_control`
- [ ] `alm_basepick_locus_of_control_01` You miss the bus. || Just unlucky [L] || Leaving earlier next time [H]
- [ ] `alm_basepick_locus_of_control_02` A project goes badly. || Looking at what I could change [H] || Blaming circumstances [L]
- [ ] `alm_basepick_locus_of_control_03` You catch a lucky break. || Right place, right time [L] || I earned it [H]
- [ ] `alm_basepick_locus_of_control_04` Your plan falls through. || It wasn’t meant to be [L] || Making a new one [H]
- [ ] `alm_basepick_locus_of_control_05` You get sick right before an event. || Wishing I’d slept more [H] || Bad luck [L]
- [ ] `alm_basepick_locus_of_control_06` A friend drifts away. || People drift [L] || Wondering what I could do [H]
- [ ] `alm_basepick_locus_of_control_07` You get a bad grade. || The test was unfair [L] || Studying differently [H]
- [ ] `alm_basepick_locus_of_control_08` You’re stuck in a traffic jam. || Nothing to do about it [L] || Checking routes next time [H]
- [ ] `alm_basepick_locus_of_control_09` A promotion goes to someone else. || Office politics [L] || Asking what to build [H]
- [ ] `alm_basepick_locus_of_control_10` You oversleep. || Happens [L] || Fixing the alarm [H]
- [ ] `alm_basepick_locus_of_control_11` The weather ruins your plans. || Can’t control it [L] || Having a backup next time [H]
- [ ] `alm_basepick_locus_of_control_12` Your phone breaks. || Bad timing [L] || Buying a case [H]
- [ ] `alm_basepick_locus_of_control_13` A job doesn’t work out. || Wrong fit [L] || What I’d do differently [H]
- [ ] `alm_basepick_locus_of_control_14` Something unexpectedly good happens. || Lucky [L] || I planned for this [H]
- [ ] `alm_basepick_locus_of_control_15` A long streak of bad days. || It will pass [L] || Changing what I can [H]
- [ ] `alm_basepick_locus_of_control_16` Is your future mostly up to you? || Partly luck [L] || Mostly [H]
- [ ] `alm_basepick_locus_of_control_17` You forget a friend’s birthday. || Busy week [L] || My fault [H]
- [ ] `alm_basepick_locus_of_control_18` A recipe flops. || Bad oven [L] || Next time I’ll measure [H]
- [ ] `alm_basepick_locus_of_control_19` Things are going well lately. || Good timing [L] || My habits [H]

### `basepick | self_efficacy`
- [ ] `alm_basepick_self_efficacy_01` A big goal looks far away. || I’m not sure I can [L] || I can get there [H]
- [ ] `alm_basepick_self_efficacy_02` Someone dares you to try karaoke. || Politely no [L] || Grabbing the mic [H]
- [ ] `alm_basepick_self_efficacy_03` A stressful task lands on your desk. || Wondering if I can [L] || I’ll handle it [H]
- [ ] `alm_basepick_self_efficacy_04` The meeting wants a volunteer to speak. || Hoping someone else does [L] || Doing it [H]
- [ ] `alm_basepick_self_efficacy_05` A new language class is open. || Signing up [H] || Not sure I’m able [L]
- [ ] `alm_basepick_self_efficacy_06` A scary phone call is waiting. || Putting it off [L] || Making it now [H]
- [ ] `alm_basepick_self_efficacy_07` You set a hard goal. || Hedging a little [L] || Believing it [H]
- [ ] `alm_basepick_self_efficacy_08` A project with high stakes. || Confident [H] || Nervous [L]
- [ ] `alm_basepick_self_efficacy_09` An unexpected problem appears. || Solving it [H] || Needing help [L]
- [ ] `alm_basepick_self_efficacy_10` You try something and it flops. || Doubting myself [L] || Trying again [H]
- [ ] `alm_basepick_self_efficacy_11` A job you want is a stretch. || Not applying [L] || Applying [H]
- [ ] `alm_basepick_self_efficacy_12` You’re offered a lead role. || Wondering why me [L] || Taking it [H]
- [ ] `alm_basepick_self_efficacy_13` A tough conversation is coming. || Delaying it [L] || I can do this [H]
- [ ] `alm_basepick_self_efficacy_14` A hard dish to cook. || I’ll nail it [H] || Ordering in [L]
- [ ] `alm_basepick_self_efficacy_15` A marathon sign-up opens. || Dreaming about it [L] || Signing up [H]
- [ ] `alm_basepick_self_efficacy_16` Your first day somewhere new. || Nervous [L] || Ready [H]
- [ ] `alm_basepick_self_efficacy_17` A leap: a move, a job, a risk. || Waiting for certainty [L] || Taking it [H]
- [ ] `alm_basepick_self_efficacy_18` A difficult skill. || Others are better at it [L] || I’ll master it [H]
- [ ] `alm_basepick_self_efficacy_19` Someone says, “Can you fix this?” || On it [H] || Not sure [L]

### `basepick | playfulness`
- [ ] `alm_basepick_playfulness_01` A meeting starts with a silly icebreaker. || Waiting for it to end [L] || Joining in [H]
- [ ] `alm_basepick_playfulness_02` A friend sends a ridiculous meme. || A quick smile [L] || Sending five back [H]
- [ ] `alm_basepick_playfulness_03` Rain on a day off. || Splashing in puddles [H] || Reading inside [L]
- [ ] `alm_basepick_playfulness_04` It’s board game night. || Playing carefully [L] || Playing to win and joking [H]
- [ ] `alm_basepick_playfulness_05` A toddler hands you a toy phone. || Smiling and giving it back [L] || Taking the call [H]
- [ ] `alm_basepick_playfulness_06` Someone renames the group chat. || Neutral [L] || Joining in [H]
- [ ] `alm_basepick_playfulness_07` A costume party. || Wearing a hat [L] || Going all in [H]
- [ ] `alm_basepick_playfulness_08` A silly dance starts at a wedding. || By the table [L] || On the floor [H]
- [ ] `alm_basepick_playfulness_09` A friend has a harmless prank idea. || In [H] || Pass [L]
- [ ] `alm_basepick_playfulness_10` There’s an ugly holiday sweater contest. || Not entering [L] || Entering [H]
- [ ] `alm_basepick_playfulness_11` You find a ball pit. || Looking on [L] || Jumping in [H]
- [ ] `alm_basepick_playfulness_12` A coworker does a voice for the printer. || Joining in [H] || Printing [L]
- [ ] `alm_basepick_playfulness_13` A rainy indoor afternoon. || Hide and seek [H] || A crossword [L]
- [ ] `alm_basepick_playfulness_14` A friend dares you to a silly challenge. || Declining [L] || Accepting [H]
- [ ] `alm_basepick_playfulness_15` A long drive. || A podcast [L] || Car karaoke [H]
- [ ] `alm_basepick_playfulness_16` A work party game is announced. || Watching [L] || Playing [H]
- [ ] `alm_basepick_playfulness_17` The first snowfall. || Shoveling [L] || Snowball [H]
- [ ] `alm_basepick_playfulness_18` A pun comes to mind in a serious talk. || Keeping it in [L] || Delivering it [H]
- [ ] `alm_basepick_playfulness_19` A water balloon fight starts. || Staying dry [L] || Joining [H]

## B. Events (next 12 months, 19 events, 159 cards)

Each event has a teaser, lead and build cards, peak lines, an afterglow (first fade day), a callback (next year's lead-in) and a deck fact. The four global events (New Year, Valentine's, Halloween, Christmas) get 3 peak Picks instead of extra lines; every other event gets lines only, because a regional or opt-in event cannot be the one Pick everybody answers. Event Picks carry no trait value. On the two gentle Pick days (Valentine's, Christmas) exactly one option is `[out]`, the "it's just a day for me" way out. Mother's Day, Father's Day, Valentine's and Christmas never assume family, a partner, faith or celebration. `{eventName}` and `{daysInto}` need no alt on an event card. Deck facts are checked against reliable sources.

### `pick | halloween/peak`
- [ ] `alm_pick_halloween_peak_01` The doorbell rings and it’s a tiny dinosaur. || Handing over the full-size bar || Pretending nobody’s home
- [ ] `alm_pick_halloween_peak_02` A costume party tonight, and the costume is... || Elaborate and homemade || Bought in a hurry
- [ ] `alm_pick_halloween_peak_03` A friend starts a horror movie marathon. || Front row || Behind a pillow

### `teaser | halloween/teaser`
- [ ] `alm_teaser_halloween_teaser_01` Somewhere a store already has the pumpkins out.

### `line | halloween/lead`
- [ ] `alm_line_halloween_lead_01` In every group chat, someone is asking about costumes.

### `line | halloween/build`
- [ ] `alm_line_halloween_build_01` The candy aisle has stopped pretending it’s anything else.

### `line | halloween/peak`
- [ ] `alm_line_halloween_peak_01` The candy bowl is already half empty and the bell hasn’t rung.

### `afterglow | halloween/fade`
- [ ] `alm_afterglow_halloween_fade_01` How did Halloween actually go: costume, candy, or couch?

### `callback | halloween/lead`
- [ ] `alm_callback_halloween_lead_01` Last Halloween you picked {lastPick}. Still the same? ~~ Last Halloween was a year ago. Same plans, or something new?

### `fact | halloween`
- [ ] `alm_fact_halloween_01` Halloween traces back to Samhain, an old Gaelic festival that marked the end of the harvest.

### `pick | new_year/peak`
- [ ] `alm_pick_new_year_peak_01` Midnight was one minute away last night. || Counted down out loud || Noticed it was already past
- [ ] `alm_pick_new_year_peak_02` The new year is a blank page. || One big goal || A few small habits
- [ ] `alm_pick_new_year_peak_03` January 1, no plans yet. || A resolutions list || No resolutions this year

### `teaser | new_year/teaser`
- [ ] `alm_teaser_new_year_teaser_01` The year is almost out of pages.

### `line | new_year/lead`
- [ ] `alm_line_new_year_lead_01` Somebody is already asking what everyone is doing for midnight.

### `line | new_year/build`
- [ ] `alm_line_new_year_build_01` The fireworks calendar is filling up, and so is the group chat.

### `line | new_year/peak`
- [ ] `alm_line_new_year_peak_01` A year just started, and it hasn’t done anything wrong yet.

### `afterglow | new_year/fade`
- [ ] `alm_afterglow_new_year_fade_01` Day {daysInto} of the new year. Which resolution is still alive?

### `callback | new_year/lead`
- [ ] `alm_callback_new_year_lead_01` Last New Year you picked {lastPick}. How did that go? ~~ Another New Year is close. What would last year’s version of you say?

### `fact | new_year`
- [ ] `alm_fact_new_year_01` Rome moved the start of its year to January 1 around 153 BCE.

### `pick | valentines/peak`
- [ ] `alm_pick_valentines_peak_01` Valentine’s Day is today. || Planning something small || It’s just a regular day for me [out]
- [ ] `alm_pick_valentines_peak_02` The store has a whole aisle of cards. || Buying one for someone || Walking right past [out]
- [ ] `alm_pick_valentines_peak_03` Someone suggests a group dinner for the day. || Everyone’s invited || Skipping this one [out]

### `teaser | valentines/teaser`
- [ ] `alm_teaser_valentines_teaser_01` Pink and red are quietly taking over a shelf near you.

### `line | valentines/lead`
- [ ] `alm_line_valentines_lead_01` The day for love is close, and for plenty of people it’s just a day.

### `line | valentines/build`
- [ ] `alm_line_valentines_build_01` Hearts in windows, flowers at the counter, and plenty of people ignoring all of it.

### `line | valentines/peak`
- [ ] `alm_line_valentines_peak_01` Love, friends, a good meal, or an ordinary day. All of them count.

### `afterglow | valentines/fade`
- [ ] `alm_afterglow_valentines_fade_01` How did Valentine’s Day actually go, or did it just go by?

### `callback | valentines/lead`
- [ ] `alm_callback_valentines_lead_01` Last Valentine’s Day you picked {lastPick}. Still true? ~~ Valentine’s Day came around last year too. What stuck?

### `fact | valentines`
- [ ] `alm_fact_valentines_01` People have tied Valentine’s Day to romance since poems of the 1300s, Chaucer’s among them.

### `pick | christmas/peak`
- [ ] `alm_pick_christmas_peak_01` Someone brings up the office gift swap today. || Telling the story || It’s just another day for me [out]
- [ ] `alm_pick_christmas_peak_02` Holiday music is playing at the store today. || Humming along || Headphones in, it’s a normal day [out]
- [ ] `alm_pick_christmas_peak_03` Lights are on up and down your street tonight. || Going out to look || Barely noticing [out]

### `teaser | christmas/teaser`
- [ ] `alm_teaser_christmas_teaser_01` Lights are being untangled in a few attics near you.

### `line | christmas/lead`
- [ ] `alm_line_christmas_lead_01` The season is close, and people feel very differently about it.

### `line | christmas/build`
- [ ] `alm_line_christmas_build_01` Queues, cards, and calendars: a busy week for some, an ordinary one for others.

### `line | christmas/peak`
- [ ] `alm_line_christmas_peak_01` Today could be a feast, a movie, a quiet morning, or a regular day.

### `afterglow | christmas/fade`
- [ ] `alm_afterglow_christmas_fade_01` How did the day go: loud, quiet, or somewhere in the middle?

### `callback | christmas/lead`
- [ ] `alm_callback_christmas_lead_01` Last Christmas you picked {lastPick}. Still the same? ~~ Last December had its own plans. What do you want from this one?

### `fact | christmas`
- [ ] `alm_fact_christmas_01` The earliest record of December 25 as Christmas is from Rome in the 300s.

### `teaser | easter/teaser`
- [ ] `alm_teaser_easter_teaser_01` Pastel colors are showing up in the shops.

### `line | easter/lead`
- [ ] `alm_line_easter_lead_01` A long weekend is close for a lot of people.
- [ ] `alm_line_easter_lead_02` Chocolate eggs have been on the shelves for weeks and nobody has questioned it.

### `line | easter/build`
- [ ] `alm_line_easter_build_01` Plans for the long weekend are getting settled, or ignored.

### `line | easter/peak`
- [ ] `alm_line_easter_peak_01` Easter morning: eggs hidden, brunch booked, or a quiet day in.
- [ ] `alm_line_easter_peak_02` However it’s marked, today moves slower than most Sundays.
- [ ] `alm_line_easter_peak_03` Somewhere, someone is finding a chocolate egg in a very odd spot.

### `afterglow | easter/fade`
- [ ] `alm_afterglow_easter_fade_01` How was Easter weekend: rest, a full table, eggs, or none of it?

### `callback | easter/lead`
- [ ] `alm_callback_easter_lead_01` Last Easter is a year behind us. What stayed with you from it?

### `fact | easter`
- [ ] `alm_fact_easter_01` Easter’s date follows a rule tied to the spring equinox and a full moon, so it moves every year.

### `teaser | lunar_new_year/teaser`
- [ ] `alm_teaser_lunar_new_year_teaser_01` Red envelopes and lanterns are showing up in shop windows.

### `line | lunar_new_year/lead`
- [ ] `alm_line_lunar_new_year_lead_01` {eventName} is close. Homes are being cleaned and tables booked.
- [ ] `alm_line_lunar_new_year_lead_02` Plans for the first days of the new year are on their way.

### `line | lunar_new_year/build`
- [ ] `alm_line_lunar_new_year_build_01` The markets are busy and the festive snacks are selling fast.

### `line | lunar_new_year/peak`
- [ ] `alm_line_lunar_new_year_peak_01` A new lunar year starts today, with food, lanterns, and good wishes.
- [ ] `alm_line_lunar_new_year_peak_02` Fireworks, red envelopes, and a table with too much food.
- [ ] `alm_line_lunar_new_year_peak_03` Whether you celebrate or watch from afar, a new lunar year is here.

### `afterglow | lunar_new_year/fade`
- [ ] `alm_afterglow_lunar_new_year_fade_01` How did the New Year days go: busy, joyful, or quiet?

### `callback | lunar_new_year/lead`
- [ ] `alm_callback_lunar_new_year_lead_01` Last Lunar New Year is a year behind us. What do you want from this one?

### `fact | lunar_new_year`
- [ ] `alm_fact_lunar_new_year_01` Lunar New Year follows the new moon, so its date moves between late January and mid-February.

### `teaser | mothers_day/teaser`
- [ ] `alm_teaser_mothers_day_teaser_01` Flowers are starting to show up near every checkout.

### `line | mothers_day/lead`
- [ ] `alm_line_mothers_day_lead_01` {eventName} is close. For some it’s warm, for others it’s complicated.
- [ ] `alm_line_mothers_day_lead_02` Whoever raised you, or whoever you miss, a day like this can bring both to mind.

### `line | mothers_day/build`
- [ ] `alm_line_mothers_day_build_01` Brunch bookings fill up, and some people are quietly skipping the day.

### `line | mothers_day/peak`
- [ ] `alm_line_mothers_day_peak_01` Today can mean a call, a card, a memory, or a quiet day.
- [ ] `alm_line_mothers_day_peak_02` There are many ways to mother someone, and many ways to miss one.
- [ ] `alm_line_mothers_day_peak_03` Mothering shows up in friends, teachers, aunts, and neighbors too.

### `afterglow | mothers_day/fade`
- [ ] `alm_afterglow_mothers_day_fade_01` How did the day sit with you: easy, heavy, or somewhere between?

### `callback | mothers_day/lead`
- [ ] `alm_callback_mothers_day_lead_01` {eventName} came around last year too. Is anything different now?

### `fact | mothers_day`
- [ ] `alm_fact_mothers_day_01` The date for Mother’s Day differs by country, and some places keep it in other months.

### `teaser | fathers_day/teaser`
- [ ] `alm_teaser_fathers_day_teaser_01` Mugs with jokes on them are on display again.

### `line | fathers_day/lead`
- [ ] `alm_line_fathers_day_lead_01` {eventName} is close. Cards and calls for some, a complicated quiet for others.
- [ ] `alm_line_fathers_day_lead_02` Fathers, stepdads, uncles, mentors: the day can mean any of them, or none.

### `line | fathers_day/build`
- [ ] `alm_line_fathers_day_build_01` Plans get made or skipped, depending on who’s around.

### `line | fathers_day/peak`
- [ ] `alm_line_fathers_day_peak_01` Today might be a call, a meal, a memory, or just a regular day.
- [ ] `alm_line_fathers_day_peak_02` There are many ways to be a father figure and many ways to miss one.
- [ ] `alm_line_fathers_day_peak_03` Gratitude, memory, or a regular day: any of them fits.

### `afterglow | fathers_day/fade`
- [ ] `alm_afterglow_fathers_day_fade_01` How did the day sit with you: easy, heavy, or somewhere in between?

### `callback | fathers_day/lead`
- [ ] `alm_callback_fathers_day_lead_01` Last year’s {eventName} is behind us. Has anything shifted since?

### `fact | fathers_day`
- [ ] `alm_fact_fathers_day_01` Father’s Day is in June in many countries and in September in others, like Australia and New Zealand.

### `teaser | thanksgiving_ca/teaser`
- [ ] `alm_teaser_thanksgiving_ca_teaser_01` The leaves are turning and the long weekend is on its way.

### `line | thanksgiving_ca/lead`
- [ ] `alm_line_thanksgiving_ca_lead_01` The long weekend is close, and someone has already claimed the pie.
- [ ] `alm_line_thanksgiving_ca_lead_02` Plans for the long weekend are forming in group chats.

### `line | thanksgiving_ca/build`
- [ ] `alm_line_thanksgiving_ca_build_01` The grocery store has a very specific kind of crowd today.

### `line | thanksgiving_ca/peak`
- [ ] `alm_line_thanksgiving_ca_peak_01` For a lot of tables today, the meal is long and the leftovers are the real prize.
- [ ] `alm_line_thanksgiving_ca_peak_02` For plenty of people today: gratitude, pie, and a nap on the couch, in some order.
- [ ] `alm_line_thanksgiving_ca_peak_03` Full table or quiet day, it still counts as Thanksgiving.

### `afterglow | thanksgiving_ca/fade`
- [ ] `alm_afterglow_thanksgiving_ca_fade_01` How was the long weekend: busy, quiet, or all leftovers?

### `callback | thanksgiving_ca/lead`
- [ ] `alm_callback_thanksgiving_ca_lead_01` Last Thanksgiving is a year behind us. What do you want more of this time?

### `fact | thanksgiving_ca`
- [ ] `alm_fact_thanksgiving_ca_01` Canada’s Thanksgiving is on the second Monday of October, earlier than the US one.

### `teaser | thanksgiving_us/teaser`
- [ ] `alm_teaser_thanksgiving_us_teaser_01` The pie crust debate has started early this year.

### `line | thanksgiving_us/lead`
- [ ] `alm_line_thanksgiving_us_lead_01` Travel plans are being made, and argued over.
- [ ] `alm_line_thanksgiving_us_lead_02` Somebody has asked the group chat who is bringing what.

### `line | thanksgiving_us/build`
- [ ] `alm_line_thanksgiving_us_build_01` The grocery store is a contact sport this week.

### `line | thanksgiving_us/peak`
- [ ] `alm_line_thanksgiving_us_peak_01` For a lot of people, a long meal, a mountain of leftovers, and a nap that counts as plans.
- [ ] `alm_line_thanksgiving_us_peak_02` Gratitude is easier to say with pie in front of you, if there’s pie.
- [ ] `alm_line_thanksgiving_us_peak_03` A table of many, a table of two, or a quiet day. All of it counts.

### `afterglow | thanksgiving_us/fade`
- [ ] `alm_afterglow_thanksgiving_us_fade_01` How was Thanksgiving: full table, small table, or sofa?

### `callback | thanksgiving_us/lead`
- [ ] `alm_callback_thanksgiving_us_lead_01` Last Thanksgiving was a year ago. What would you like more of this time?

### `fact | thanksgiving_us`
- [ ] `alm_fact_thanksgiving_us_01` US Thanksgiving has been the fourth Thursday of November by federal law since 1941.

### `teaser | diwali/teaser`
- [ ] `alm_teaser_diwali_teaser_01` Little clay lamps are starting to appear in shops.

### `line | diwali/lead`
- [ ] `alm_line_diwali_lead_01` {eventName} is close, and homes are being cleaned and decorated.
- [ ] `alm_line_diwali_lead_02` The sweet counters get busier by the day.

### `line | diwali/build`
- [ ] `alm_line_diwali_build_01` Lamps and rangoli are going up, and the streets light up early.

### `line | diwali/peak`
- [ ] `alm_line_diwali_peak_01` Today the lamps are lit, the sweets are out, and the lights stay on late.
- [ ] `alm_line_diwali_peak_02` Diwali celebrates light over darkness, and tonight there is plenty of light.
- [ ] `alm_line_diwali_peak_03` Whether you celebrate or just enjoy the glow, it’s a good night for lamps.

### `afterglow | diwali/fade`
- [ ] `alm_afterglow_diwali_fade_01` How were the Diwali days: busy, bright, or quiet?

### `callback | diwali/lead`
- [ ] `alm_callback_diwali_lead_01` Last Diwali is a year behind us. What would you like more of this time?

### `fact | diwali`
- [ ] `alm_fact_diwali_01` Diwali’s date follows the Hindu lunar calendar, so it lands somewhere in October or November.

### `teaser | eid_al_fitr/teaser`
- [ ] `alm_teaser_eid_al_fitr_teaser_01` Crescent moons and lanterns are showing up in shop windows.

### `line | eid_al_fitr/lead`
- [ ] `alm_line_eid_al_fitr_lead_01` {eventName} is close, and the end of Ramadan is in sight.
- [ ] `alm_line_eid_al_fitr_lead_02` Sweets and new clothes are being sorted for the day.

### `line | eid_al_fitr/build`
- [ ] `alm_line_eid_al_fitr_build_01` The markets are busy, and the last days of Ramadan are quiet and full.

### `line | eid_al_fitr/peak`
- [ ] `alm_line_eid_al_fitr_peak_01` {eventName} is here: a big meal, visits, and a day to gather.
- [ ] `alm_line_eid_al_fitr_peak_02` Eid Mubarak to everyone who celebrates today.
- [ ] `alm_line_eid_al_fitr_peak_03` A day to eat, visit, and give, however it’s marked.

### `afterglow | eid_al_fitr/fade`
- [ ] `alm_afterglow_eid_al_fitr_fade_01` How did the Eid days go: busy, warm, or quiet?

### `callback | eid_al_fitr/lead`
- [ ] `alm_callback_eid_al_fitr_lead_01` Last Eid is a year behind us. What would you like more of this time?

### `fact | eid_al_fitr`
- [ ] `alm_fact_eid_al_fitr_01` Eid al-Fitr ends Ramadan, and its start depends on sighting the new moon.

### `teaser | birthday/teaser`
- [ ] `alm_teaser_birthday_teaser_01` A birthday is on the way, and it’s yours.

### `line | birthday/lead`
- [ ] `alm_line_birthday_lead_01` Your birthday is a few days away.

### `line | birthday/build`
- [ ] `alm_line_birthday_build_01` Your birthday is close. Some years that means plans, some years it doesn’t.

### `line | birthday/peak`
- [ ] `alm_line_birthday_peak_01` Happy birthday, {name}. Today is yours. ~~ Happy birthday. Today is yours.
- [ ] `alm_line_birthday_peak_02` Another year of you. The cake is optional.
- [ ] `alm_line_birthday_peak_03` Whatever today looks like, it’s your birthday.

### `afterglow | birthday/fade`
- [ ] `alm_afterglow_birthday_fade_01` How was your birthday: loud, quiet, or somewhere in between?

### `callback | birthday/lead`
- [ ] `alm_callback_birthday_lead_01` Your last birthday is a year behind you. What do you want from this one?

### `fact | birthday`
- [ ] `alm_fact_birthday_01` In a room of 23 people, there’s about a 50% chance two of them share a birthday.

### `teaser | ato_anniversary/teaser`
- [ ] `alm_teaser_ato_anniversary_teaser_01` Your ATO anniversary is almost here.

### `line | ato_anniversary/lead`
- [ ] `alm_line_ato_anniversary_lead_01` Your ATO anniversary is a few days away.

### `line | ato_anniversary/build`
- [ ] `alm_line_ato_anniversary_build_01` Your ATO anniversary is close, and your answers have added up.

### `line | ato_anniversary/peak`
- [ ] `alm_line_ato_anniversary_peak_01` Happy ATO anniversary.
- [ ] `alm_line_ato_anniversary_peak_02` Another year of answers. Your profile has grown since you started.
- [ ] `alm_line_ato_anniversary_peak_03` You’ve been answering for another year. That’s a lot of small choices.

### `afterglow | ato_anniversary/fade`
- [ ] `alm_afterglow_ato_anniversary_fade_01` Looking back since you joined, which answer would you change?

### `callback | ato_anniversary/lead`
- [ ] `alm_callback_ato_anniversary_lead_01` Your last ATO anniversary is a year behind you. What has changed since?

### `teaser | summer_solstice/teaser`
- [ ] `alm_teaser_summer_solstice_teaser_01` The days have been getting longer for a while now.

### `line | summer_solstice/lead`
- [ ] `alm_line_summer_solstice_lead_01` The longest day is close, and the evenings feel endless.

### `line | summer_solstice/peak`
- [ ] `alm_line_summer_solstice_peak_01` Today has the most daylight of the whole year.

### `line | summer_solstice/fade`
- [ ] `alm_line_summer_solstice_fade_01` The days are getting shorter again, but not by much yet.

### `teaser | summer/teaser`
- [ ] `alm_teaser_summer_teaser_01` The weather is making promises it might keep.

### `line | summer/lead`
- [ ] `alm_line_summer_lead_01` Sunscreen is back in the bag and ice is back in the freezer.

### `line | summer/peak`
- [ ] `alm_line_summer_peak_01` Summer is here: long evenings, cold drinks, and slow afternoons.

### `line | summer/fade`
- [ ] `alm_line_summer_fade_01` There are more summer days left than it feels like.

### `teaser | back_to_school/teaser`
- [ ] `alm_teaser_back_to_school_teaser_01` Backpacks and notebooks are on sale again.

### `line | back_to_school/lead`
- [ ] `alm_line_back_to_school_lead_01` Back-to-school week is close, whether or not it’s your school.

### `line | back_to_school/peak`
- [ ] `alm_line_back_to_school_peak_01` School is back, and so is the early alarm for a lot of people.

### `line | back_to_school/fade`
- [ ] `alm_line_back_to_school_fade_01` The new routine is settling in for everyone.

### `teaser | winter_solstice/teaser`
- [ ] `alm_teaser_winter_solstice_teaser_01` The days have been getting shorter for a while.

### `line | winter_solstice/lead`
- [ ] `alm_line_winter_solstice_lead_01` The shortest day is close, and the evenings come early.

### `line | winter_solstice/peak`
- [ ] `alm_line_winter_solstice_peak_01` Today has the least daylight of the year. From here the days grow.

### `line | winter_solstice/fade`
- [ ] `alm_line_winter_solstice_fade_01` The days are slowly getting longer again.

### `teaser | year_end/teaser`
- [ ] `alm_teaser_year_end_teaser_01` The year is almost done, and a lot of it is already a blur.

### `line | year_end/lead`
- [ ] `alm_line_year_end_lead_01` The last week of the year is here, and the calendar is thin.

### `line | year_end/peak`
- [ ] `alm_line_year_end_peak_01` The year ends soon. What stands out when you look back?

### `line | year_end/fade`
- [ ] `alm_line_year_end_fade_01` The new year is just ahead, and the old one is already fading.


## C. Off-season arcs (4 seasons × 6, 12 months × 4 = 72)

Always on, so Home is never empty. Seasons are shifted for the south, so there is no weather or holiday in a season line. Moment voice, no advice. The 16 week arcs get no cards (their theme is the trait).

### `line | season_sparks`
- [ ] `alm_line_season_sparks_01` A new notebook, a new app, a new plan. Something is starting again.
- [ ] `alm_line_season_sparks_02` The calendar is full of first days, and nobody has failed at any of them yet.
- [ ] `alm_line_season_sparks_03` Somebody near you is starting the thing they said they would start.
- [ ] `alm_line_season_sparks_04` A first attempt is usually a little rough, and that part is normal.
- [ ] `alm_line_season_sparks_05` A fresh start can be as small as a different seat at the table.
- [ ] `alm_line_season_sparks_06` Beginners everywhere are asking a question they think is silly.

### `line | season_bloom`
- [ ] `alm_line_season_bloom_01` Somebody is texting “we should catch up,” and this time they mean it.
- [ ] `alm_line_season_bloom_02` More people are saying yes to plans than a month ago.
- [ ] `alm_line_season_bloom_03` A door gets held, a short chat happens, and the elevator ride goes faster.
- [ ] `alm_line_season_bloom_04` An old friend’s name lights up the screen, and it’s a good surprise.
- [ ] `alm_line_season_bloom_05` A group chat comes alive: a plan, a photo, six replies in a minute.
- [ ] `alm_line_season_bloom_06` A new place opened, and half the people you know have already been.

### `line | season_tides`
- [ ] `alm_line_season_tides_01` Some days run high and some run low, and both come back around.
- [ ] `alm_line_season_tides_02` An afternoon with no plan can turn into the best part of the week.
- [ ] `alm_line_season_tides_03` Somewhere a grown adult is taking a board game very seriously, and loving it.
- [ ] `alm_line_season_tides_04` A bad morning can be gone by dinner when the right person sits down.
- [ ] `alm_line_season_tides_05` Somebody makes a joke in the middle of a serious meeting, and the room breathes out.
- [ ] `alm_line_season_tides_06` Waves come in, waves go out, and most of the day sits somewhere in between.

### `line | season_embers`
- [ ] `alm_line_season_embers_01` Somebody is rereading old messages and smiling at them.
- [ ] `alm_line_season_embers_02` The good lamp is on, a warm drink is made, and the day feels smaller.
- [ ] `alm_line_season_embers_03` A photo from a few years ago turns up, and everyone has an opinion on the haircut.
- [ ] `alm_line_season_embers_04` Old songs come back around, and so do the people who liked them.
- [ ] `alm_line_season_embers_05` A story gets told for the tenth time and still gets a laugh.
- [ ] `alm_line_season_embers_06` The week is slowing down, and some people are only now noticing.

### `line | month_clean_slate`
- [ ] `alm_line_month_clean_slate_01` A new month, and the to-do list got a fresh page.
- [ ] `alm_line_month_clean_slate_02` Some people made resolutions. Some are just glad the busy stretch is over.
- [ ] `alm_line_month_clean_slate_03` The desks are tidy and nobody has fallen behind yet.
- [ ] `alm_line_month_clean_slate_04` A clean slate can be a whole plan or just a clean desk.

### `line | month_soft_spots`
- [ ] `alm_line_month_soft_spots_01` Some days are tender, and nobody has to explain why.
- [ ] `alm_line_month_soft_spots_02` A song comes on and makes somebody soft for three minutes.
- [ ] `alm_line_month_soft_spots_03` Some days make warm things matter more.
- [ ] `alm_line_month_soft_spots_04` A coffee somebody brought you counts for more this month.

### `line | month_curiosity`
- [ ] `alm_line_month_curiosity_01` A rabbit hole is opening somewhere: one question, nineteen tabs.
- [ ] `alm_line_month_curiosity_02` Somebody just said “wait, how does that work?” and the whole table leaned in.
- [ ] `alm_line_month_curiosity_03` A documentary, a library card, a strange fact: good month for all three.
- [ ] `alm_line_month_curiosity_04` Curiosity is a small question you let yourself keep asking.

### `line | month_small_risks`
- [ ] `alm_line_month_small_risks_01` A small risk is sending the text, joining the class, or asking the question.
- [ ] `alm_line_month_small_risks_02` Somebody just hit send on something they weren’t sure about.
- [ ] `alm_line_month_small_risks_03` Most risks this month are about the size of a sentence.
- [ ] `alm_line_month_small_risks_04` A new haircut, a new route, a bold order: small risks add up.

### `line | month_roots`
- [ ] `alm_line_month_roots_01` Some people are planting, some are calling home, some are staying put.
- [ ] `alm_line_month_roots_02` A favorite chair, a regular spot, a friend who knows your order: roots.
- [ ] `alm_line_month_roots_03` Some habits come from somewhere, like the way you make tea.
- [ ] `alm_line_month_roots_04` Familiar places feel a little different when you look at them closely.

### `line | month_halfway`
- [ ] `alm_line_month_halfway_01` Half the year is nearly done, and it went faster than expected.
- [ ] `alm_line_month_halfway_02` Somebody is quietly checking their year so far.
- [ ] `alm_line_month_halfway_03` Halfway is where plenty of people look at what’s finished and what’s still ahead.
- [ ] `alm_line_month_halfway_04` Half a year is long enough for a pattern to show.

### `line | month_play`
- [ ] `alm_line_month_play_01` Somewhere right now, a grown adult is losing a water fight and loving it.
- [ ] `alm_line_month_play_02` The best plans this month have no plan.
- [ ] `alm_line_month_play_03` A game of cards runs two hours longer than it should.
- [ ] `alm_line_month_play_04` Play has no point, and that is the point.

### `line | month_slow_days`
- [ ] `alm_line_month_slow_days_01` The inbox is quieter, the streets are slower, and the day has air in it.
- [ ] `alm_line_month_slow_days_02` Somebody is doing nothing and calling it a plan.
- [ ] `alm_line_month_slow_days_03` A long afternoon with a book, a nap, or a window counts as a full day.
- [ ] `alm_line_month_slow_days_04` Revision, resits, or a lazy week: this stretch holds all three.

### `line | month_fresh_pages`
- [ ] `alm_line_month_fresh_pages_01` A new term, a new job, a new notebook: somewhere, a first page is empty.
- [ ] `alm_line_month_fresh_pages_02` Somebody is writing their name at the top of a fresh page.
- [ ] `alm_line_month_fresh_pages_03` A fresh page can be a plan or just a clean start to Monday.
- [ ] `alm_line_month_fresh_pages_04` Exam season for some, new routines for others, a fresh page for everyone.

### `line | month_masks`
- [ ] `alm_line_month_masks_01` Everyone wears a slightly different face at work, at home, and at a party.
- [ ] `alm_line_month_masks_02` The costume shop is full, and so are the people deciding who to be.
- [ ] `alm_line_month_masks_03` The face you show a coworker isn’t the one you show your best friend, and that’s normal.
- [ ] `alm_line_month_masks_04` A mask is fun when you pick it, and heavy when you don’t.

### `line | month_gratitude_boundaries`
- [ ] `alm_line_month_gratitude_boundaries_01` This month has a lot of thank-yous in it, and the occasional polite no.
- [ ] `alm_line_month_gratitude_boundaries_02` Somebody just said “I can’t make it” and meant it kindly.
- [ ] `alm_line_month_gratitude_boundaries_03` Gratitude can be a text, a nod, or a quiet minute. No speech needed.
- [ ] `alm_line_month_gratitude_boundaries_04` A good yes has a good no sitting next to it.

### `line | month_looking_back`
- [ ] `alm_line_month_looking_back_01` The year is wrapping up, and so are the stories people tell about it.
- [ ] `alm_line_month_looking_back_02` Photos from January look like a different life by now.
- [ ] `alm_line_month_looking_back_03` Some people look back with a list: what changed, what stayed, what surprised.
- [ ] `alm_line_month_looking_back_04` Somebody is scrolling their camera roll and finding things they forgot.

## D. Micro-events (20, all 11 ids)

One-day moments, quiet on purpose. Slot-free, so they never need an alt.

### `line | pick_100`
- [ ] `alm_line_pick_100_01` Your 100th Pick. A hundred small choices have built your profile.

### `line | glow_30`
- [ ] `alm_line_glow_30_01` Thirty days of opening ATO. That’s a streak worth a small cheer.

### `line | one_year_ago`
- [ ] `alm_line_one_year_ago_01` A year ago today you answered a Pick. A lot can change in a year.

### `line | equinox`
- [ ] `alm_line_equinox_01` Day and night are about the same length today, give or take a few minutes.
- [ ] `alm_line_equinox_02` Today light and dark nearly split the clock.

### `line | full_moon`
- [ ] `alm_line_full_moon_01` There’s a full moon tonight, if the sky is clear where you are.
- [ ] `alm_line_full_moon_02` A full moon tonight is a good reason to look up for a minute.

### `line | friday_13th`
- [ ] `alm_line_friday_13th_01` It’s Friday the 13th. Nothing is more likely to go wrong than on any other Friday.
- [ ] `alm_line_friday_13th_02` Friday the 13th: unlucky for some, just Friday for everyone else.

### `line | clock_change`
- [ ] `alm_line_clock_change_01` The clocks changed today, and half the people you know are confused about the time.
- [ ] `alm_line_clock_change_02` One hour moved, and every device caught up at a different moment.

### `line | half_year`
- [ ] `alm_line_half_year_01` July 1: half the year is behind us and half is ahead.

### `line | first_snow`
- [ ] `alm_line_first_snow_01` Snow season is starting for some: boots by the door, hot drinks back on the menu.
- [ ] `alm_line_first_snow_02` Somewhere, someone is waiting for the first snowflake of the year.

### `line | payday_friday`
- [ ] `alm_line_payday_friday_01` Friday in the last week of the month, and plenty of people are checking their account.
- [ ] `alm_line_payday_friday_02` Payday Friday: the week’s last stretch with a little extra in the air.

### `line | small_moment`
- [ ] `alm_line_small_moment_01` Nothing special is happening today, and that’s allowed.
- [ ] `alm_line_small_moment_02` A regular day, with room for one small good thing.
- [ ] `alm_line_small_moment_03` No holiday, no event, just an ordinary day in decent shape.
- [ ] `alm_line_small_moment_04` An ordinary day. A small moment might still show up.

## E. Try-today (160 = 4 per band × 32 bands + 32 for anyone)

Clear voice (`tipRuleViolation` 'try'): one action, doable today, with a reason ("…, so …"). Each band gets four tries that fit it; the low end is written as plainly kind as the high end. The 32 under `any` fit everyone.

### `try | openness:high`
- [ ] `alm_try_openness_h_01` Pick one new thing today, like a different route or a new song, so your curiosity gets some use.
- [ ] `alm_try_openness_h_02` Write down one idea you keep circling, so it stops competing with everything else you’re curious about.
- [ ] `alm_try_openness_h_03` Finish one thing you started before you open something new, so the new thing gets your full attention.
- [ ] `alm_try_openness_h_04` Ask someone what they’ve been into lately, so you get a fresh idea without searching for it.

### `try | openness:low`
- [ ] `alm_try_openness_l_01` Try one small change today, like a different lunch spot, so something new feels less like a risk.
- [ ] `alm_try_openness_l_02` Keep your usual routine and add one new detail, so you get variety without losing what works.
- [ ] `alm_try_openness_l_03` Ask a friend to pick one thing for you this week, so you try something new without having to choose it.
- [ ] `alm_try_openness_l_04` Read about one unfamiliar thing for two minutes, so a quick no doesn’t make the choice.

### `try | conscientiousness:high`
- [ ] `alm_try_conscientiousness_h_01` Leave one hour today unplanned, so you can see what you choose when nothing is on the list.
- [ ] `alm_try_conscientiousness_h_02` Cross out one task you don’t need this week, so the list matches the time you have.
- [ ] `alm_try_conscientiousness_h_03` Send one task at 90% done today, so waiting for perfect doesn’t use up time you could spend elsewhere.
- [ ] `alm_try_conscientiousness_h_04` Plan the rest of today, then stop planning, so the plan stays a help and not a second job.

### `try | conscientiousness:low`
- [ ] `alm_try_conscientiousness_l_01` Pick the one task that matters most today and do it first, so the day has a finished piece in it.
- [ ] `alm_try_conscientiousness_l_02` Set one reminder for the thing you keep forgetting, so it stops taking up space in your head.
- [ ] `alm_try_conscientiousness_l_03` Write down three things for tomorrow before you sleep, so the morning starts with a clear first step.
- [ ] `alm_try_conscientiousness_l_04` Do the first two minutes of a task you’re avoiding, so starting feels smaller than it does now.

### `try | extraversion:high`
- [ ] `alm_try_extraversion_h_01` Spend twenty minutes alone today with no screen, so you can hear what you think before the next plan.
- [ ] `alm_try_extraversion_h_02` Ask one person a question and let them finish the whole answer, so the conversation gets their side too.
- [ ] `alm_try_extraversion_h_03` Text a friend you haven’t spoken to in a while, so your energy for people goes to a real conversation.
- [ ] `alm_try_extraversion_h_04` Spend ten minutes today without talking to anyone, so you can see how rest feels when nobody’s around.

### `try | extraversion:low`
- [ ] `alm_try_extraversion_l_01` Text one friend something small today, like a photo or a link, so staying in touch takes almost no effort.
- [ ] `alm_try_extraversion_l_02` Write down one idea you could share in your next meeting, so it’s ready when the chance comes.
- [ ] `alm_try_extraversion_l_03` Text one friend about a plan, and set your alone time first, so seeing people doesn’t cost you your recharge.
- [ ] `alm_try_extraversion_l_04` Introduce yourself to one new person today, so the next time you see them it’s already easier.

### `try | agreeableness:high`
- [ ] `alm_try_agreeableness_h_01` Say one small preference out loud today, like where to eat, so the group learns what you like.
- [ ] `alm_try_agreeableness_h_02` Wait ten seconds before you say yes to a request, so the answer comes from you and not from habit.
- [ ] `alm_try_agreeableness_h_03` Tell one person one thing you disagree with, kindly, so your opinion becomes part of the picture.
- [ ] `alm_try_agreeableness_h_04` Do one thing today only for yourself, with no explanation needed, so your needs get a turn.

### `try | agreeableness:low`
- [ ] `alm_try_agreeableness_l_01` Say one thing you appreciate about someone today, so they hear it alongside everything else you say.
- [ ] `alm_try_agreeableness_l_02` Before you point out a flaw, name what works, so the person can hear the rest.
- [ ] `alm_try_agreeableness_l_03` Ask a question before you disagree, so you know what the other person means first.
- [ ] `alm_try_agreeableness_l_04` Thank someone for something small today, so warmth is as easy to spot as your honesty.

### `try | steadiness:high`
- [ ] `alm_try_steadiness_h_01` Check in with a friend who’s had a rough week, so your calm reaches someone who doesn’t have any right now.
- [ ] `alm_try_steadiness_h_02` Look back at one stress you shrugged off this week, so you can tell if it was really nothing.
- [ ] `alm_try_steadiness_h_03` Ask someone how they’re really doing, and wait, so you hear what a calm answer can miss.
- [ ] `alm_try_steadiness_h_04` Make a plan for one thing that could go wrong this week, so your calm has a backup.

### `try | steadiness:low`
- [ ] `alm_try_steadiness_l_01` Take a five-minute walk after something stressful, so your body can settle before you decide anything.
- [ ] `alm_try_steadiness_l_02` Write what’s worrying you in one sentence, so it takes up less room than the loop in your head.
- [ ] `alm_try_steadiness_l_03` Wait an hour before you reply to a message that upset you, so your answer comes from after the first wave.
- [ ] `alm_try_steadiness_l_04` Name the feeling in one word before you act on it, so you know what you’re responding to.

### `try | attachment_anxiety:high`
- [ ] `alm_try_attachment_anxiety_h_01` Wait an hour before you send a second message, so the other person has time to reply at their own pace.
- [ ] `alm_try_attachment_anxiety_h_02` When a reply is slow, list two ordinary reasons, so the quiet doesn’t have only one meaning.
- [ ] `alm_try_attachment_anxiety_h_03` Tell a friend one thing you appreciate about them, so the bond feels real without waiting on a reply.
- [ ] `alm_try_attachment_anxiety_h_04` Do one thing for yourself while you wait for a text, so the waiting isn’t the only thing in your hour.

### `try | attachment_anxiety:low`
- [ ] `alm_try_attachment_anxiety_l_01` Check in with a friend who likes to hear from you, so they don’t have to ask first.
- [ ] `alm_try_attachment_anxiety_l_02` Reply to a message within a day, so the other person isn’t left guessing what a quiet stretch means.
- [ ] `alm_try_attachment_anxiety_l_03` Tell a close friend how much a recent plan meant to you, so they know it wasn’t casual for you.
- [ ] `alm_try_attachment_anxiety_l_04` Say out loud when you’re excited to see someone, so they don’t have to read it from your calm.

### `try | attachment_avoidance:high`
- [ ] `alm_try_attachment_avoidance_h_01` Share one small thing about your day with someone close, so they know you without having to ask.
- [ ] `alm_try_attachment_avoidance_h_02` Say yes to one offer of help this week, so people get a chance to show up for you.
- [ ] `alm_try_attachment_avoidance_h_03` Tell a friend when you need a quiet evening, so they don’t have to guess what your distance means.
- [ ] `alm_try_attachment_avoidance_h_04` Reply to one message today that you’d usually leave, so a small silence doesn’t grow into a big one.

### `try | attachment_avoidance:low`
- [ ] `alm_try_attachment_avoidance_l_01` Give a friend an evening to themselves without asking why, so closeness doesn’t feel like a demand.
- [ ] `alm_try_attachment_avoidance_l_02` Ask before you share something heavy, so the other person can choose when they have room.
- [ ] `alm_try_attachment_avoidance_l_03` Spend one afternoon doing something alone, so you have something new to bring back to people.
- [ ] `alm_try_attachment_avoidance_l_04` Check how much a friend wants to talk before you start a long message, so closeness matches their pace.

### `try | conflict_assertiveness:high`
- [ ] `alm_try_conflict_assertiveness_h_01` Ask for the other person’s view before you give yours, so you’re sure you’re answering the real question.
- [ ] `alm_try_conflict_assertiveness_h_02` Take one breath before you push back, so your point lands without the edge.
- [ ] `alm_try_conflict_assertiveness_h_03` List one thing you agree on with someone you disagree with, so you can say it first.
- [ ] `alm_try_conflict_assertiveness_h_04` Let one small thing go today, so your strong points are saved for the ones that matter.

### `try | conflict_assertiveness:low`
- [ ] `alm_try_conflict_assertiveness_l_01` Ask for one small thing today, like a different table, so asking is easier to do when it matters.
- [ ] `alm_try_conflict_assertiveness_l_02` Write down what you want to say before a hard talk, so you can say it in your own words.
- [ ] `alm_try_conflict_assertiveness_l_03` Start one hard sentence with “I’d like,” so you ask for what you want instead of hinting.
- [ ] `alm_try_conflict_assertiveness_l_04` Say a small annoyance out loud this week, so it gets solved while it’s still small.

### `try | conflict_cooperativeness:high`
- [ ] `alm_try_conflict_cooperativeness_h_01` Name what you want before you offer to compromise, so the middle ground starts from both of you.
- [ ] `alm_try_conflict_cooperativeness_h_02` Write down one small request you’d rather say no to, so your yes keeps its weight.
- [ ] `alm_try_conflict_cooperativeness_h_03` Write your view on one open disagreement in a sentence, so you can hold it when the talk starts.
- [ ] `alm_try_conflict_cooperativeness_h_04` Ask yourself what you want here before you answer, so giving way is a choice and not a reflex.

### `try | conflict_cooperativeness:low`
- [ ] `alm_try_conflict_cooperativeness_l_01` Write down what matters most to someone you disagree with, so a fair trade is easier to find.
- [ ] `alm_try_conflict_cooperativeness_l_02` Give way on one small thing today, so the next real disagreement starts with some goodwill.
- [ ] `alm_try_conflict_cooperativeness_l_03` Repeat the other side back in one sentence before you answer, so they know you heard it.
- [ ] `alm_try_conflict_cooperativeness_l_04` List one middle option for a plan that’s stuck, so the group has something to react to.

### `try | autonomy:high`
- [ ] `alm_try_autonomy_h_01` Ask one person for input on a decision this week, so you hear what you can’t see from where you stand.
- [ ] `alm_try_autonomy_h_02` Tell the people involved what you decided and why, so your independence doesn’t look like distance.
- [ ] `alm_try_autonomy_h_03` Let someone else pick the plan today, so you can see how it feels to follow.
- [ ] `alm_try_autonomy_h_04` Share a half-finished idea with a friend, so feedback arrives before you’ve gone far alone.

### `try | autonomy:low`
- [ ] `alm_try_autonomy_l_01` Make one small decision today without asking anyone, so trusting your own call gets some practice.
- [ ] `alm_try_autonomy_l_02` Write your own answer to a question before you ask for advice, so you know what you think first.
- [ ] `alm_try_autonomy_l_03` Pick the plan for one evening this week, so you find out what you like when nobody else is choosing.
- [ ] `alm_try_autonomy_l_04` Choose one task and do it your own way, so your method gets a fair try.

### `try | competence:high`
- [ ] `alm_try_competence_h_01` Ask for feedback on something you feel sure about, so your confidence gets a second opinion.
- [ ] `alm_try_competence_h_02` Give someone a quick lesson in one thing you know today, so the skill gets sharper and they get help.
- [ ] `alm_try_competence_h_03` Pick one task outside your strengths and try it, so you keep learning where you’re not yet good.
- [ ] `alm_try_competence_h_04` Say “I’m not sure” once this week when it’s true, so people trust your yes more.

### `try | competence:low`
- [ ] `alm_try_competence_l_01` Write down three things you did well this week, so your sense of your skill has some evidence.
- [ ] `alm_try_competence_l_02` Say yes to one task you’d normally pass on, so you can see what you can do when you try.
- [ ] `alm_try_competence_l_03` Ask someone who’s done it before for one tip, so you start from their experience and not from zero.
- [ ] `alm_try_competence_l_04` Finish one small thing today and check it off, so there’s a finished thing to point to.

### `try | relatedness:high`
- [ ] `alm_try_relatedness_h_01` Spend one hour alone with something you like, so company is a choice and not a default.
- [ ] `alm_try_relatedness_h_02` Text one person with no plan attached, so the connection isn’t only about doing things.
- [ ] `alm_try_relatedness_h_03` Ask a friend how they like to recharge, so you can plan time together that suits them too.
- [ ] `alm_try_relatedness_h_04` Do one thing today just for you, with no one invited, so what you want shows up clearly.

### `try | relatedness:low`
- [ ] `alm_try_relatedness_l_01` Text one person today for no reason, so staying close takes almost no effort.
- [ ] `alm_try_relatedness_l_02` Reply to one old message today, so a friend knows you still want to hear from them.
- [ ] `alm_try_relatedness_l_03` Tell a friend what you like about spending time with them, so they know your quiet isn’t distance.
- [ ] `alm_try_relatedness_l_04` Plan one small outing with a friend, with a set end time, so it feels easy to say yes.

### `try | growth_mindset:high`
- [ ] `alm_try_growth_mindset_h_01` Pick one skill you’re not good at yet and practice it for ten minutes, so progress shows up in small steps.
- [ ] `alm_try_growth_mindset_h_02` Write down what a mistake taught you this week, so it turns into something you can use.
- [ ] `alm_try_growth_mindset_h_03` Ask for feedback on one thing you worked hard on, so you know what to practice next.
- [ ] `alm_try_growth_mindset_h_04` Take a day off from something you’re improving, so the effort has time to sink in.

### `try | growth_mindset:low`
- [ ] `alm_try_growth_mindset_l_01` Try something you’re not good at for five minutes, so you can see how far a first try gets.
- [ ] `alm_try_growth_mindset_l_02` Look at how someone got good at something, so you can see the hours behind it.
- [ ] `alm_try_growth_mindset_l_03` Write down one thing you can do now that you couldn’t a year ago, so you can see that skills change.
- [ ] `alm_try_growth_mindset_l_04` Ask what you could do differently after a mistake, so one slip stays a single slip.

### `try | locus_of_control:high`
- [ ] `alm_try_locus_of_control_h_01` Name one thing from this week that was outside your control, so you stop paying for it with your own blame.
- [ ] `alm_try_locus_of_control_h_02` Ask a friend which part of a problem is yours and which isn’t, so you spend effort where it can work.
- [ ] `alm_try_locus_of_control_h_03` Give one small decision to someone else this week, so you can see things work out when you let go of it.
- [ ] `alm_try_locus_of_control_h_04` Thank someone who helped with something you did, so you remember it was a team result.

### `try | locus_of_control:low`
- [ ] `alm_try_locus_of_control_l_01` Pick one small thing that’s in your hands today and finish it, so you see an effect from your own choice.
- [ ] `alm_try_locus_of_control_l_02` Write down one thing you did that helped a good outcome, so luck isn’t the only credit.
- [ ] `alm_try_locus_of_control_l_03` Change one small habit this week, so you can see what a change of your own does.
- [ ] `alm_try_locus_of_control_l_04` Ask yourself which part is yours after a setback, so you find something you can still act on.

### `try | self_efficacy:high`
- [ ] `alm_try_self_efficacy_h_01` Check one assumption you’re sure about against a quick fact, so confidence rests on more than a feeling.
- [ ] `alm_try_self_efficacy_h_02` Ask someone who’s done it what went wrong for them, so your plan has the surprises already in it.
- [ ] `alm_try_self_efficacy_h_03` Set a smaller first goal for a big project, so you can finish something this week.
- [ ] `alm_try_self_efficacy_h_04` Tell a friend what you’re about to try, so someone can help if it gets harder than you think.

### `try | self_efficacy:low`
- [ ] `alm_try_self_efficacy_l_01` Do one thing today you’ve been doubting, for just five minutes, so you have proof of how it goes.
- [ ] `alm_try_self_efficacy_l_02` Write down one hard thing you finished before, so you have a record when doubt gets loud.
- [ ] `alm_try_self_efficacy_l_03` Break one big task into three small steps, so you only have to believe in the first one.
- [ ] `alm_try_self_efficacy_l_04` Ask a friend what they’ve seen you handle, so you hear it from someone who watched.

### `try | playfulness:high`
- [ ] `alm_try_playfulness_h_01` Do the serious task you’ve been dreading first, so the rest of the day can be fun.
- [ ] `alm_try_playfulness_h_02` Send a friend one silly thing, like a meme or a voice note, so the play has company.
- [ ] `alm_try_playfulness_h_03` Drop the jokes for one serious moment today, so the other person knows you heard them.
- [ ] `alm_try_playfulness_h_04` Plan one silly thing this week, like a game or a walk with no goal, so fun has a place on the calendar.

### `try | playfulness:low`
- [ ] `alm_try_playfulness_l_01` Do one pointless thing today, like a doodle or a silly voice, so you can see how it feels.
- [ ] `alm_try_playfulness_l_02` Take five minutes for a quick game on your phone, so you can see how a little fun feels midday.
- [ ] `alm_try_playfulness_l_03` Send a friend a funny link, so your warm side is easy to see.
- [ ] `alm_try_playfulness_l_04` Try a small joke in a low-stakes chat, so you can see how people respond.

### `try | any`
- [ ] `alm_try_any_01` Take a glass of water now, before you reach for your phone, so the day has one easy win.
- [ ] `alm_try_any_02` Put your phone in another room for twenty minutes, so you can finish one thing without a buzz.
- [ ] `alm_try_any_03` Walk around the block today, so you get some air and a break from the screen.
- [ ] `alm_try_any_04` Write down one thing you’re looking forward to, so tomorrow has something on it.
- [ ] `alm_try_any_05` Text a friend you haven’t spoken to in a month, so they know you thought of them.
- [ ] `alm_try_any_06` Delete five photos or messages you don’t need, so your phone feels a little lighter.
- [ ] `alm_try_any_07` Put away one small thing on a desk or counter, so the next thing you do starts clean.
- [ ] `alm_try_any_08` Say thank you to someone who did something small today, so they know it was noticed.
- [ ] `alm_try_any_09` Eat one meal today without a screen, so you can taste it.
- [ ] `alm_try_any_10` Go to bed fifteen minutes earlier tonight, so tomorrow starts with a little more room.
- [ ] `alm_try_any_11` Take three minutes to stretch before you sit down to work, so your back gets a break.
- [ ] `alm_try_any_12` Write down one thing that went well today, so your memory of the day isn’t only the problems.
- [ ] `alm_try_any_13` Open a window for five minutes, so the room feels different.
- [ ] `alm_try_any_14` Learn one new fact you can tell someone, so you have something to bring to a conversation.
- [ ] `alm_try_any_15` Finish one small task you started last week, so it stops sitting in the back of your mind.
- [ ] `alm_try_any_16` Call someone you like instead of texting, so you hear their voice for a change.
- [ ] `alm_try_any_17` Put on a full album or playlist today, so the music gets your attention for once.
- [ ] `alm_try_any_18` Leave one email list you never read, so your inbox has a little more room.
- [ ] `alm_try_any_19` Take three slow breaths before your next meeting, so you arrive a bit calmer.
- [ ] `alm_try_any_20` Read ten pages of something you chose, so part of today was yours.
- [ ] `alm_try_any_21` Pick one thing to do first tomorrow and write it down, so the morning has a clear start.
- [ ] `alm_try_any_22` Tell someone something specific you like about them, so the compliment lands as real.
- [ ] `alm_try_any_23` Put away the first thing you see when you get home, so the evening starts with one small thing done.
- [ ] `alm_try_any_24` Make something simple instead of ordering, so you can see how it feels to cook dinner.
- [ ] `alm_try_any_25` Sit outside for ten minutes without your phone, so you can see what’s around you.
- [ ] `alm_try_any_26` Ask someone what the best part of their day was, so the conversation starts with something good.
- [ ] `alm_try_any_27` Set a timer for fifteen minutes and work on one thing, so starting feels small.
- [ ] `alm_try_any_28` Look at your calendar for next week and cancel one thing, so you have some breathing room.
- [ ] `alm_try_any_29` Give yourself a small treat you’ve been looking forward to, so the day has a bright spot.
- [ ] `alm_try_any_30` Write a message you’ve been meaning to send, so it’s off your mind.
- [ ] `alm_try_any_31` Go for a short walk once an hour for the rest of today, so your body doesn’t stay in one position.
- [ ] `alm_try_any_32` Check how you’re doing before you answer “fine” today, so the answer is closer to true.

## F. Reflect (60 = 45 any day + 15 Sundays)

A question, no advice. Shares the try slot on Insights; the Sunday ones only show on Sundays.

### `reflect | any`
- [ ] `alm_reflect_any_01` What was the best five minutes of today so far?
- [ ] `alm_reflect_any_02` Which message did you answer faster than you needed to this week?
- [ ] `alm_reflect_any_03` What did you say yes to this week that you’d skip next time?
- [ ] `alm_reflect_any_04` Who crossed your mind today for no reason?
- [ ] `alm_reflect_any_05` What’s one thing you did this week just because you wanted to?
- [ ] `alm_reflect_any_06` When did you last feel like you had enough time?
- [ ] `alm_reflect_any_07` What small thing made the day easier?
- [ ] `alm_reflect_any_08` Which tab, app, or task keeps getting left open?
- [ ] `alm_reflect_any_09` What would you tell yourself from a year ago?
- [ ] `alm_reflect_any_10` What did you change your mind about recently?
- [ ] `alm_reflect_any_11` When did you last laugh at something small?
- [ ] `alm_reflect_any_12` What are you looking forward to, even a little?
- [ ] `alm_reflect_any_13` Which choice this week felt the most like you?
- [ ] `alm_reflect_any_14` What did you do today that nobody saw?
- [ ] `alm_reflect_any_15` What has been taking more of your attention than it deserves?
- [ ] `alm_reflect_any_16` What did you learn this week, even by accident?
- [ ] `alm_reflect_any_17` Who made your week better, and do they know?
- [ ] `alm_reflect_any_18` What would an easy version of tomorrow look like?
- [ ] `alm_reflect_any_19` Which habit would you keep if you could only keep one?
- [ ] `alm_reflect_any_20` When did you feel most relaxed this week?
- [ ] `alm_reflect_any_21` What’s a small thing you’re proud of lately?
- [ ] `alm_reflect_any_22` What do you reach for when you need to feel better?
- [ ] `alm_reflect_any_23` What did you put off this week, and was it worth waiting?
- [ ] `alm_reflect_any_24` Where did your time actually go this week?
- [ ] `alm_reflect_any_25` What question has been sitting in the back of your mind?
- [ ] `alm_reflect_any_26` What’s one thing you’d like more of next week?
- [ ] `alm_reflect_any_27` What’s one thing you’d like less of?
- [ ] `alm_reflect_any_28` When did you last do something for the first time?
- [ ] `alm_reflect_any_29` What did you notice today that you usually miss?
- [ ] `alm_reflect_any_30` Which conversation this week stuck with you?
- [ ] `alm_reflect_any_31` What are you holding that you could set down?
- [ ] `alm_reflect_any_32` What do you do differently from a year ago?
- [ ] `alm_reflect_any_33` What made you pause today?
- [ ] `alm_reflect_any_34` Which small plan did you actually follow through on?
- [ ] `alm_reflect_any_35` What’s the last thing that surprised you?
- [ ] `alm_reflect_any_36` How did you start today, and how would you like to start tomorrow?
- [ ] `alm_reflect_any_37` Who would you like to hear from this week?
- [ ] `alm_reflect_any_38` What do you want to remember from this week?
- [ ] `alm_reflect_any_39` What felt heavier than it needed to be?
- [ ] `alm_reflect_any_40` What felt lighter than you expected?
- [ ] `alm_reflect_any_41` What do you do when nobody tells you what to do?
- [ ] `alm_reflect_any_42` Which of your answers lately surprised you?
- [ ] `alm_reflect_any_43` What’s a small thing you keep meaning to do?
- [ ] `alm_reflect_any_44` What made today different from yesterday?
- [ ] `alm_reflect_any_45` Which part of the day is yours?

### `reflect | any@0`
- [ ] `alm_reflect_any_46` Looking back at the week, what do you want to carry into the next one?
- [ ] `alm_reflect_any_47` What was this week’s best moment, and what made it good?
- [ ] `alm_reflect_any_48` What’s one thing from this week you’d happily do again?
- [ ] `alm_reflect_any_49` What’s one thing from this week you’d happily skip?
- [ ] `alm_reflect_any_50` What do you want from the week ahead?
- [ ] `alm_reflect_any_51` How did you feel at the start of the week, and how do you feel now?
- [ ] `alm_reflect_any_52` What did you finish this week, even if it was small?
- [ ] `alm_reflect_any_53` What are you leaving unfinished, and is that okay?
- [ ] `alm_reflect_any_54` Who do you want to see or talk to this week?
- [ ] `alm_reflect_any_55` What would make Monday easier?
- [ ] `alm_reflect_any_56` What did this week teach you about how you work?
- [ ] `alm_reflect_any_57` Which day of the week felt the most like you?
- [ ] `alm_reflect_any_58` What’s the one thing you want to get done early this week?
- [ ] `alm_reflect_any_59` What went better than you expected this week?
- [ ] `alm_reflect_any_60` What are you ready to put down before the week starts?

## G. Recaps (40 = 14 week + 12 month + 14 year)

Slots can be empty, so a slot card carries an alt. A recap is a question or a small observation, never a score. A year recap never assumes a celebration.

### `week | any`
- [ ] `alm_week_any_01` Your week in you: your answers leaned {axis} ({axisPct}%). Does it match how it felt? ~~ Your week in you: another week of answers. Does it match how it felt?
- [ ] `alm_week_any_02` This week your answers leaned {axis}. What were you doing when that showed up? ~~ This week added more answers to your profile. What stood out?
- [ ] `alm_week_any_03` Your streak is at {streak}, one morning at a time. ~~ Another week of showing up. That’s worth a nod.
- [ ] `alm_week_any_04` One week, a handful of answers. Which one would you answer differently now?
- [ ] `alm_week_any_05` Another week of small choices. Which one felt the most like you?
- [ ] `alm_week_any_06` Week done. What do you want more of in the next one?
- [ ] `alm_week_any_07` A week is long enough to show a pattern and short enough to change it.
- [ ] `alm_week_any_08` Your week in you: some answers were easy, some took thought. Which took the most?
- [ ] `alm_week_any_09` {name}, another week is in the books. What’s one thing worth keeping? ~~ Another week is in the books. What’s one thing worth keeping?
- [ ] `alm_week_any_10` This week’s lean: {axis}, {axisPct}%. A week is a small sample, so hold it lightly. ~~ This week’s lean is still taking shape. A week is a small sample.
- [ ] `alm_week_any_11` Seven more days of answers. Your profile is a little clearer than last Sunday.
- [ ] `alm_week_any_12` Sunday check: which answer this week would you give again?
- [ ] `alm_week_any_13` The week’s done. Your answers stay, and Monday starts fresh.
- [ ] `alm_week_any_14` Your week in you: the quiet days count too. Which one was yours?

### `month | month_clean_slate`
- [ ] `alm_month_month_clean_slate_01` A new month, a clean slate. What shifted in your answers since last month?

### `month | month_soft_spots`
- [ ] `alm_month_month_soft_spots_01` A soft month. What shifted in how you answer, and what stayed the same?

### `month | month_curiosity`
- [ ] `alm_month_month_curiosity_01` A curious month. Which answer would you change now, and which would you keep?

### `month | month_small_risks`
- [ ] `alm_month_month_small_risks_01` A month of small risks. What shifted in your answers since last month?

### `month | month_roots`
- [ ] `alm_month_month_roots_01` A month for roots. What stayed steady in your answers, and what moved?

### `month | month_halfway`
- [ ] `alm_month_month_halfway_01` Halfway through the year. What shifted in your answers since it began?

### `month | month_play`
- [ ] `alm_month_month_play_01` A playful month. What shifted when you weren’t taking it so seriously?

### `month | month_slow_days`
- [ ] `alm_month_month_slow_days_01` A slow month. What shifted in your answers when the pace dropped?

### `month | month_fresh_pages`
- [ ] `alm_month_month_fresh_pages_01` A fresh start. What shifted in your answers since the month before?

### `month | month_masks`
- [ ] `alm_month_month_masks_01` The month of masks. Which of your answers felt the most like yours?

### `month | month_gratitude_boundaries`
- [ ] `alm_month_month_gratitude_boundaries_01` A month of thanks and no’s. What shifted in your answers since last month?

### `month | month_looking_back`
- [ ] `alm_month_month_looking_back_01` Looking back on the month: what shifted, and what are you glad stayed?

### `year | any`
- [ ] `alm_year_any_01` Your year in you, {name}: a year of small answers adds up to a picture. ~~ Your year in you: a year of small answers adds up to a picture.
- [ ] `alm_year_any_02` This year your answers leaned {axis} ({axisPct}%). ~~ This year your answers added up to a picture.
- [ ] `alm_year_any_03` Your strongest lean this year: {axis}. Does it still feel true? ~~ Your answers have added up this year. Does the picture feel true?
- [ ] `alm_year_any_04` A year of Picks: small either-or choices that say more than they seem to.
- [ ] `alm_year_any_05` Some answers changed over the year. That isn’t a flaw. It’s a year.
- [ ] `alm_year_any_06` Your streak is at {streak} right now. Every day counts. ~~ Showing up counts, and you did, again and again.
- [ ] `alm_year_any_07` Your profile looks different from when you started, and it will keep changing.
- [ ] `alm_year_any_08` The year had loud moments and quiet ones. Your answers had both.
- [ ] `alm_year_any_09` What surprised you most about your answers this year?
- [ ] `alm_year_any_10` One year of answers. Which one would you change?
- [ ] `alm_year_any_11` The picture isn’t finished. Next year adds more to it.
- [ ] `alm_year_any_12` Your profile shows how you answered this year. Next year may show something new.
- [ ] `alm_year_any_13` A year of choices, big and small. Which one are you glad about?
- [ ] `alm_year_any_14` The year is almost done. Your answers stay, and a fresh page starts soon.

## H. Year archetype names (32, one per band, 32 characters at most)

The name your year recap shows. Both ends are written to feel equally good to be.

### `archetype | openness:high`
- [ ] `alm_archetype_openness_h_01` The Wanderer

### `archetype | openness:low`
- [ ] `alm_archetype_openness_l_01` The Regular

### `archetype | conscientiousness:high`
- [ ] `alm_archetype_conscientiousness_h_01` The Planner

### `archetype | conscientiousness:low`
- [ ] `alm_archetype_conscientiousness_l_01` The Improviser

### `archetype | extraversion:high`
- [ ] `alm_archetype_extraversion_h_01` The Spark

### `archetype | extraversion:low`
- [ ] `alm_archetype_extraversion_l_01` The Anchor

### `archetype | agreeableness:high`
- [ ] `alm_archetype_agreeableness_h_01` The Peacemaker

### `archetype | agreeableness:low`
- [ ] `alm_archetype_agreeableness_l_01` The Straight Talker

### `archetype | steadiness:high`
- [ ] `alm_archetype_steadiness_h_01` The Steady Hand

### `archetype | steadiness:low`
- [ ] `alm_archetype_steadiness_l_01` The Deep Feeler

### `archetype | attachment_anxiety:high`
- [ ] `alm_archetype_attachment_anxiety_h_01` The Checker-In

### `archetype | attachment_anxiety:low`
- [ ] `alm_archetype_attachment_anxiety_l_01` The Calm Connector

### `archetype | attachment_avoidance:high`
- [ ] `alm_archetype_attachment_avoidance_h_01` The Self-Reliant

### `archetype | attachment_avoidance:low`
- [ ] `alm_archetype_attachment_avoidance_l_01` The Open Book

### `archetype | conflict_assertiveness:high`
- [ ] `alm_archetype_conflict_assertiveness_h_01` The Direct Voice

### `archetype | conflict_assertiveness:low`
- [ ] `alm_archetype_conflict_assertiveness_l_01` The Quiet Observer

### `archetype | conflict_cooperativeness:high`
- [ ] `alm_archetype_conflict_cooperativeness_h_01` The Bridge Builder

### `archetype | conflict_cooperativeness:low`
- [ ] `alm_archetype_conflict_cooperativeness_l_01` The Ground Holder

### `archetype | autonomy:high`
- [ ] `alm_archetype_autonomy_h_01` The Solo Pilot

### `archetype | autonomy:low`
- [ ] `alm_archetype_autonomy_l_01` The Team Player

### `archetype | competence:high`
- [ ] `alm_archetype_competence_h_01` The Go-To

### `archetype | competence:low`
- [ ] `alm_archetype_competence_l_01` The Careful Builder

### `archetype | relatedness:high`
- [ ] `alm_archetype_relatedness_h_01` The Gatherer

### `archetype | relatedness:low`
- [ ] `alm_archetype_relatedness_l_01` The Solo Thinker

### `archetype | growth_mindset:high`
- [ ] `alm_archetype_growth_mindset_h_01` The Eager Learner

### `archetype | growth_mindset:low`
- [ ] `alm_archetype_growth_mindset_l_01` The Specialist

### `archetype | locus_of_control:high`
- [ ] `alm_archetype_locus_of_control_h_01` The Driver

### `archetype | locus_of_control:low`
- [ ] `alm_archetype_locus_of_control_l_01` The Tide Rider

### `archetype | self_efficacy:high`
- [ ] `alm_archetype_self_efficacy_h_01` The Can-Do

### `archetype | self_efficacy:low`
- [ ] `alm_archetype_self_efficacy_l_01` The Humble Starter

### `archetype | playfulness:high`
- [ ] `alm_archetype_playfulness_h_01` The Playmaker

### `archetype | playfulness:low`
- [ ] `alm_archetype_playfulness_l_01` The Serious Mind
