/**
 * Today's Pick (emci, 2026-10-05): one either/or question a day, the SAME
 * question for everyone that day, answered with one tap. It replaces the
 * daily line on Home. Each pick is about one trait: one answer leans to the
 * trait's high end (value 0.8), the other to its low end (0.2), in the order
 * shown (the high side is not always first).
 *
 * Written in the moment voice (lib/voice/moment-voice.ts): one concrete
 * modern moment, teased kindly, no advice, no slang, never "you are". Draft
 * until emci reads them.
 *
 * The server keeps the same list (supabase/migrations/wave82_daily_pick.sql,
 * generated from this file by scripts/gen-wave82-picks.ts) and checks every
 * answer against it. Change a pick here, then regenerate the SQL.
 */
import type { TraitAxis } from '@/lib/traits';
import { daysBetweenYmd } from '@/lib/local-date';

export const DAILY_PICK_COPY_REVIEWED = false;

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
  pick(25, 'attachment_avoidance', 'Someone you just met wants to share locations.', ['Maybe later', H], ['Sure, send it', L]),
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
];

/** Day 0 of the rotation. The server uses the same date. */
export const DAILY_PICK_EPOCH = '2026-01-01';

/**
 * Today's pick for everyone on this local date. The rotation walks the list
 * in an order that never puts the same trait two days running. The server
 * computes the same thing (wave82 `daily_pick_position`).
 */
export function pickIndexForYmd(ymd: string, count: number = DAILY_PICKS.length): number {
  const day = daysBetweenYmd(DAILY_PICK_EPOCH, ymd);
  // 16 traits x 4 picks: step through traits first (n), then their 4 picks (round).
  const n = ((day % count) + count) % count;
  const traits = 16;
  const round = Math.floor(n / traits);
  const trait = n % traits;
  return trait * 4 + round;
}

export function pickForYmd(ymd: string): DailyPick {
  return DAILY_PICKS[pickIndexForYmd(ymd)]!;
}

export function dailyPickById(id: string): DailyPick | null {
  return DAILY_PICKS.find((p) => p.id === id) ?? null;
}
