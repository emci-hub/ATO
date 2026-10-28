/**
 * Today's Pick (emci, 2026-10-05): one either/or question a day, the SAME
 * question for everyone that day, answered with one tap. It replaces the
 * daily line on Home. Each pick is about one trait: one answer leans to the
 * trait's high end (value 0.8), the other to its low end (0.2), in the order
 * shown (the high side is not always first).
 *
 * Written in the moment voice (lib/voice/moment-voice.ts): one concrete
 * modern moment, teased kindly, no advice, no slang, never "you are" as a
 * label on the reader (a scene like "You’re stuck in a traffic jam." is fine;
 * the appended Almanac Picks use it, emci-approved 2026-10-28).
 * Accepted by emci 2026-10-23 (roadmap A4).
 *
 * The server keeps the same list (supabase/migrations/wave82_daily_pick.sql,
 * generated from this file by scripts/gen-wave82-picks.ts) and checks every
 * answer against it. Change a pick here, then regenerate the SQL.
 */
import type { TraitAxis } from '@/lib/traits';
import { daysBetweenYmd } from '@/lib/local-date';

export const DAILY_PICK_COPY_REVIEWED = true; // emci accepted 2026-10-23 (roadmap A4)

export interface DailyPickOption {
  text: string;
  /** 0.8 = the trait's high end, 0.2 = its low end. */
  value: number;
}

export interface DailyPick {
  /** Stable id, 'p01'… — the server's key too. */
  id: string;
  axis: TraitAxis;
  prompt: string;
  options: readonly [DailyPickOption, DailyPickOption];
}

const H = 0.8;
const L = 0.2;

function pick(n: number, axis: TraitAxis, prompt: string, a: [string, number], b: [string, number]): DailyPick {
  return {
    id: `p${String(n).padStart(2, '0')}`,
    axis,
    prompt,
    options: [
      { text: a[0], value: a[1] },
      { text: b[0], value: b[1] },
    ],
  };
}

export const DAILY_PICKS: readonly DailyPick[] = [
  // Curiosity (Adventurous / Familiar)
  pick(1, 'openness', 'The group chat suggests a restaurant none of you can pronounce.', ['I’m in', H], ['Our usual place?', L]),
  pick(2, 'openness', 'Your playlist ended and autoplay picked a song you’ve never heard.', ['Back to my songs', L], ['Let it play', H]),
  pick(3, 'openness', 'A friend sends a 40-minute video essay at midnight.', ['Watching it now', H], ['Saved for never', L]),
  pick(4, 'openness', 'The app you open every day just redesigned everything.', ['Where did it all go', L], ['Ooh, new buttons', H]),
  // Follow-through (Structured / Flexible)
  pick(5, 'conscientiousness', 'Sunday night. Monday’s calendar is already three colors.', ['Plan the week now', H], ['Monday’s problem', L]),
  pick(6, 'conscientiousness', 'You told someone you’d reply to their long email “later.”', ['Later is a feeling', L], ['Reminder set', H]),
  pick(7, 'conscientiousness', 'The trip is in two weeks. The group chat has zero plans.', ['Starting the doc', H], ['We’ll figure it out', L]),
  pick(8, 'conscientiousness', 'Your phone says 2% and the charger is in another room.', ['See how far it goes', L], ['Go get it', H]),
  // Sociability (Outgoing / Reserved)
  pick(9, 'extraversion', 'Someone in the group chat asks, “who’s around tonight?”', ['Me!', H], ['Typed it, deleted it', L]),
  pick(10, 'extraversion', 'Plans got cancelled an hour before.', ['A quiet win', L], ['Who else is free?', H]),
  pick(11, 'extraversion', 'A four-minute voice note arrives.', ['Calling them back', H], ['Reading the transcript', L]),
  pick(12, 'extraversion', 'You walk into a party and know exactly one person.', ['Stuck to that person', L], ['New people, let’s go', H]),
  // Harmony (Easygoing / Frank)
  pick(13, 'agreeableness', 'Everyone wants pizza. You wanted literally anything else.', ['Pizza’s fine', H], ['Counteroffer: tacos', L]),
  pick(14, 'agreeableness', 'A friend asks if their new haircut looks good. It doesn’t.', ['The honest answer', L], ['Something kind and true', H]),
  pick(15, 'agreeableness', 'The group picks a movie you’ve already seen twice.', ['Third time it is', H], ['Pitch another one', L]),
  pick(16, 'agreeableness', 'Someone reheats fish in the office microwave.', ['Say something', L], ['Let it go', H]),
  // Composure (Steady / Sensitive)
  pick(17, 'steadiness', 'Your boss sends “got a minute?” with no context.', ['Probably nothing', H], ['Replaying the whole week', L]),
  pick(18, 'steadiness', 'Your flight is delayed and the gate keeps changing.', ['Refreshing the app', L], ['Snack and wait', H]),
  pick(19, 'steadiness', 'You hit send and spot the typo one second later.', ['It’s fine', H], ['Replaying it tonight', L]),
  pick(20, 'steadiness', 'The Wi-Fi drops halfway through your video call.', ['Quiet panic', L], ['Rejoin and keep going', H]),
  // Reassurance (Watchful / Trusting)
  pick(21, 'attachment_anxiety', 'They left you on read for three hours.', ['Double-text', H], ['Wait it out', L]),
  pick(22, 'attachment_anxiety', 'Your friend’s whole reply is “k.”', ['They’re busy', L], ['What did I do', H]),
  pick(23, 'attachment_anxiety', 'The typing bubble appears, disappears, appears again.', ['Watching it closely', H], ['Phone down', L]),
  pick(24, 'attachment_anxiety', 'Your friends posted a hangout you weren’t at.', ['Glad they had fun', L], ['Wait, when was this', H]),
  // Personal space (Private / Close)
  // p65 replaced p25 at this position (emci 2026-10-19): declining to share a location is a
  // boundary, not distance. p25 keeps its original text in RETIRED_DAILY_PICKS for old answers.
  // Options measure how much effort goes into answering a bid for connection (a joke is not scored as distance).
  pick(65, 'attachment_avoidance', 'A friend texts “I miss you” out of nowhere.', ['Call them tonight', L], ['Send a heart, back to it', H]),
  pick(26, 'attachment_avoidance', 'A friend asks, “how are you, really?”', ['Okay, so…', L], ['Fine, haha', H]),
  pick(27, 'attachment_avoidance', 'Your phone lights up: “can we talk tonight?”', ['Need a minute first', H], ['Call me now', L]),
  pick(28, 'attachment_avoidance', 'Movie night: one couch, five people.', ['Pile on', L], ['Claim the armrest', H]),
  // Directness (Direct / Quiet)
  pick(29, 'conflict_assertiveness', 'The barista got your order wrong.', ['Ask them to fix it', H], ['Drink it anyway', L]),
  pick(30, 'conflict_assertiveness', 'A friend keeps “borrowing” your charger.', ['Buy another charger', L], ['Bring it up', H]),
  pick(31, 'conflict_assertiveness', 'Your idea got credited to someone else in the meeting.', ['Speak up', H], ['Let it slide', L]),
  pick(32, 'conflict_assertiveness', 'The group chat’s plan doesn’t work for you.', ['Make it work anyway', L], ['Say so', H]),
  // Compromise (Giving / Steadfast)
  pick(33, 'conflict_cooperativeness', 'Two friends want different weekends for the trip.', ['Find a middle', H], ['Back the better one', L]),
  pick(34, 'conflict_cooperativeness', 'You and your roommate both reach for the last slice.', ['Called it first', L], ['Split it', H]),
  pick(35, 'conflict_cooperativeness', 'The thermostat war has started again.', ['Meet in the middle', H], ['Hold the line', L]),
  pick(36, 'conflict_cooperativeness', 'Your friend wants sushi. You want burgers.', ['Burger night', L], ['A place with both', H]),
  // Independence (Self-directed / Guided)
  pick(37, 'autonomy', 'There’s a step-by-step guide. There’s also your gut.', ['Gut', H], ['The guide', L]),
  pick(38, 'autonomy', 'Flat-pack furniture. The manual is 40 pages.', ['Page one', L], ['Wing it', H]),
  pick(39, 'autonomy', 'Your boss says, “do it however you want.”', ['Finally', H], ['But how do they want it', L]),
  pick(40, 'autonomy', 'Everyone else booked the group tour.', ['Joining the tour', L], ['Exploring solo', H]),
  // Confidence (Assured / Cautious)
  pick(41, 'competence', 'Someone asks who can fix the printer.', ['I’ll take a look', H], ['Not it', L]),
  pick(42, 'competence', 'A new tool at work. No tutorial.', ['Wait for the training', L], ['Figure it out', H]),
  pick(43, 'competence', 'Karaoke. Your name is next on the screen.', ['Grab the mic', H], ['Pass the mic', L]),
  pick(44, 'competence', 'The recipe says “easy, 20 minutes.”', ['Ordering backup', L], ['Easy, sure', H]),
  // Connection (Connected / Self-contained)
  pick(45, 'relatedness', 'Good news just landed.', ['Telling everyone', H], ['Enjoying it alone first', L]),
  pick(46, 'relatedness', 'A free Saturday with nothing planned.', ['A day to myself', L], ['Texting everyone', H]),
  pick(47, 'relatedness', 'Your birthday is next week.', ['Party planning', H], ['Low-key, please', L]),
  pick(48, 'relatedness', 'Someone you haven’t talked to in a year liked your post.', ['Like one of theirs', L], ['Message them', H]),
  // Growth (Learning / Settled)
  pick(49, 'growth_mindset', 'You lost the board game. Badly.', ['Rematch', H], ['Not my game', L]),
  pick(50, 'growth_mindset', 'The language app says you’ve missed six days.', ['Maybe not for me', L], ['Back at it today', H]),
  pick(51, 'growth_mindset', 'Someone corrects how you pronounce a word.', ['Oh, thanks', H], ['Keeping mine', L]),
  pick(52, 'growth_mindset', 'First pottery class. Your bowl came out a plate.', ['Plates are fine', L], ['Next one’s a bowl', H]),
  // Ownership (Accountable / Accepting)
  pick(53, 'locus_of_control', 'You missed the train by one minute.', ['Should’ve left earlier', H], ['Trains, honestly', L]),
  pick(54, 'locus_of_control', 'The group project went sideways.', ['Some things just happen', L], ['What could I change', H]),
  pick(55, 'locus_of_control', 'Your plant died. Again.', ['Overwatered it', H], ['Bad plant luck', L]),
  pick(56, 'locus_of_control', 'You slept through the alarm.', ['The alarm’s fault', L], ['Snoozed it myself', H]),
  // Self-belief (Bold / Hesitant)
  pick(57, 'self_efficacy', 'The job post asks for five years. You have three.', ['Applying anyway', H], ['Not ready yet', L]),
  pick(58, 'self_efficacy', 'Someone dares you to text first.', ['A draft, forever', L], ['Sending it', H]),
  pick(59, 'self_efficacy', 'The open mic sign-up sheet is right there.', ['Writing my name', H], ['Just watching', L]),
  pick(60, 'self_efficacy', 'The hike has a harder trail option.', ['The nice one', L], ['The harder one', H]),
  // Playfulness (Playful / Serious)
  pick(61, 'playfulness', 'The meeting starts with an icebreaker.', ['Going all in', H], ['Shortest answer possible', L]),
  pick(62, 'playfulness', 'The group chat is just memes at this point.', ['Muted', L], ['Adding more', H]),
  pick(63, 'playfulness', 'Someone suggests matching costumes.', ['Obviously yes', H], ['No thanks', L]),
  pick(64, 'playfulness', 'A kid challenges you to a dance-off in the supermarket.', ['Polite smile', L], ['Accepted', H]),
  // ── Appended by PHASE-11d (emci approved 2026-10-28, docs/almanac-review.md section A) ──
  // 19 more per trait, p66…p369, in TRAIT_AXES order. Append only: ids and order are forever.
  // openness (alm_basepick_openness_*)
  pick(66, 'openness', 'A coworker brings in a snack from a country you’ve never visited.', ['I’ll try it', H], ['I’ll stick to my snack', L]), // alm_basepick_openness_01
  pick(67, 'openness', 'Your streaming app suggests a subtitled film from a genre you skip.', ['Back to my regulars', L], ['Press play', H]), // alm_basepick_openness_02
  pick(68, 'openness', 'The menu has one dish you can’t picture.', ['Ordering what I know', L], ['Ordering that one', H]), // alm_basepick_openness_03
  pick(69, 'openness', 'A friend offers to teach you a hobby you’ve never heard of.', ['Sure, when?', H], ['I have enough hobbies', L]), // alm_basepick_openness_04
  pick(70, 'openness', 'Your route home is blocked and the detour goes down a street you’ve never walked.', ['Kind of fun', H], ['Back to the main road', L]), // alm_basepick_openness_05
  pick(71, 'openness', 'The bookstore has a staff-picks table of authors you’ve never read.', ['Heading to my usual shelf', L], ['Buying the odd one', H]), // alm_basepick_openness_06
  pick(72, 'openness', 'A new coffee shop opens next to your regular one.', ['Trying it tomorrow', H], ['Loyal to my regular', L]), // alm_basepick_openness_07
  pick(73, 'openness', 'You’re handed a blank weekend with no plans.', ['A favorite, again', L], ['Something I’ve never done', H]), // alm_basepick_openness_08
  pick(74, 'openness', 'The community center has a workshop in something you know nothing about.', ['Not my area', L], ['Signing up', H]), // alm_basepick_openness_10
  pick(75, 'openness', 'Your usual takeout is closed on a Friday night.', ['A new place it is', H], ['Cooking something familiar', L]), // alm_basepick_openness_11
  pick(76, 'openness', 'A stranger at a party describes a job you didn’t know existed.', ['Nodding politely', L], ['Asking ten questions', H]), // alm_basepick_openness_12
  pick(77, 'openness', 'There’s a festival in town celebrating a tradition you’ve never seen.', ['Going', H], ['Watching clips later', L]), // alm_basepick_openness_13
  pick(78, 'openness', 'Your phone offers to switch to a layout you’ve never used.', ['Keeping my layout', L], ['Why not', H]), // alm_basepick_openness_14
  pick(79, 'openness', 'The recipe calls for an ingredient you can’t pronounce.', ['Swapping in something I know', L], ['Hunting for it', H]), // alm_basepick_openness_15
  pick(80, 'openness', 'The group picks a trivia night on a topic nobody knows.', ['Can we do the usual?', L], ['Love it', H]), // alm_basepick_openness_16
  pick(81, 'openness', 'You could paint, bake, or code something this weekend, and you’ve done none of them.', ['Picking one now', H], ['Doing what I’ve done before', L]), // alm_basepick_openness_17
  pick(82, 'openness', 'A travel site shows two trips: one you know well, one you don’t.', ['The one I know', L], ['The unfamiliar one', H]), // alm_basepick_openness_18
  pick(83, 'openness', 'Your barber asks if you want something different this time.', ['Same as always', L], ['Surprise me', H]), // alm_basepick_openness_19
  pick(84, 'openness', 'A museum room is full of art you can’t make sense of.', ['Moving to the next room', L], ['Staying a while longer', H]), // alm_basepick_openness_20
  // conscientiousness (alm_basepick_conscientiousness_*)
  pick(85, 'conscientiousness', 'Your screen has twelve tabs and a sticky note from last week.', ['Dealing with the note first', H], ['Opening one more tab', L]), // alm_basepick_conscientiousness_01
  pick(86, 'conscientiousness', 'The meeting has no agenda.', ['Writing one on the spot', H], ['Seeing where it goes', L]), // alm_basepick_conscientiousness_03
  pick(87, 'conscientiousness', 'You land in a new city for the weekend.', ['Itinerary done', H], ['We’ll wander', L]), // alm_basepick_conscientiousness_04
  pick(88, 'conscientiousness', 'Your inbox shows 112 unread.', ['Opening whichever looks interesting', L], ['Sorting by sender first', H]), // alm_basepick_conscientiousness_05
  pick(89, 'conscientiousness', 'The bill splits five ways and the app is open.', ['Rounding and moving on', L], ['Exact to the cent', H]), // alm_basepick_conscientiousness_06
  pick(90, 'conscientiousness', 'You’re packing the night before a three-day trip.', ['A list, then the bag', H], ['Throwing things in', L]), // alm_basepick_conscientiousness_07
  pick(91, 'conscientiousness', 'A friend texts: can you help me move on Saturday?', ['Saying yes, sorting it out later', L], ['Asking for the details first', H]), // alm_basepick_conscientiousness_08
  pick(92, 'conscientiousness', 'You save a new file.', ['Into a labeled folder', H], ['Onto the desktop pile', L]), // alm_basepick_conscientiousness_09
  pick(93, 'conscientiousness', 'The recipe says “season to taste.”', ['Tossing in what feels right', L], ['Measuring it anyway', H]), // alm_basepick_conscientiousness_10
  pick(94, 'conscientiousness', 'Sunday afternoon, and the week’s chores are on the fridge.', ['Doing them in order', H], ['Doing the fun ones first', L]), // alm_basepick_conscientiousness_11
  pick(95, 'conscientiousness', 'A project is due in two weeks.', ['Starting when it gets close', L], ['Splitting it into daily chunks', H]), // alm_basepick_conscientiousness_12
  pick(96, 'conscientiousness', 'The group trip has a shared doc with times and a backup plan.', ['A lot of rules for a trip', L], ['Love it', H]), // alm_basepick_conscientiousness_13
  pick(97, 'conscientiousness', 'Your keys have a hook by the door.', ['On the hook', H], ['Wherever I dropped them', L]), // alm_basepick_conscientiousness_15
  pick(98, 'conscientiousness', 'You spot the perfect gift a week early.', ['Buying it now', H], ['Deciding later', L]), // alm_basepick_conscientiousness_16
  pick(99, 'conscientiousness', 'The oven says it’s still heating.', ['Putting the tray in anyway', L], ['Waiting for the beep', H]), // alm_basepick_conscientiousness_17
  pick(100, 'conscientiousness', 'Your to-do list runs long.', ['Scrawled and loose', L], ['Ranked and numbered', H]), // alm_basepick_conscientiousness_18
  pick(101, 'conscientiousness', 'Your alarm is set for 7:00 and the meeting is at 9:00.', ['Leaving early to be safe', H], ['Leaving when it feels right', L]), // alm_basepick_conscientiousness_19
  pick(102, 'conscientiousness', 'Your phone says a bill is due Friday.', ['Paying it now', H], ['Paying it on Friday', L]), // alm_basepick_conscientiousness_20
  pick(103, 'conscientiousness', 'A friend lends you a book and says no rush.', ['Returning it eventually', L], ['Returning it this week', H]), // alm_basepick_conscientiousness_21
  // extraversion (alm_basepick_extraversion_*)
  pick(104, 'extraversion', 'A coworker invites the team out after work.', ['Home sounds good', L], ['Count me in', H]), // alm_basepick_extraversion_01
  pick(105, 'extraversion', 'The elevator has one other person in it.', ['Small talk', H], ['Eyes on my phone', L]), // alm_basepick_extraversion_02
  pick(106, 'extraversion', 'You’re seated at a wedding table of strangers.', ['Waiting to be spoken to', L], ['Introducing myself', H]), // alm_basepick_extraversion_03
  pick(107, 'extraversion', 'It’s 11 p.m. and the party is still loud.', ['Looking for the exit', L], ['Just getting started', H]), // alm_basepick_extraversion_05
  pick(108, 'extraversion', 'Your phone rings.', ['Letting it go to voicemail', L], ['Picking up', H]), // alm_basepick_extraversion_06
  pick(109, 'extraversion', 'A friend asks for a quick call about nothing.', ['Sure, right now', H], ['Can we text instead?', L]), // alm_basepick_extraversion_07
  pick(110, 'extraversion', 'A new class starts with an icebreaker.', ['Hoping it skips me', L], ['Volunteering first', H]), // alm_basepick_extraversion_08
  pick(111, 'extraversion', 'The work event ends and there’s an after-party.', ['Staying until the lights come on', H], ['Saying goodbye early', L]), // alm_basepick_extraversion_10
  pick(112, 'extraversion', 'Your seatmate on a long flight is chatty.', ['Headphones on', L], ['Chatting back', H]), // alm_basepick_extraversion_11
  pick(113, 'extraversion', 'The cafe is full and a stranger offers you a seat at their table.', ['Taking my coffee to go', L], ['Sitting and chatting', H]), // alm_basepick_extraversion_12
  pick(114, 'extraversion', 'You just finished a hard week.', ['Seeing everyone', H], ['Seeing no one', L]), // alm_basepick_extraversion_13
  pick(115, 'extraversion', 'A group photo is about to be taken.', ['Standing at the edge', L], ['Pulling people in', H]), // alm_basepick_extraversion_14
  pick(116, 'extraversion', 'The group chat has 14 unread messages.', ['Jumping in', H], ['Catching up later', L]), // alm_basepick_extraversion_15
  pick(117, 'extraversion', 'The new neighbor waves from their balcony.', ['Waving back', L], ['Heading over', H]), // alm_basepick_extraversion_16
  pick(118, 'extraversion', 'A friend asks to bring someone you haven’t met.', ['The more the merrier', H], ['Maybe next time', L]), // alm_basepick_extraversion_17
  pick(119, 'extraversion', 'Karaoke night is on the calendar.', ['Happy to watch', L], ['First on the list', H]), // alm_basepick_extraversion_19
  pick(120, 'extraversion', 'Your gym has a group class and a quiet corner machine.', ['The corner machine', L], ['The group class', H]), // alm_basepick_extraversion_20
  pick(121, 'extraversion', 'You arrive early to a dinner and the other guests are strangers.', ['Saying hi to everyone', H], ['Helping in the kitchen', L]), // alm_basepick_extraversion_21
  pick(122, 'extraversion', 'Your roommate has people over tonight.', ['Joining them in the living room', H], ['Closing my door', L]), // alm_basepick_extraversion_22
  // agreeableness (alm_basepick_agreeableness_*)
  pick(123, 'agreeableness', 'A coworker asks how their uneven presentation went.', ['Naming the weak part', L], ['Pointing out what worked', H]), // alm_basepick_agreeableness_03
  pick(124, 'agreeableness', 'A relative gives you a gift you won’t use.', ['Thanking them warmly', H], ['Admitting it’s not my style', L]), // alm_basepick_agreeableness_04
  pick(125, 'agreeableness', 'A friend asks how their new business idea sounds.', ['Honest about the risks', L], ['Cheering them on', H]), // alm_basepick_agreeableness_05
  pick(126, 'agreeableness', 'A friend’s cooking is just okay.', ['Saying it’s fine', L], ['Saying it’s delicious', H]), // alm_basepick_agreeableness_07
  pick(127, 'agreeableness', 'Someone gets a fact wrong in casual conversation.', ['Letting it pass', H], ['Correcting them', L]), // alm_basepick_agreeableness_08
  pick(128, 'agreeableness', 'A teammate misses a small deadline.', ['Mentioning it', L], ['Giving them a pass', H]), // alm_basepick_agreeableness_09
  pick(129, 'agreeableness', 'Someone asks for a ride the minute you sit down.', ['Grabbing the keys', H], ['Asking for ten minutes', L]), // alm_basepick_agreeableness_10
  pick(130, 'agreeableness', 'A friend vents about the same thing again.', ['Listening again', H], ['Noting it’s the third time', L]), // alm_basepick_agreeableness_11
  pick(131, 'agreeableness', 'Your neighbor asks you to water their plants for two weeks.', ['Of course', H], ['Let me check my week', L]), // alm_basepick_agreeableness_12
  pick(132, 'agreeableness', 'A friend asks for your honest take on their outfit.', ['Saying what I’d change', L], ['Saying it works', H]), // alm_basepick_agreeableness_13
  pick(133, 'agreeableness', 'A friend is 30 minutes late.', ['No worries', H], ['Mentioning it', L]), // alm_basepick_agreeableness_14
  pick(134, 'agreeableness', 'A group chat argument breaks out over plans.', ['Picking a side', L], ['Smoothing it over', H]), // alm_basepick_agreeableness_15
  pick(135, 'agreeableness', 'You’re asked to rate a restaurant out of five.', ['A fair three', L], ['A generous four', H]), // alm_basepick_agreeableness_16
  pick(136, 'agreeableness', 'A coworker’s new idea has a hole in it.', ['Pointing at the hole', L], ['Building on it', H]), // alm_basepick_agreeableness_17
  pick(137, 'agreeableness', 'A friend shows off their new apartment.', ['Loving everything', H], ['Mentioning the tiny kitchen', L]), // alm_basepick_agreeableness_18
  pick(138, 'agreeableness', 'Someone’s joke lands badly at dinner.', ['Laughing anyway', H], ['Staying quiet', L]), // alm_basepick_agreeableness_19
  pick(139, 'agreeableness', 'A coworker picks a farewell gift you find silly.', ['Signing the card anyway', H], ['Suggesting something else', L]), // alm_basepick_agreeableness_20
  pick(140, 'agreeableness', 'A stranger cuts in line, and they look rushed.', ['Waving them through', H], ['Pointing to the back', L]), // alm_basepick_agreeableness_21
  pick(141, 'agreeableness', 'A tourist asks you to take their photo while you’re in a hurry.', ['Taking a few, from good angles', H], ['One quick shot', L]), // alm_basepick_agreeableness_22
  // steadiness (alm_basepick_steadiness_*)
  pick(142, 'steadiness', 'A harsh review of your work shows up.', ['Thinking about it all day', L], ['Over it by lunch', H]), // alm_basepick_steadiness_03
  pick(143, 'steadiness', 'You spill coffee on your shirt before a meeting.', ['Shrug and go', H], ['It stays on my mind', L]), // alm_basepick_steadiness_04
  pick(144, 'steadiness', 'A loud argument starts on the train.', ['Feeling it in my chest', L], ['Staying calm', H]), // alm_basepick_steadiness_05
  pick(145, 'steadiness', 'Your phone buzzes at 2 a.m.', ['Wide awake now', L], ['Back to sleep', H]), // alm_basepick_steadiness_06
  pick(146, 'steadiness', 'A friend cancels at the last minute.', ['It stings a bit', L], ['No big deal', H]), // alm_basepick_steadiness_07
  pick(147, 'steadiness', 'Your manager wants a surprise update in five minutes.', ['Fine, give me five', H], ['Heart rate up', L]), // alm_basepick_steadiness_08
  pick(148, 'steadiness', 'A stranger is rude at the counter.', ['Carrying it home', L], ['Forgotten by the door', H]), // alm_basepick_steadiness_09
  pick(149, 'steadiness', 'Your vacation day falls apart.', ['Making new plans', H], ['Taking a while to recover', L]), // alm_basepick_steadiness_10
  pick(150, 'steadiness', 'A sad movie ends.', ['Teary for an hour', L], ['Dry eyes', H]), // alm_basepick_steadiness_11
  pick(151, 'steadiness', 'A deadline moves up by two days.', ['Feeling the squeeze', L], ['Rearranging calmly', H]), // alm_basepick_steadiness_12
  pick(152, 'steadiness', 'A rumor about layoffs reaches you.', ['Checking every five minutes', L], ['Waiting for facts', H]), // alm_basepick_steadiness_13
  pick(153, 'steadiness', 'A friend snaps at you after a long day.', ['Letting it slide', H], ['Thinking about it later', L]), // alm_basepick_steadiness_14
  pick(154, 'steadiness', 'You’re about to speak in front of a crowd.', ['Steady hands', H], ['Shaky hands', L]), // alm_basepick_steadiness_16
  pick(155, 'steadiness', 'Your mistake at work gets noticed.', ['Feeling bad all evening', L], ['Fixing it and moving on', H]), // alm_basepick_steadiness_17
  pick(156, 'steadiness', 'Someone gives you tough feedback.', ['Needing a walk first', L], ['Taking notes', H]), // alm_basepick_steadiness_18
  pick(157, 'steadiness', 'The line is long and the day is hot.', ['Patience running thin', L], ['Waiting it out', H]), // alm_basepick_steadiness_19
  pick(158, 'steadiness', 'Your laptop restarts to install an update mid-work.', ['Taking a short break', H], ['Watching the bar, getting tense', L]), // alm_basepick_steadiness_20
  pick(159, 'steadiness', 'Someone cuts you off in traffic.', ['Forgotten in a minute', H], ['Still annoyed at the next light', L]), // alm_basepick_steadiness_21
  pick(160, 'steadiness', 'You learn the interview is tomorrow, not next week.', ['Prepping tonight, calmly', H], ['Mind racing until it’s over', L]), // alm_basepick_steadiness_22
  // attachment_anxiety (alm_basepick_attachment_anxiety_*)
  pick(161, 'attachment_anxiety', 'A friend is quieter than usual tonight.', ['Wondering if it’s me', H], ['Giving them space', L]), // alm_basepick_attachment_anxiety_02
  pick(162, 'attachment_anxiety', 'A friend takes three days to text back.', ['Rereading my last message', H], ['They’re busy', L]), // alm_basepick_attachment_anxiety_03
  pick(163, 'attachment_anxiety', 'Plans with a close friend get moved.', ['Fine', L], ['Wondering what changed', H]), // alm_basepick_attachment_anxiety_04
  pick(164, 'attachment_anxiety', 'A friend posts a trip with people you didn’t know they knew.', ['A small pang', H], ['Happy for them', L]), // alm_basepick_attachment_anxiety_05
  pick(165, 'attachment_anxiety', 'The group chat goes silent after your joke.', ['Moving on', L], ['Replaying it', H]), // alm_basepick_attachment_anxiety_06
  pick(166, 'attachment_anxiety', 'You’re added to a friend’s birthday group chat a day after everyone else.', ['Probably just an oversight', L], ['Wondering why I was last', H]), // alm_basepick_attachment_anxiety_07
  pick(167, 'attachment_anxiety', 'You haven’t heard from a close friend in a week.', ['Reaching out to check we’re okay', H], ['They’ll reach out', L]), // alm_basepick_attachment_anxiety_08
  pick(168, 'attachment_anxiety', 'Your usual weekend group skips you this once.', ['A one-off', L], ['Reading into it', H]), // alm_basepick_attachment_anxiety_09
  pick(169, 'attachment_anxiety', 'A close friend makes a new close friend.', ['Glad for both', L], ['Wondering where I fit now', H]), // alm_basepick_attachment_anxiety_12
  pick(170, 'attachment_anxiety', 'A friend calls your gift “nice.”', ['Nice is nice', L], ['Wondering if they hated it', H]), // alm_basepick_attachment_anxiety_13
  pick(171, 'attachment_anxiety', 'Someone you like doesn’t say goodnight.', ['It happens', L], ['Noticing', H]), // alm_basepick_attachment_anxiety_14
  pick(172, 'attachment_anxiety', 'A friend forgets a small thing you told them.', ['Telling them again', L], ['Feeling unseen', H]), // alm_basepick_attachment_anxiety_15
  pick(173, 'attachment_anxiety', 'A long-distance friend goes quiet for a month.', ['Life gets busy', L], ['Writing a long message', H]), // alm_basepick_attachment_anxiety_17
  pick(174, 'attachment_anxiety', 'Your friend texts someone else all through dinner.', ['Letting them', L], ['Feeling a bit left out', H]), // alm_basepick_attachment_anxiety_18
  pick(175, 'attachment_anxiety', 'You share something personal and the topic changes.', ['Natural', L], ['Worrying I shared too much', H]), // alm_basepick_attachment_anxiety_19
  pick(176, 'attachment_anxiety', 'You wave at a friend across the room and they don’t wave back.', ['They didn’t see me', L], ['Wondering if they did', H]), // alm_basepick_attachment_anxiety_20
  pick(177, 'attachment_anxiety', 'You apologize for something small and they say “it’s fine.”', ['Taking it at face value', L], ['Checking if we’re okay', H]), // alm_basepick_attachment_anxiety_21
  pick(178, 'attachment_anxiety', 'A friend sits somewhere else at lunch today.', ['Just a seat', L], ['Wondering what I did', H]), // alm_basepick_attachment_anxiety_22
  pick(179, 'attachment_anxiety', 'A friend starts a new job and says they’ll be busy.', ['Cheering them on', L], ['Bracing for less of them', H]), // alm_basepick_attachment_anxiety_23
  // attachment_avoidance (alm_basepick_attachment_avoidance_*)
  pick(180, 'attachment_avoidance', 'A friend wants to talk about feelings over dinner.', ['Leaning in', L], ['Steering to another topic', H]), // alm_basepick_attachment_avoidance_01
  pick(181, 'attachment_avoidance', 'A close friend wants to spend the whole weekend together.', ['Sounds nice', L], ['Needing a day to myself', H]), // alm_basepick_attachment_avoidance_03
  pick(182, 'attachment_avoidance', 'A friend offers to help with your stressful week.', ['Accepting', L], ['Handling it alone', H]), // alm_basepick_attachment_avoidance_04
  pick(183, 'attachment_avoidance', 'Someone says they missed you after a short trip.', ['Missing them back', L], ['Feeling a bit crowded', H]), // alm_basepick_attachment_avoidance_05
  pick(184, 'attachment_avoidance', 'You’re sick and a friend offers to bring soup.', ['Yes please', L], ['I’ll be fine', H]), // alm_basepick_attachment_avoidance_06
  pick(185, 'attachment_avoidance', 'A friend hugs you hello every single time.', ['Hugging back', L], ['Stiffening a little', H]), // alm_basepick_attachment_avoidance_07
  pick(186, 'attachment_avoidance', 'Someone asks what you need right now.', ['Saying it', L], ['Not sure how to say it', H]), // alm_basepick_attachment_avoidance_08
  pick(187, 'attachment_avoidance', 'A friend shares something vulnerable.', ['Sharing something back', L], ['Listening, sharing less', H]), // alm_basepick_attachment_avoidance_09
  pick(188, 'attachment_avoidance', 'A friend proposes a weekly call.', ['Love that', L], ['Maybe monthly', H]), // alm_basepick_attachment_avoidance_11
  pick(189, 'attachment_avoidance', 'You feel overwhelmed at a friend’s place.', ['Saying so', L], ['Hiding it until I leave', H]), // alm_basepick_attachment_avoidance_12
  pick(190, 'attachment_avoidance', 'A close friend ends the call with “love you.”', ['Saying it back', L], ['Saying “you too”', H]), // alm_basepick_attachment_avoidance_13
  pick(191, 'attachment_avoidance', 'Someone you’re getting close to asks about your childhood.', ['Telling stories', L], ['Keeping it light', H]), // alm_basepick_attachment_avoidance_14
  pick(192, 'attachment_avoidance', 'A friend wants you to meet their whole crew.', ['Excited', L], ['Needing some time', H]), // alm_basepick_attachment_avoidance_15
  pick(193, 'attachment_avoidance', 'A friend leans on you after a rough breakup.', ['Happy to be the one', L], ['Glad when others help too', H]), // alm_basepick_attachment_avoidance_16
  pick(194, 'attachment_avoidance', 'A friend asks to be roommates.', ['A warm yes', L], ['Wanting my own space', H]), // alm_basepick_attachment_avoidance_17
  pick(195, 'attachment_avoidance', 'A friend wants a photo of you two framed for their desk.', ['Aw', L], ['Feels like a lot', H]), // alm_basepick_attachment_avoidance_19
  pick(196, 'attachment_avoidance', 'A friend wants to plan a trip, just the two of you.', ['Picking dates now', L], ['Suggesting a group trip', H]), // alm_basepick_attachment_avoidance_20
  pick(197, 'attachment_avoidance', 'A friend cries during a movie next to you.', ['Offering a tissue, staying close', L], ['Looking away to give them room', H]), // alm_basepick_attachment_avoidance_21
  pick(198, 'attachment_avoidance', 'A friend starts saving you the seat next to them every week.', ['Heading straight for it', L], ['Sitting there now and then', H]), // alm_basepick_attachment_avoidance_22
  // conflict_assertiveness (alm_basepick_conflict_assertiveness_*)
  pick(199, 'conflict_assertiveness', 'A coworker keeps interrupting you.', ['Pointing it out', H], ['Waiting for a gap', L]), // alm_basepick_conflict_assertiveness_02
  pick(200, 'conflict_assertiveness', 'Your roommate leaves dishes for a third day.', ['Doing them myself', L], ['Bringing it up tonight', H]), // alm_basepick_conflict_assertiveness_03
  pick(201, 'conflict_assertiveness', 'A friend’s joke stings a little.', ['Telling them', H], ['Letting it pass', L]), // alm_basepick_conflict_assertiveness_04
  pick(202, 'conflict_assertiveness', 'You disagree with the plan in a meeting.', ['Writing it down for later', L], ['Speaking up', H]), // alm_basepick_conflict_assertiveness_05
  pick(203, 'conflict_assertiveness', 'Your rent goes up with a week’s notice.', ['Pushing back today', H], ['Hoping it’s a mistake', L]), // alm_basepick_conflict_assertiveness_06
  pick(204, 'conflict_assertiveness', 'A friend cancels for the third time.', ['Saying it’s fine', L], ['Saying it bugs me', H]), // alm_basepick_conflict_assertiveness_07
  pick(205, 'conflict_assertiveness', 'A stranger takes your seat.', ['Finding another one', L], ['Asking for it back', H]), // alm_basepick_conflict_assertiveness_08
  pick(206, 'conflict_assertiveness', 'A teammate’s work needs to be redone.', ['Redoing it myself', L], ['Telling them directly', H]), // alm_basepick_conflict_assertiveness_11
  pick(207, 'conflict_assertiveness', 'A neighbor’s music is loud at midnight.', ['Earplugs', L], ['Knocking', H]), // alm_basepick_conflict_assertiveness_13
  pick(208, 'conflict_assertiveness', 'A friend asks to borrow something you’d rather not lend.', ['Saying yes', L], ['Saying no', H]), // alm_basepick_conflict_assertiveness_14
  pick(209, 'conflict_assertiveness', 'Your manager hands you a task that isn’t yours.', ['Taking it on', L], ['Saying it isn’t mine', H]), // alm_basepick_conflict_assertiveness_15
  pick(210, 'conflict_assertiveness', 'A friend gives advice you didn’t ask for.', ['Nodding along', L], ['Saying thanks, but no', H]), // alm_basepick_conflict_assertiveness_16
  pick(211, 'conflict_assertiveness', 'A salesperson won’t take no for an answer.', ['Polite stalling', L], ['A firm no', H]), // alm_basepick_conflict_assertiveness_17
  pick(212, 'conflict_assertiveness', 'A group project is splitting unfairly.', ['Taking the extra work', L], ['Raising it with everyone', H]), // alm_basepick_conflict_assertiveness_18
  pick(213, 'conflict_assertiveness', 'You think a friend is making a mistake.', ['Staying out of it', L], ['Telling them', H]), // alm_basepick_conflict_assertiveness_19
  pick(214, 'conflict_assertiveness', 'The hotel gives you the room next to the elevator.', ['Taking it, it’s one night', L], ['Asking for a different one', H]), // alm_basepick_conflict_assertiveness_20
  pick(215, 'conflict_assertiveness', 'A coworker schedules a meeting over your lunch.', ['Asking to move it', H], ['Eating at my desk', L]), // alm_basepick_conflict_assertiveness_21
  pick(216, 'conflict_assertiveness', 'Your landlord has said “soon” about the sink for a month.', ['Sending a firm message', H], ['Waiting a bit more', L]), // alm_basepick_conflict_assertiveness_22
  pick(217, 'conflict_assertiveness', 'The airline seats you apart from your friend.', ['Making do', L], ['Asking the agent to fix it', H]), // alm_basepick_conflict_assertiveness_23
  // conflict_cooperativeness (alm_basepick_conflict_cooperativeness_*)
  pick(218, 'conflict_cooperativeness', 'You and a friend want different movies.', ['Holding out for mine', L], ['Picking theirs', H]), // alm_basepick_conflict_cooperativeness_01
  pick(219, 'conflict_cooperativeness', 'A coworker wants to split the work differently.', ['Meeting in the middle', H], ['Sticking with my plan', L]), // alm_basepick_conflict_cooperativeness_02
  pick(220, 'conflict_cooperativeness', 'Your sibling asks to swap holidays.', ['Keeping our usual', L], ['Happy to swap', H]), // alm_basepick_conflict_cooperativeness_03
  pick(221, 'conflict_cooperativeness', 'The dinner debate drags on.', ['Letting them have it', H], ['Making my case', L]), // alm_basepick_conflict_cooperativeness_04
  pick(222, 'conflict_cooperativeness', 'A teammate insists on their approach.', ['Defending mine', L], ['Trying theirs', H]), // alm_basepick_conflict_cooperativeness_05
  pick(223, 'conflict_cooperativeness', 'A friend wants a quieter night than you planned.', ['Adjusting', H], ['Keeping the plan', L]), // alm_basepick_conflict_cooperativeness_06
  pick(224, 'conflict_cooperativeness', 'Two friends ask you to pick a side.', ['Finding the middle', H], ['Picking what I believe', L]), // alm_basepick_conflict_cooperativeness_08
  pick(225, 'conflict_cooperativeness', 'A negotiation is stuck on one point.', ['Holding the point', L], ['Trading for something else', H]), // alm_basepick_conflict_cooperativeness_09
  pick(226, 'conflict_cooperativeness', 'A friend wants to leave the party early.', ['Staying, see you tomorrow', L], ['Leaving with them', H]), // alm_basepick_conflict_cooperativeness_10
  pick(227, 'conflict_cooperativeness', 'The group splits on which route to take.', ['Taking mine', L], ['Following the majority', H]), // alm_basepick_conflict_cooperativeness_11
  pick(228, 'conflict_cooperativeness', 'A coworker asks you to shift your schedule.', ['Shifting', H], ['Offering a different day', L]), // alm_basepick_conflict_cooperativeness_12
  pick(229, 'conflict_cooperativeness', 'A friend and you want different trips.', ['Booking mine', L], ['Booking theirs', H]), // alm_basepick_conflict_cooperativeness_13
  pick(230, 'conflict_cooperativeness', 'A disagreement is five minutes from resolved.', ['Conceding a bit', H], ['Waiting them out', L]), // alm_basepick_conflict_cooperativeness_14
  pick(231, 'conflict_cooperativeness', 'Two plans collide on Saturday.', ['Keeping mine', L], ['Moving mine', H]), // alm_basepick_conflict_cooperativeness_15
  pick(232, 'conflict_cooperativeness', 'A team vote ties.', ['Keeping my vote', L], ['Switching my vote', H]), // alm_basepick_conflict_cooperativeness_16
  pick(233, 'conflict_cooperativeness', 'A friend says your idea needs changes.', ['Explaining why not', L], ['Taking their edit', H]), // alm_basepick_conflict_cooperativeness_17
  pick(234, 'conflict_cooperativeness', 'The group picks a game you dislike.', ['Playing along', H], ['Offering another', L]), // alm_basepick_conflict_cooperativeness_18
  pick(235, 'conflict_cooperativeness', 'You’re sure you’re right, and so are they.', ['Standing firm', L], ['Compromising', H]), // alm_basepick_conflict_cooperativeness_19
  pick(236, 'conflict_cooperativeness', 'Your roommate wants a paint color you dislike for the living room.', ['Finding one we both like', H], ['Holding out for mine', L]), // alm_basepick_conflict_cooperativeness_20
  // autonomy (alm_basepick_autonomy_*)
  pick(237, 'autonomy', 'A new project arrives with no instructions.', ['Asking how it’s usually done', L], ['Making my own plan', H]), // alm_basepick_autonomy_01
  pick(238, 'autonomy', 'Your manager offers a daily check-in.', ['A little much', H], ['Helpful', L]), // alm_basepick_autonomy_02
  pick(239, 'autonomy', 'A friend tells you what they’d do in your place.', ['Following their lead', L], ['Interesting, but my call', H]), // alm_basepick_autonomy_03
  pick(240, 'autonomy', 'You’re picking a new hobby.', ['With a coach', L], ['By myself', H]), // alm_basepick_autonomy_04
  pick(241, 'autonomy', 'A big decision, two options.', ['Asking three people', L], ['Deciding alone', H]), // alm_basepick_autonomy_05
  pick(242, 'autonomy', 'A job where tasks are assigned or a job where you choose them.', ['Assigned', L], ['Choosing mine', H]), // alm_basepick_autonomy_06
  pick(243, 'autonomy', 'You get a surprise day off.', ['Making my own plan', H], ['Following a top-ten list online', L]), // alm_basepick_autonomy_08
  pick(244, 'autonomy', 'A group is stuck waiting for someone to lead.', ['Waiting for someone', L], ['I’ll start', H]), // alm_basepick_autonomy_09
  pick(245, 'autonomy', 'A friend hands you a map and says go.', ['Excellent', H], ['Can I get directions?', L]), // alm_basepick_autonomy_10
  pick(246, 'autonomy', 'You’re learning a skill online.', ['Following the course', L], ['My own order', H]), // alm_basepick_autonomy_11
  pick(247, 'autonomy', 'A schedule you set or one set for you.', ['Set for me', L], ['Mine', H]), // alm_basepick_autonomy_13
  pick(248, 'autonomy', 'Friends have strong opinions on which apartment you should take.', ['Going with the votes', L], ['Thanks, I’ll decide', H]), // alm_basepick_autonomy_14
  pick(249, 'autonomy', 'A rule doesn’t make sense to you.', ['Following it', L], ['Asking why', H]), // alm_basepick_autonomy_15
  pick(250, 'autonomy', 'You want a new look.', ['Polling friends', L], ['Just doing it', H]), // alm_basepick_autonomy_16
  pick(251, 'autonomy', 'A big purchase.', ['Wanting a second opinion', L], ['Deciding by myself', H]), // alm_basepick_autonomy_18
  pick(252, 'autonomy', 'Someone offers you a clear plan for your week.', ['I have my own', H], ['Yes please', L]), // alm_basepick_autonomy_19
  pick(253, 'autonomy', 'A coach gives you a plan, and you think another way works.', ['Following the plan', L], ['Testing my way', H]), // alm_basepick_autonomy_20
  pick(254, 'autonomy', 'Your map app says turn left, and you know a shortcut.', ['Following the map', L], ['Taking my shortcut', H]), // alm_basepick_autonomy_21
  pick(255, 'autonomy', 'A friend offers to plan your whole birthday.', ['Yes, surprise me', L], ['I’ll plan it myself', H]), // alm_basepick_autonomy_22
  // competence (alm_basepick_competence_*)
  pick(256, 'competence', 'Your boss asks who can lead a new task.', ['Waiting to see', L], ['Raising my hand', H]), // alm_basepick_competence_01
  pick(257, 'competence', 'A repair needs doing and you’ve never done it.', ['I’ll figure it out', H], ['Calling someone', L]), // alm_basepick_competence_02
  pick(258, 'competence', 'You’re asked to give a toast.', ['Practicing for days', L], ['Sure', H]), // alm_basepick_competence_03
  pick(259, 'competence', 'A friend asks for advice on something you know well.', ['Maybe not me', L], ['Happy to', H]), // alm_basepick_competence_04
  pick(260, 'competence', 'You just finished a project.', ['Looking for flaws', L], ['Proud of it', H]), // alm_basepick_competence_08
  pick(261, 'competence', 'A new game starts at a party.', ['Watching one round', L], ['Jumping in', H]), // alm_basepick_competence_09
  pick(262, 'competence', 'A stranger asks you for directions.', ['Offering to check my phone', L], ['A confident answer', H]), // alm_basepick_competence_10
  pick(263, 'competence', 'You’re asked to decide something quickly at work.', ['Wanting more info', L], ['Deciding', H]), // alm_basepick_competence_11
  pick(264, 'competence', 'Someone compliments your work.', ['Oh, it was nothing', L], ['Thanks, I worked on it', H]), // alm_basepick_competence_12
  pick(265, 'competence', 'You’re asked to volunteer for something unfamiliar.', ['Why not', H], ['Not unless I’m ready', L]), // alm_basepick_competence_13
  pick(266, 'competence', 'An interview question you didn’t prepare for.', ['Freezing a little', L], ['Answering calmly', H]), // alm_basepick_competence_14
  pick(267, 'competence', 'You’re cooking for ten people on Saturday.', ['Doing a test run first', L], ['Cooking it on the night', H]), // alm_basepick_competence_15
  pick(268, 'competence', 'Someone asks if you can finish a task by tomorrow.', ['Let me check first', L], ['Yes', H]), // alm_basepick_competence_16
  pick(269, 'competence', 'A hard problem is on the table.', ['Making sure I can', L], ['Starting', H]), // alm_basepick_competence_17
  pick(270, 'competence', 'A friend asks you to teach them.', ['Sure', H], ['I’m not an expert', L]), // alm_basepick_competence_19
  pick(271, 'competence', 'You’re asked to present results you pulled together yourself.', ['Walking them through it', H], ['Hoping nobody asks questions', L]), // alm_basepick_competence_20
  pick(272, 'competence', 'You join a pub quiz team.', ['Whispering answers to a teammate', L], ['Calling answers out', H]), // alm_basepick_competence_21
  pick(273, 'competence', 'Your spreadsheet formula returns an error.', ['Digging into it', H], ['Asking the nearest expert', L]), // alm_basepick_competence_22
  pick(274, 'competence', 'Game night starts, and someone asks you to explain the rules.', ['Handing the rulebook over', L], ['Explaining as we go', H]), // alm_basepick_competence_23
  // relatedness (alm_basepick_relatedness_*)
  pick(275, 'relatedness', 'Two weeks to yourself or two weeks with friends.', ['With friends', H], ['To myself', L]), // alm_basepick_relatedness_01
  pick(276, 'relatedness', 'A dinner for one or a dinner for six.', ['Dinner for one', L], ['Dinner for six', H]), // alm_basepick_relatedness_02
  pick(277, 'relatedness', 'A hobby to do alone or with people.', ['Alone', L], ['With people', H]), // alm_basepick_relatedness_04
  pick(278, 'relatedness', 'A quiet Tuesday evening.', ['Calling someone', H], ['Enjoying the quiet', L]), // alm_basepick_relatedness_05
  pick(279, 'relatedness', 'A friend is moving away.', ['Staying in touch lightly', L], ['Planning visits', H]), // alm_basepick_relatedness_07
  pick(280, 'relatedness', 'A team role or a solo role.', ['Team', H], ['Solo', L]), // alm_basepick_relatedness_08
  pick(281, 'relatedness', 'A work-from-home day.', ['Perfect', L], ['Missing people', H]), // alm_basepick_relatedness_09
  pick(282, 'relatedness', 'The neighbors invite you to a block party.', ['Waving from the window', L], ['Heading out', H]), // alm_basepick_relatedness_10
  pick(283, 'relatedness', 'A book club or just the book.', ['Club', H], ['Just the book', L]), // alm_basepick_relatedness_11
  pick(284, 'relatedness', 'A friend’s dinner has room for one more.', ['Pulling up a chair', H], ['Taking a polite pass', L]), // alm_basepick_relatedness_12
  pick(285, 'relatedness', 'A busy shared house or a quiet apartment.', ['Quiet apartment', L], ['Busy house', H]), // alm_basepick_relatedness_13
  pick(286, 'relatedness', 'A volunteer day with strangers.', ['Donating instead', L], ['Signing up', H]), // alm_basepick_relatedness_15
  pick(287, 'relatedness', 'A big feeling to work through.', ['Thinking it through alone', L], ['Talking it out', H]), // alm_basepick_relatedness_16
  pick(288, 'relatedness', 'You’ve just moved to a new city.', ['Exploring alone', L], ['Joining a club', H]), // alm_basepick_relatedness_17
  pick(289, 'relatedness', 'A friend asks if you want to just hang out.', ['I need a reason to go', L], ['That sounds great', H]), // alm_basepick_relatedness_18
  pick(290, 'relatedness', 'A weekend entirely alone.', ['Feels empty', H], ['Feels full', L]), // alm_basepick_relatedness_19
  pick(291, 'relatedness', 'You have a 45-minute lunch break.', ['Eating with coworkers', H], ['A podcast and a walk', L]), // alm_basepick_relatedness_20
  pick(292, 'relatedness', 'You finish a really good book.', ['Starting the next one', L], ['Texting a friend about it', H]), // alm_basepick_relatedness_21
  pick(293, 'relatedness', 'A friend is in your neighborhood for an hour.', ['Meeting for coffee', H], ['Another time, then', L]), // alm_basepick_relatedness_22
  // growth_mindset (alm_basepick_growth_mindset_*)
  pick(294, 'growth_mindset', 'You fail a first attempt at something new.', ['Not my thing', L], ['Trying again', H]), // alm_basepick_growth_mindset_01
  pick(295, 'growth_mindset', 'A friend is much better at a game you play.', ['Asking how they do it', H], ['Sticking with what I’m good at', L]), // alm_basepick_growth_mindset_02
  pick(296, 'growth_mindset', 'Feedback says your work needs a rewrite.', ['Defending the draft', L], ['Starting the rewrite', H]), // alm_basepick_growth_mindset_03
  pick(297, 'growth_mindset', 'A skill you’ve avoided for years.', ['Moving on', L], ['Starting small', H]), // alm_basepick_growth_mindset_04
  pick(298, 'growth_mindset', 'You’re the beginner in a class.', ['Wanting to leave', L], ['Staying', H]), // alm_basepick_growth_mindset_05
  pick(299, 'growth_mindset', 'You make the same mistake twice.', ['Shrugging', L], ['Studying why', H]), // alm_basepick_growth_mindset_06
  pick(300, 'growth_mindset', 'You get a low score on a test.', ['Looking at what I missed', H], ['Putting it away', L]), // alm_basepick_growth_mindset_08
  pick(301, 'growth_mindset', 'A friend says you’ve changed.', ['Hope so', H], ['Same as ever', L]), // alm_basepick_growth_mindset_10
  pick(302, 'growth_mindset', 'A hard puzzle.', ['One more try', H], ['Moving on', L]), // alm_basepick_growth_mindset_12
  pick(303, 'growth_mindset', 'Someone suggests a different way to do your routine job.', ['My way works', L], ['Trying it', H]), // alm_basepick_growth_mindset_13
  pick(304, 'growth_mindset', 'An article disagrees with what you believe.', ['Closing the tab', L], ['Reading closely', H]), // alm_basepick_growth_mindset_15
  pick(305, 'growth_mindset', 'Your handwriting is hard to read, and a friend says it can improve.', ['It’s just how I write', L], ['Practicing a little', H]), // alm_basepick_growth_mindset_16
  pick(306, 'growth_mindset', 'You’re 40 and want to learn piano.', ['Too late', L], ['Starting this week', H]), // alm_basepick_growth_mindset_17
  pick(307, 'growth_mindset', 'Your work gets mixed reviews.', ['Ignoring them', L], ['Learning from them', H]), // alm_basepick_growth_mindset_18
  pick(308, 'growth_mindset', 'You hit a plateau.', ['Accepting my level', L], ['Changing the method', H]), // alm_basepick_growth_mindset_19
  pick(309, 'growth_mindset', 'You watch a recording of your own presentation.', ['Noting what to improve', H], ['Cringing and closing it', L]), // alm_basepick_growth_mindset_20
  pick(310, 'growth_mindset', 'A friend shows you a math trick you never got at school.', ['Math was never my thing', L], ['Trying it now', H]), // alm_basepick_growth_mindset_21
  pick(311, 'growth_mindset', 'A coworker uses a keyboard shortcut you’ve never learned.', ['Clicking works for me', L], ['Learning it today', H]), // alm_basepick_growth_mindset_22
  pick(312, 'growth_mindset', 'A teacher offers you the advanced group.', ['Staying where it’s comfortable', L], ['Moving up', H]), // alm_basepick_growth_mindset_23
  // locus_of_control (alm_basepick_locus_of_control_*)
  pick(313, 'locus_of_control', 'You catch a lucky break.', ['Right place, right time', L], ['I earned it', H]), // alm_basepick_locus_of_control_03
  pick(314, 'locus_of_control', 'Your plan falls through.', ['It wasn’t meant to be', L], ['Making a new one', H]), // alm_basepick_locus_of_control_04
  pick(315, 'locus_of_control', 'You get sick right before an event.', ['Wishing I’d slept more', H], ['Bad luck', L]), // alm_basepick_locus_of_control_05
  pick(316, 'locus_of_control', 'A friend drifts away.', ['People drift', L], ['Wondering what I could do', H]), // alm_basepick_locus_of_control_06
  pick(317, 'locus_of_control', 'You get a bad grade.', ['The test was unfair', L], ['Studying differently', H]), // alm_basepick_locus_of_control_07
  pick(318, 'locus_of_control', 'You’re stuck in a traffic jam.', ['Nothing to do about it', L], ['Checking routes next time', H]), // alm_basepick_locus_of_control_08
  pick(319, 'locus_of_control', 'A promotion goes to someone else.', ['Office politics', L], ['Asking what I could do better', H]), // alm_basepick_locus_of_control_09
  pick(320, 'locus_of_control', 'The weather ruins your plans.', ['Can’t control it', L], ['Having a backup next time', H]), // alm_basepick_locus_of_control_11
  pick(321, 'locus_of_control', 'Your phone breaks.', ['Bad timing', L], ['Buying a case', H]), // alm_basepick_locus_of_control_12
  pick(322, 'locus_of_control', 'A job doesn’t work out.', ['Wrong fit', L], ['What I’d do differently', H]), // alm_basepick_locus_of_control_13
  pick(323, 'locus_of_control', 'A job interview goes really well.', ['The questions just suited me', L], ['My prep paid off', H]), // alm_basepick_locus_of_control_14
  pick(324, 'locus_of_control', 'A long streak of bad days.', ['It will pass', L], ['Changing what I can', H]), // alm_basepick_locus_of_control_15
  pick(325, 'locus_of_control', 'Is your future mostly up to you?', ['Partly luck', L], ['Mostly', H]), // alm_basepick_locus_of_control_16
  pick(326, 'locus_of_control', 'You forget a friend’s birthday.', ['Busy week', L], ['My fault', H]), // alm_basepick_locus_of_control_17
  pick(327, 'locus_of_control', 'A recipe flops.', ['Bad oven', L], ['Next time I’ll measure', H]), // alm_basepick_locus_of_control_18
  pick(328, 'locus_of_control', 'Things are going well lately.', ['Good timing', L], ['My habits', H]), // alm_basepick_locus_of_control_19
  pick(329, 'locus_of_control', 'You lose your wallet.', ['Just one of those days', L], ['I wasn’t paying attention', H]), // alm_basepick_locus_of_control_20
  pick(330, 'locus_of_control', 'You get a parking ticket.', ['Should’ve read the sign', H], ['Unfair spot', L]), // alm_basepick_locus_of_control_21
  pick(331, 'locus_of_control', 'A dish you cooked for friends turns out great.', ['Good ingredients, mostly', L], ['I nailed the timing', H]), // alm_basepick_locus_of_control_22
  // self_efficacy (alm_basepick_self_efficacy_*)
  pick(332, 'self_efficacy', 'A big goal looks far away.', ['I’m not sure I can', L], ['I can get there', H]), // alm_basepick_self_efficacy_01
  pick(333, 'self_efficacy', 'A stressful task lands on your desk.', ['Wondering if I can', L], ['I’ll handle it', H]), // alm_basepick_self_efficacy_03
  pick(334, 'self_efficacy', 'The meeting wants a volunteer to speak.', ['Hoping someone else does', L], ['Doing it', H]), // alm_basepick_self_efficacy_04
  pick(335, 'self_efficacy', 'A new language class is open.', ['Signing up', H], ['Not sure I’m able', L]), // alm_basepick_self_efficacy_05
  pick(336, 'self_efficacy', 'A scary phone call is waiting.', ['Putting it off', L], ['Making it now', H]), // alm_basepick_self_efficacy_06
  pick(337, 'self_efficacy', 'You set a hard goal.', ['Hedging a little', L], ['Believing it', H]), // alm_basepick_self_efficacy_07
  pick(338, 'self_efficacy', 'A project with high stakes.', ['Confident', H], ['Nervous', L]), // alm_basepick_self_efficacy_08
  pick(339, 'self_efficacy', 'An unexpected problem appears.', ['Solving it', H], ['Needing help', L]), // alm_basepick_self_efficacy_09
  pick(340, 'self_efficacy', 'You try something and it flops.', ['Doubting myself', L], ['Trying again', H]), // alm_basepick_self_efficacy_10
  pick(341, 'self_efficacy', 'You’re offered a lead role.', ['Wondering why me', L], ['Taking it', H]), // alm_basepick_self_efficacy_12
  pick(342, 'self_efficacy', 'A tough conversation is coming.', ['Delaying it', L], ['I can do this', H]), // alm_basepick_self_efficacy_13
  pick(343, 'self_efficacy', 'A hard dish to cook.', ['I’ll nail it', H], ['Ordering in', L]), // alm_basepick_self_efficacy_14
  pick(344, 'self_efficacy', 'A marathon sign-up opens.', ['Dreaming about it', L], ['Signing up', H]), // alm_basepick_self_efficacy_15
  pick(345, 'self_efficacy', 'Your first day somewhere new.', ['Nervous', L], ['Ready', H]), // alm_basepick_self_efficacy_16
  pick(346, 'self_efficacy', 'A leap: a move, a job, a risk.', ['Waiting for certainty', L], ['Taking it', H]), // alm_basepick_self_efficacy_17
  pick(347, 'self_efficacy', 'A difficult skill.', ['Others are better at it', L], ['I’ll master it', H]), // alm_basepick_self_efficacy_18
  pick(348, 'self_efficacy', 'Someone says, “Can you fix this?”', ['On it', H], ['Not sure', L]), // alm_basepick_self_efficacy_19
  pick(349, 'self_efficacy', 'Your boss wants a first draft of a plan you’ve never made.', ['I’d need a template first', L], ['I’ll build one', H]), // alm_basepick_self_efficacy_20
  pick(350, 'self_efficacy', 'A writing contest asks for one page.', ['Entering', H], ['Probably out of my league', L]), // alm_basepick_self_efficacy_21
  // playfulness (alm_basepick_playfulness_*)
  pick(351, 'playfulness', 'Rain on a day off.', ['Splashing in puddles', H], ['Reading inside', L]), // alm_basepick_playfulness_03
  pick(352, 'playfulness', 'It’s board game night.', ['Playing carefully', L], ['Joking the whole game', H]), // alm_basepick_playfulness_04
  pick(353, 'playfulness', 'A toddler hands you a toy phone.', ['Smiling and giving it back', L], ['Taking the call', H]), // alm_basepick_playfulness_05
  pick(354, 'playfulness', 'Someone renames the group chat.', ['Leaving it be', L], ['Joining in', H]), // alm_basepick_playfulness_06
  pick(355, 'playfulness', 'A costume party.', ['Wearing a hat', L], ['Going all in', H]), // alm_basepick_playfulness_07
  pick(356, 'playfulness', 'A silly dance starts at a wedding.', ['By the table', L], ['On the floor', H]), // alm_basepick_playfulness_08
  pick(357, 'playfulness', 'A friend has a harmless prank idea.', ['In', H], ['Pass', L]), // alm_basepick_playfulness_09
  pick(358, 'playfulness', 'You find a ball pit.', ['Looking on', L], ['Jumping in', H]), // alm_basepick_playfulness_11
  pick(359, 'playfulness', 'A coworker does a voice for the printer.', ['Joining in', H], ['Printing', L]), // alm_basepick_playfulness_12
  pick(360, 'playfulness', 'The power goes out for an evening.', ['Shadow puppets by flashlight', H], ['An early night', L]), // alm_basepick_playfulness_13
  pick(361, 'playfulness', 'A friend dares you to a silly challenge.', ['Declining', L], ['Accepting', H]), // alm_basepick_playfulness_14
  pick(362, 'playfulness', 'A long drive.', ['A podcast', L], ['Car karaoke', H]), // alm_basepick_playfulness_15
  pick(363, 'playfulness', 'A work party game is announced.', ['Watching', L], ['Playing', H]), // alm_basepick_playfulness_16
  pick(364, 'playfulness', 'A pun comes to mind in a serious talk.', ['Keeping it in', L], ['Delivering it', H]), // alm_basepick_playfulness_18
  pick(365, 'playfulness', 'A water balloon fight starts.', ['Staying dry', L], ['Joining', H]), // alm_basepick_playfulness_19
  pick(366, 'playfulness', 'A friend gives you a ridiculous nickname.', ['Hoping it fades', L], ['Giving them one back', H]), // alm_basepick_playfulness_20
  pick(367, 'playfulness', 'A friend sends a voice note in a silly accent.', ['Replying normally', L], ['Replying in an accent', H]), // alm_basepick_playfulness_21
  pick(368, 'playfulness', 'The line is long and the group is bored.', ['Starting a game of I Spy', H], ['Scrolling quietly', L]), // alm_basepick_playfulness_22
  pick(369, 'playfulness', 'You get a pack of sticky notes.', ['Making lists', L], ['Leaving jokes on desks', H]), // alm_basepick_playfulness_23
];

/** Day 0 of the rotation. The server uses the same date. */
export const DAILY_PICK_EPOCH = '2026-01-01';

/** The rotation before PHASE-11d: 64 picks, 4 per trait (wave82). */
export const LEGACY_PICK_COUNT = 64;

/**
 * From this local date the rotation runs over all 368 picks (PHASE-11d, red team H3).
 * Before it, the 64-pick rotation, so a phone that has not taken the OTA yet shows the
 * same pick as everyone else. PLACEHOLDER: at least 14 days after the planned OTA;
 * emci confirms the real date at PHASE-27. The SQL (wave117 `daily_pick_position`)
 * carries the same date, pinned by check:daily-pick.
 */
export const ALMANAC_PICK_CUTOVER = '2027-02-01';

/** From the cutover, the server also accepts the 64-rotation pick for this many days (old bundles). */
export const PICK_OVERLAP_DAYS = 14;

const TRAITS = 16;

/**
 * Where the rotation's slot points in DAILY_PICKS. Slots are trait-grouped
 * (trait t owns slots t*K … t*K+K-1); the list is append-only, so a trait's
 * first 4 slots are its wave82 picks (t*4 + k) and the rest are its appended
 * picks (64 + t*(K-4) + k-4). With K = 4 this is the slot itself.
 * Right for K = 4 and K = 23 only: a third batch appended later needs its own
 * branch here (and a new cutover), not just more rows.
 */
export function positionForSlot(slot: number, perTrait: number): number {
  const trait = Math.floor(slot / perTrait);
  const k = slot % perTrait;
  return k < 4 ? trait * 4 + k : LEGACY_PICK_COUNT + trait * (perTrait - 4) + (k - 4);
}

/**
 * The rotation over `count` picks (count = 16 × K): slot = (n % 16) * K + floor(n / 16),
 * n = day % count. It steps through the 16 traits first, so the same trait never comes
 * two days running, and every pick comes up once per `count` days.
 */
export function pickIndexAt(ymd: string, count: number): number {
  const perTrait = count / TRAITS;
  const day = daysBetweenYmd(DAILY_PICK_EPOCH, ymd);
  const n = ((day % count) + count) % count;
  return positionForSlot((n % TRAITS) * perTrait + Math.floor(n / TRAITS), perTrait);
}

/** The 64-pick rotation (wave82), the one every phone used before the cutover. */
export function legacyPickIndexForYmd(ymd: string): number {
  return pickIndexAt(ymd, LEGACY_PICK_COUNT);
}

/**
 * Today's pick for everyone on this local date: the 64 rotation before
 * ALMANAC_PICK_CUTOVER, the full rotation from it. The server computes the
 * same thing (wave117 `daily_pick_position`). Both rotations put trait
 * day % 16 on a day, so the switch never repeats a trait either.
 */
export function pickIndexForYmd(ymd: string): number {
  return ymd < ALMANAC_PICK_CUTOVER ? legacyPickIndexForYmd(ymd) : pickIndexAt(ymd, DAILY_PICKS.length);
}

export function pickForYmd(ymd: string): DailyPick {
  return DAILY_PICKS[pickIndexForYmd(ymd)]!;
}

// ── Seasonal peak Picks (PHASE-11d, red team H3/M5) ─────────────────────────
// Outside the rotation. On an event's peak day the server's override row
// (wave117 `daily_pick_event_override`) names one of these, and the server
// accepts it as well as that day's rotation pick. GLOBAL events only: the
// shared Pick is the same for everyone, so a regional or cultural event never
// overrides it (it gets seasonal lines instead). No trait: an event Pick moves
// no trait value, so its answers carry no `value`.

export type GlobalPickEvent = 'new_year' | 'valentines' | 'halloween' | 'christmas';

export interface DailyEventPickOption {
  text: string;
  /** "It's just a day for me": the way out on a gentle day. */
  out?: boolean;
}

export interface DailyEventPick {
  /** `ev-<event>-<variant>`, the server's key. Forever. */
  id: string;
  event: GlobalPickEvent;
  variant: number;
  /** The reviewed Almanac card it came from (docs/almanac-review.md section B). */
  cardId: string;
  prompt: string;
  options: readonly [DailyEventPickOption, DailyEventPickOption];
}

function eventPick(
  event: GlobalPickEvent,
  variant: number,
  prompt: string,
  a: DailyEventPickOption,
  b: DailyEventPickOption,
): DailyEventPick {
  return {
    id: `ev-${event}-${variant}`,
    event,
    variant,
    cardId: `alm_pick_${event}_peak_${String(variant).padStart(2, '0')}`,
    prompt,
    options: [a, b],
  };
}

export const EVENT_DAILY_PICKS: readonly DailyEventPick[] = [
  eventPick('new_year', 1, 'Midnight was one minute away last night.', { text: 'Counted down out loud' }, { text: 'Noticed it was already past' }),
  eventPick('new_year', 2, 'The new year is a blank page.', { text: 'One big goal' }, { text: 'A few small habits' }),
  eventPick('new_year', 3, 'January 1, no plans yet.', { text: 'A resolutions list' }, { text: 'No resolutions this year' }),
  eventPick('valentines', 1, 'Valentine’s Day is today.', { text: 'Planning something small' }, { text: 'It’s just a regular day for me', out: true }),
  eventPick('valentines', 2, 'The store has a whole aisle of cards.', { text: 'Buying one for someone' }, { text: 'Walking right past', out: true }),
  eventPick('valentines', 3, 'Someone suggests a group dinner for the day.', { text: 'Count me in' }, { text: 'Skipping this one', out: true }),
  eventPick('halloween', 1, 'The doorbell rings and it’s a tiny dinosaur.', { text: 'Handing over the full-size bar' }, { text: 'Pretending nobody’s home' }),
  eventPick('halloween', 2, 'A costume party tonight, and the costume is...', { text: 'Elaborate and homemade' }, { text: 'Bought in a hurry' }),
  eventPick('halloween', 3, 'A friend starts a horror movie marathon.', { text: 'Front row' }, { text: 'Behind a pillow' }),
  eventPick('christmas', 1, 'Christmas is today.', { text: 'Marking it somehow' }, { text: 'It’s just another day for me', out: true }),
  eventPick('christmas', 2, 'Holiday music is everywhere today.', { text: 'Humming along' }, { text: 'Headphones in, it’s a normal day', out: true }),
  eventPick('christmas', 3, 'Some streets are lit up tonight.', { text: 'Going out to look' }, { text: 'Just another night for me', out: true }),
];

/** The global events with a peak Pick: fixed date, peak days (events.ts, pinned by check:daily-pick). */
export const GLOBAL_PICK_EVENTS: readonly { event: GlobalPickEvent; month: number; day: number; peakDays: number }[] = [
  { event: 'new_year', month: 1, day: 1, peakDays: 1 },
  { event: 'valentines', month: 2, day: 14, peakDays: 1 },
  { event: 'halloween', month: 10, day: 31, peakDays: 1 },
  { event: 'christmas', month: 12, day: 25, peakDays: 2 },
];

/** Server position for an event Pick: past every rotation and retired slot, so it is never served by position. */
export const EVENT_PICK_POSITION_BASE = 2000;

/** Years the override rows cover (the Almanac calendar's tables, events.ts). */
export const EVENT_OVERRIDE_FIRST_YEAR = 2026;
export const EVENT_OVERRIDE_LAST_YEAR = 2035;

/**
 * The override rows: one per peak day. The three variants take turns by year
 * (2026 → 1, 2027 → 2, …); a second peak day takes the next variant.
 */
export function eventPickOverrides(): { ymd: string; pickId: string; event: GlobalPickEvent }[] {
  const rows: { ymd: string; pickId: string; event: GlobalPickEvent }[] = [];
  for (let year = EVENT_OVERRIDE_FIRST_YEAR; year <= EVENT_OVERRIDE_LAST_YEAR; year += 1) {
    for (const e of GLOBAL_PICK_EVENTS) {
      for (let d = 0; d < e.peakDays; d += 1) {
        const variant = ((year - EVENT_OVERRIDE_FIRST_YEAR + d) % 3) + 1;
        const ymd = `${year}-${String(e.month).padStart(2, '0')}-${String(e.day + d).padStart(2, '0')}`;
        rows.push({ ymd, pickId: `ev-${e.event}-${variant}`, event: e.event });
      }
    }
  }
  return rows.sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0));
}

/** The seasonal peak Pick for this local date, or null on an ordinary day. */
export function eventPickForYmd(ymd: string): DailyEventPick | null {
  const row = eventPickOverrides().find((r) => r.ymd === ymd);
  return row ? (EVENT_DAILY_PICKS.find((p) => p.id === row.pickId) ?? null) : null;
}

/**
 * Picks taken out of rotation when their scene changed. Ids are forever: an old
 * answer still points at its original question, so the original text stays here
 * (and on the server, parked at a position the rotation never reaches).
 * `position` is where the pick sat in wave82; `replacedBy` is the pick there now.
 */
export const RETIRED_DAILY_PICKS: readonly { pick: DailyPick; position: number; replacedBy: string }[] = [
  {
    pick: pick(25, 'attachment_avoidance', 'Someone you just met wants to share locations.', ['Maybe later', H], ['Sure, send it', L]),
    position: 24,
    replacedBy: 'p65',
  },
];

/** Server position for a retired pick: past the 64-day rotation, so it is never served. */
export const RETIRED_PICK_POSITION_BASE = 1000;

/** The pool exactly as wave82 created it (retired picks back in their old places). */
export function picksAtWave82(): DailyPick[] {
  const list = DAILY_PICKS.slice(0, LEGACY_PICK_COUNT);
  for (const r of RETIRED_DAILY_PICKS) list[r.position] = r.pick;
  return list;
}

export function dailyPickById(id: string): DailyPick | null {
  return DAILY_PICKS.find((p) => p.id === id) ?? RETIRED_DAILY_PICKS.find((r) => r.pick.id === id)?.pick ?? null;
}
