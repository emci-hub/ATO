/**
 * The daily line bank — one short sentence a person sees the moment Home opens.
 *
 * STORED THE WAY THE QUESTIONS ARE (emci, 2026-10-02): a written set that ships
 * in the app, the same set as shared `authored` rows in `daily_line_pool`
 * (wave77), and AI-written lines as rows only their owner can read. This file
 * is the pure half — the data, the rules, and the in-memory registry the picker
 * reads. Nothing here touches the network; pool-store.ts and sync.ts do.
 *
 * WHERE THE WRITTEN LINES COME FROM
 * - `lines.generated.ts`, written by `npm run load:daily-line` from the lines
 *   emci ticked in docs/daily-line-review.md. Once it has lines, it IS the bank.
 * - Until then, the first-draft lines below (SOLO / PAIRS / STARTERS) are used,
 *   so the app is never without a bank. They are the older "tends to … try
 *   this" style and go away when the first load happens.
 *
 * Three kinds of line:
 * - one key: a single trait lean (16 axes x 2 sides).
 * - two keys: a tension between two leans. The picker prefers these.
 * - no key: a starter, shown until an account has a clear lean on anything.
 *
 * A line's id is a hash of its text, so the same line has the same id whether
 * it was read from the bundle, from the pool, or from another phone's history.
 * Editing a line's wording makes it a new line, which is the honest outcome.
 *
 * UNREVIEWED until emci has ticked it. AI lines are never reviewed, which is
 * why they stay inside the app (see `lockScreenText` and the share button).
 */
import { TRAIT_AXES, type TraitAxis, type TraitLean } from '@/lib/traits';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

import { LOADED_LINES } from './lines.generated';

// emci approved the voice and all 340 lines on 2026-10-02. AI-written lines are
// separate: nobody reads those, which is why they never leave the app.
export const DAILY_LINE_COPY_REVIEWED = true;

export const DAILY_LINE_MAX_CHARS = 120;

export type LineKey = `${TraitAxis}:${TraitLean}`;
export type LineSource = 'authored' | 'ai';

export interface DailyLine {
  id: string;
  /** Empty for a starter, one key for a solo line, two for a pair line. */
  keys: readonly LineKey[];
  text: string;
  source: LineSource;
}

export function lineKey(axis: TraitAxis, lean: TraitLean): LineKey {
  return `${axis}:${lean}`;
}

export function axisOfKey(key: LineKey): TraitAxis {
  return key.slice(0, key.indexOf(':')) as TraitAxis;
}

/** The pool's `lean_key` column: 'starter', one key, or two joined by '+'. */
export const STARTER_TAG = 'starter';

export function leanTag(keys: readonly LineKey[]): string {
  return keys.length === 0 ? STARTER_TAG : keys.join('+');
}

function isLineKey(value: string): value is LineKey {
  const at = value.indexOf(':');
  if (at < 0) return false;
  const lean = value.slice(at + 1);
  return (TRAIT_AXES as readonly string[]).includes(value.slice(0, at)) && (lean === 'high' || lean === 'low');
}

/** Null for anything that is not a tag this app knows. */
export function parseLeanTag(tag: string): LineKey[] | null {
  if (tag === STARTER_TAG) return [];
  const parts = tag.split('+');
  if (parts.length < 1 || parts.length > 2 || !parts.every(isLineKey)) return null;
  if (parts.length === 2 && axisOfKey(parts[0] as LineKey) === axisOfKey(parts[1] as LineKey)) return null;
  return parts as LineKey[];
}

/**
 * A sentence that opens by telling the reader what to do. The new style
 * describes a moment and stops; it never gives advice.
 */
const ADVICE_OPENER =
  /(^|[.?!]\s+)(Try|Ask|Check|Notice|Let|Pick|Say|Give|Take|Leave|Put|Start|Wait|Make|Keep|Tell|Share|Write|Test|Look|Show|Step|Choose|Invite|Offer|Thank|Plan|Remember|Trust|Watch)\b/;

/**
 * Why a line may not be shown, or null if it may. The one rule set for the
 * review file, the loader, and every AI-written line before it is kept.
 * `allowAdvice` exists only for the first-draft lines below.
 */
export function lineRuleViolation(text: string, options: { allowAdvice?: boolean } = {}): string | null {
  const line = text.trim();
  if (!line) return 'empty';
  if (line.length > DAILY_LINE_MAX_CHARS) return `too long (${line.length})`;
  if (/\byou are\b|\byou['’]re\b/i.test(line)) return 'says "you are"';
  if (/\balways\b/i.test(line)) return 'says "always"';
  if (/[#]|!{2,}/.test(line)) return 'hashtag or shouting';
  if (containsFrameworkTerm(line)) return 'framework term';
  if (!options.allowAdvice && ADVICE_OPENER.test(line)) return 'gives advice';
  return null;
}

const SOLO: Record<TraitAxis, Record<TraitLean, readonly string[]>> = {
  openness: {
    high: [
      'The menu had a usual order. You pointed at the dish you couldn’t pronounce.',
      'A friend named a place none of you know. You were already checking the train.',
      'You opened a new app while the last tutorial was still on the screen.',
      'The chat said the same bar. You sent a pin for somewhere else.',
      'You bought the supplies before you had done the thing even once.',
      'Someone said they had never tried it. You said yes before there was a time.',
    ],
    low: [
      'Same coffee, same table, same seat by the window. It was good last time.',
      'A friend sent a new restaurant. You sent back the place you already like.',
      'The app moved one button. You spent the morning hunting for the old one.',
      'You read a stack of reviews and bought the thing you already own.',
      'The playlist is four years old. You hit play and left it.',
      'Someone offered a different way home. You took the street you walk every day.',
    ],
  },
  conscientiousness: {
    high: [
      'You added a task to the list so you could cross it off before lunch.',
      'It was due Friday. You finished Wednesday and read it again Thursday.',
      'You said you were on your way, and you were, keys in hand.',
      'The inbox hit zero. You refreshed it once more to be sure.',
      'You kept the hour you promised yourself after the fun part was over.',
      'The dull task had a block on the calendar. You did it inside that block.',
    ],
    low: [
      'The plan was later. Later showed up as a pile on the kitchen table.',
      'You started the form, made tea, and the form was still open at dinner.',
      'Two choices sat all week. You picked one in the doorway, coat already on.',
      'The list had six lines. You did the interesting one and wandered off.',
      'You meant to leave at seven. At eight the bag was still by the door.',
      'A fixed hour felt tight, so the evening stayed loose and the task moved with it.',
    ],
  },
  extraversion: {
    high: [
      'The room went quiet. You were the one who asked the next question.',
      'You said the thought out loud before you had decided to say it.',
      'A full table woke you up. The walk home was the first quiet minute.',
      'You would rather be in the group chat than watching it scroll past.',
      'Someone had to start the plan. You sent the time, the place and the count.',
      'After the party you were still talking. The dishes waited until morning.',
    ],
    low: [
      'The big table was loud. You took the chair at the end and stayed there.',
      'You left while the night was still good, before the room started to cost you.',
      'A full Friday takes more from you than it takes from most of that group.',
      'You said one sentence at dinner. It was the one people repeated later.',
      'The quiet hour did the reset. A friend’s text sat on the counter, still unread.',
      'You had the invite. You pictured the room, then the couch, and stayed home.',
    ],
  },
  agreeableness: {
    high: [
      'The group picked a place you didn’t want. You said sure and put your shoes on.',
      'A small no would have done it. You smoothed it over and paid for both coffees.',
      'You said yes in the chat before you had checked if you meant maybe.',
      'The room was tense. You changed the subject and passed the bread.',
      'Keeping the peace landed on you again. Nobody asked. You just did it.',
      'They were late again. You decided the train was the reason and let it go.',
    ],
    low: [
      'The plan was bad. You said so before anyone had a polite version ready.',
      'You didn’t pretend to like the idea. You named the part that wouldn’t work.',
      'They wanted it easy. You wanted it accurate, and you said the accurate thing.',
      'You haven’t softened the email. It is still sitting in drafts.',
      'You said what the rest of the table was thinking. The pause after was long.',
      'A new person got a careful first month. The ones who stayed got a warmer second one.',
    ],
  },
  steadiness: {
    high: [
      'The morning went badly. By lunch you were on the next thing, plate cleared.',
      'You were about to call it fine. Today you checked the clock before you said it.',
      'A sharp email landed. You answered the question and left the sting on the screen.',
      'The room was rattled. You kept your voice level and the meeting moved on.',
      'Nothing from yesterday was still on you at breakfast. You drank the coffee and started the list.',
      'The rough patch was gone before dinner. You were already talking about Thursday.',
    ],
    low: [
      'One short text before nine colored the meetings, the lunch and the ride home.',
      'The moment ended at noon. You were still carrying it when you locked the door.',
      'A bad morning grew a tail. It was still there when you opened the fridge at night.',
      'You set the bag down. The feeling stayed in your coat pocket anyway.',
      'The same small knock landed harder on you than on anyone else at the table.',
      'The mood showed up before the reason. You stood in the kitchen with it.',
    ],
  },
  attachment_anxiety: {
    high: [
      'They took an hour to reply. You read the thread twice and checked the time again.',
      'The silence was probably a meeting. Your head had already written a worse ending.',
      'You opened the chat to see where you stood. The last message was still yours.',
      'A pause from someone you like got loud. You typed three replies and sent none.',
      'You noticed the gap before anyone else in the room had looked up.',
      'While you waited, the story in your head ran ahead of the words on the screen.',
    ],
    low: [
      'A slow reply was a slow reply. You put the phone down and finished the dish.',
      'Names come and go in the chat. You don’t recount them at the end of the day.',
      'You trusted they would still be there Friday. You thanked one of them out loud.',
      'You hadn’t asked for proof all month. You sent a photo anyway, no question on it.',
      'You don’t keep score of who texted last. Someone you like might be counting.',
      'A quiet week didn’t scare you. You still asked if they wanted the same amount of room.',
    ],
  },
  attachment_avoidance: {
    high: [
      'You like them. You still left one seat between you on the couch.',
      'The real thing was easier as a text. Your voice stayed in your pocket.',
      'You did the hard part alone. Help was in the next room, and you didn’t ask.',
      'The talk was about to get honest. You were already by the door, jacket half on.',
      'You like the door in sight. Someone there was hoping you would sit back down.',
      'Sitting close felt like a cost at first. An hour later it just felt like company.',
    ],
    low: [
      'Once you were in, you stayed close. There was still a chair left for you.',
      'You wanted to talk it out at the table. They needed a night before they could.',
      'You showed up for your people. You noticed which of them showed up the same way.',
      'You were easy to reach all week. You still put the phone in the other room for an hour.',
      'Staying close came easily. Their quiet night was not a no.',
      'When it got hard, you crossed the kitchen instead of hiding in the group chat.',
    ],
  },
  conflict_assertiveness: {
    high: [
      'You put your point on the table and left a little room beside it for theirs.',
      'The disagreement didn’t scare you. They needed a softer first line than you had ready.',
      'You said it straight. You tried the warm version out loud and it still fit.',
      'You won the point in the thread. Then you checked whether you still had the person.',
      'In a standoff you spoke first. Speaking second would have told you more.',
      'Your point came out sharp. The same words would have landed with the edge taken off.',
    ],
    low: [
      'You stepped back. One thing you dropped last week was still worth picking up.',
      'You let it go. On the walk home you weren’t sure it had actually gone.',
      'You picked peace over being right. Your side still had one sentence it never got.',
      'You swallowed three small things this week. At dinner they were one medium thing.',
      'You waited for a better moment. The moment in front of you was probably enough.',
      'Backing off felt safer. You said half of it and watched what they did.',
    ],
  },
  conflict_cooperativeness: {
    high: [
      'You looked for what they could live with. You had not yet asked what you could.',
      'You gave first. Today you waited, and the next move was still theirs.',
      'You aimed at the middle. Sometimes that middle leaves both people unhappy.',
      'You were the one who bent. You still hadn’t asked them for the next bend.',
      'A fair deal mattered more than a win. Fair still had to include your half.',
      'You heard their side all the way through. Yours was still waiting for a listener.',
    ],
    low: [
      'You protected what you wanted first. One small give was still sitting on the table.',
      'You don’t give ground early. They were closer to yes than their face showed.',
      'You knew what you wanted and you held it. You hadn’t asked what they wanted yet.',
      'You haven’t had to bend much. A bend on something small was still available.',
      'You left with what you came for. You didn’t check what they left with.',
      'Holding the line came easy at the table. Sorting which lines mattered was harder.',
    ],
  },
  autonomy: {
    high: [
      'You wanted it your way. Their way would have saved an hour, and you could see it.',
      'The handed-over plan didn’t fit. You named the one part you would change.',
      'You redid the task your way after someone had written the steps. Their steps were fine.',
      'A coworker handed you the steps. You checked whether those steps were actually wrong.',
      'It had to be your choice. You picked the thing you were going to be told anyway.',
      'Your way worked. Another way would have worked too, and you let that sit a minute.',
    ],
    low: [
      'The plan was already made, and that suited you. One small piece still had your name on it.',
      'You let someone else steer. Your own turn was right there, and you almost took it.',
      'Relief hit when the plan was made. You also noticed what you would have picked.',
      'You went with the decision already in the chat. You still said your preference once.',
      'Not having to figure it out felt like rest. You figured out one small thing anyway.',
      'You trusted the map in your hand. Then you looked at the name on the corner.',
    ],
  },
  competence: {
    high: [
      'The hard task felt like yours. You checked, once, whether it was yours at all.',
      'You trusted yourself to pull it off. The person beside you needed to hear a bit of that.',
      'You reached for the harder version. The easy one was sitting there, allowed.',
      'Hard things have gone your way. The dull ones are the tasks you keep walking past.',
      'You felt capable walking in. You asked for help anyway, and the work changed shape.',
      'You walked in sure you could do the job. The open question was whether you wanted it.',
    ],
    low: [
      'The hard task made you doubt it before you touched it. You started with a messy first pass.',
      'You listed what could go wrong. Then you wrote one thing that went right last time.',
      'It looked bigger from the doorway than it did after five minutes at the desk.',
      'You assumed someone else would do it better. Their pen was hovering too.',
      'The doubt arrived before any evidence. You waited, and the evidence was smaller.',
      'You brushed off a thing you had already finished. You wrote it on a sticky note.',
    ],
  },
  relatedness: {
    high: [
      'The day didn’t land until you had one real talk, not a thread of logistics.',
      'You needed one real conversation. You started it in the kitchen, not in the chat.',
      'People were the point of the day. You texted first instead of waiting.',
      'Small talk left you hungry. You asked the second question and stayed for it.',
      'You measured the day by who was in it. Someone measured theirs by whether you showed.',
      'Around them and with them felt different. You closed that gap once, at the table.',
    ],
    low: [
      'The day landed fine with almost no one in it. One person was still hoping for a text.',
      'You were fine on your own. Fine and full were not the same evening.',
      'You didn’t need much from anyone. You let someone hand you something small anyway.',
      'A long stretch with no real talk went by. You barely noticed. The calendar did.',
      'You don’t count the days between calls. Someone you like does, and they texted.',
      'Your own company was enough. You still shared a piece of the evening.',
    ],
  },
  growth_mindset: {
    high: [
      'After a miss you looked for what to change. You also looked at what to keep.',
      'You treated the mistake like a draft. One page on the desk was allowed to be done.',
      'You said not yet, not no. Someone near you needed that version out loud.',
      'Lately every task looked like something to improve. Some of it was already good.',
      'You figured you could get better at most of it. You picked the one for this week.',
      'A setback turned into a project. You rested, then you opened it.',
    ],
    low: [
      'A miss felt like the end of that try. The same tools were still on the desk.',
      'You decided early it wasn’t your thing. One of those calls was out of date.',
      'One bad try had you closing the doc. You opened it again and stopped on the second page.',
      'You stayed with what you already do well. One clumsy try didn’t undo that.',
      'You graded the first attempt as the final grade. It was a rough copy on the table.',
      'One skill felt fixed. You tested it for ten minutes and stopped there.',
    ],
  },
  locus_of_control: {
    high: [
      'When it went sideways you looked at your part first. Not all of it was yours.',
      'You asked what you could have done differently. Sometimes the answer was nothing.',
      'You took the result as yours. Luck and other people still had a share of the day.',
      'The blame arrived fast. The credit was slower, and you noticed that at the end.',
      'You treated the day as something your choices made. The rain was not one of them.',
      'Your first move was to fix it yourself. You asked once whether it was yours to fix.',
    ],
    low: [
      'You figured it was going to happen anyway. One small piece of the afternoon was still yours.',
      'You let it play out. Then you nudged the piece nearest your hand.',
      'The day felt like it happened to you. You picked the next ten minutes on purpose.',
      'You said that is just how it goes. Sometimes it goes the way a person pushed it.',
      'You didn’t blame yourself for what you couldn’t steer. You looked for the piece you could.',
      'Timing and luck got the credit in your notes. You added one line with your name on it.',
    ],
  },
  self_efficacy: {
    high: [
      'The big task looked doable. You split it anyway, for the Thursday version of you.',
      'You backed yourself in the meeting. You also backed the person sitting next to you.',
      'You said yes to the large thing. The week was full before you checked the calendar.',
      'You have said you can do it a lot. You can, just not all of it this afternoon.',
      'Confidence got you in the door. The prep is what kept you in the room.',
      'You assumed you would sort it out. Starting earlier made the afternoon nicer.',
    ],
    low: [
      'The big task looked too big at the start. It got smaller once your hands were on it.',
      'You waited to feel ready. Ready showed up after you had already started.',
      'The size of it was choosing for you. You took the smallest piece and began there.',
      'You weren’t sure you could. Starting was the part that changed the size.',
      'You saw the whole project at once. Today only needed the next step.',
      'The big task stayed big while you walked around the desk. One messy pass made it smaller.',
    ],
  },
  playfulness: {
    high: [
      'You reached for the lighter line. Then you checked it wasn’t covering a real sentence.',
      'Fun finds you. One person in the room needed you plain for a minute, and you saw them.',
      'You played with a dull task until it moved. That was useful, not a detour.',
      'You laughed it off fast. Afterward you checked whether it was actually off.',
      'You turned the chore into a game and sent the invite so someone else could join.',
      'You started with the joke. The serious part stayed in the next sentence.',
    ],
    low: [
      'You treated the day as a list to finish. One part of it could have been a game.',
      'Fun was booked for after the work. The work didn’t end, so the fun stayed in the margin.',
      'The day was all list. One line was blank, and you almost filled it in.',
      'You stayed serious. A silly ten minutes wouldn’t have cost you the work.',
      'Rest had to be earned first. Five unearned minutes sat there, and you walked past.',
      'Getting through it was the goal. You enjoyed the walk between rooms on purpose.',
    ],
  },
};

interface PairEntry {
  keys: readonly [LineKey, LineKey];
  lines: readonly string[];
}

const PAIRS: readonly PairEntry[] = [
  {
    keys: ['extraversion:high', 'attachment_avoidance:high'],
    lines: [
      'The room likes having you in it. The people who want closer still get the short version.',
      'Lots of faces, few who know the Tuesday version of you. That might be on purpose.',
    ],
  },
  {
    keys: ['extraversion:low', 'relatedness:high'],
    lines: [
      'You needed one real person, not a room. One hour at one table was the size that fit.',
      'A crowd drained you. Being unknown drained you more. You picked the one person.',
    ],
  },
  {
    keys: ['extraversion:high', 'relatedness:low'],
    lines: [
      'You liked the room and didn’t need anyone in it to stay. Someone there wanted more than the room.',
      'People woke you up. Few of them got past the first story. You let one take the next step.',
    ],
  },
  {
    keys: ['conscientiousness:high', 'playfulness:low'],
    lines: [
      'You finished the list and skipped the fun. The list had grown back by morning either way.',
      'Work came first, and the work did not end. You put one light thing on the list itself.',
    ],
  },
  {
    keys: ['conscientiousness:high', 'openness:high'],
    lines: [
      'You went after the new thing and you still finished it, both, on the same task.',
      'You wanted today’s thing new and done. You had to pick which one it was.',
    ],
  },
  {
    keys: ['conscientiousness:low', 'openness:high'],
    lines: [
      'New ideas came easy. The ending was the hard part. You picked one and gave it a last line.',
      'You opened more doors than you walked through. Today you walked through one.',
    ],
  },
  {
    keys: ['conscientiousness:high', 'openness:low'],
    lines: [
      'You did it the way that already works, and you did all of it. A shortcut would have been fine.',
      'A plan and a known route is home. You stepped off it for ten minutes, on purpose.',
    ],
  },
  {
    keys: ['conscientiousness:low', 'playfulness:high'],
    lines: [
      'You followed the fun and let the plan catch up. You gave the plan a small head start.',
      'Loose and light is how you moved. One fixed point on the calendar would not spoil it.',
    ],
  },
  {
    keys: ['agreeableness:high', 'conflict_assertiveness:low'],
    lines: [
      'You went along, then you stepped back. Your opinion has been waiting for a turn.',
      'Easy for everyone else has been costing you. You said one true preference before noon.',
    ],
  },
  {
    keys: ['agreeableness:high', 'conflict_assertiveness:high'],
    lines: [
      'You kept it easy until it mattered, then you said it straight. People missed the turn coming.',
      'Kind and direct both show up in you. You led with the one you used less this week.',
    ],
  },
  {
    keys: ['agreeableness:low', 'conflict_assertiveness:high'],
    lines: [
      'You held your ground and you said so. The point landed better once the first line was softer.',
      'You rarely fold and you rarely stay quiet. You asked one question before the point.',
    ],
  },
  {
    keys: ['agreeableness:low', 'conflict_assertiveness:low'],
    lines: [
      'You disagreed quietly. From across the table it looked like you had agreed.',
      'You held your ground inside and stepped back outside. One of those showed today.',
    ],
  },
  {
    keys: ['attachment_anxiety:high', 'attachment_avoidance:high'],
    lines: [
      'You wanted people close and you kept a seat between you. Both were you looking out for yourself.',
      'You wanted more than you showed. You showed a little more, in one text.',
    ],
  },
  {
    keys: ['attachment_anxiety:high', 'attachment_avoidance:low'],
    lines: [
      'You stayed close and still worried they would leave. You asked them, instead of guessing.',
      'You showed up fully, then checked if it had been too much. It probably had not.',
    ],
  },
  {
    keys: ['attachment_anxiety:low', 'attachment_avoidance:high'],
    lines: [
      'You stayed calm about people by keeping them a step away. Close was the harder part.',
      'Not much rattled you with people. Few got near enough to try. You let one near.',
    ],
  },
  {
    keys: ['attachment_anxiety:low', 'attachment_avoidance:low'],
    lines: [
      'You stayed close without gripping. The people around you had an easier evening for it.',
      'Close came easily and the worry stayed low. You lent a little of that to someone with less.',
    ],
  },
  {
    keys: ['autonomy:high', 'relatedness:high'],
    lines: [
      'You wanted it your way and you wanted company for it. You said both out loud.',
      'Your own route, with people on it, needed one sentence. You sent the sentence.',
    ],
  },
  {
    keys: ['autonomy:high', 'relatedness:low'],
    lines: [
      'You did it your way and you did it alone. Quick, and nobody saw the good part.',
      'Nobody steering and nobody needed. You let someone in on one decision anyway.',
    ],
  },
  {
    keys: ['autonomy:low', 'relatedness:high'],
    lines: [
      'You followed the plan when it kept you near your people. You checked where that plan was going.',
      'Going along felt fine while the company was good. Your own pick still counted at dinner.',
    ],
  },
  {
    keys: ['autonomy:high', 'agreeableness:high'],
    lines: [
      'You wanted your own way and you still said yes to theirs. You noticed which one won.',
      'You went along on the outside and kept your own route inside. You said the route.',
    ],
  },
  {
    keys: ['competence:low', 'growth_mindset:high'],
    lines: [
      'You doubted yourself on the way in and learned fast on the way out. The second half was the proof.',
      'The doubt arrived first. The progress arrived anyway. You noticed the order.',
    ],
  },
  {
    keys: ['competence:high', 'growth_mindset:low'],
    lines: [
      'You felt able at what you know, and finished with what you don’t. One of those was closer than it looked.',
      'You trusted yourself on familiar ground. A miss away from it did not have to end the try.',
    ],
  },
  {
    keys: ['growth_mindset:high', 'locus_of_control:high'],
    lines: [
      'You owned the miss and then you fixed it. You left room for the one that was not on you.',
      'Every miss became a lesson, and all of it was yours to learn. Some days it was just a day.',
    ],
  },
  {
    keys: ['growth_mindset:low', 'locus_of_control:low'],
    lines: [
      'When it went wrong you figured it was going to. You tried one small change before you called it.',
      'It felt bound to happen and not worth a try. You tested that on one small thing.',
    ],
  },
  {
    keys: ['steadiness:high', 'playfulness:high'],
    lines: [
      'You came back fast and found the joke. You checked the joke was not skipping a step.',
      'Light, and hard to shake. Someone on a heavier day needed you at their speed.',
    ],
  },
  {
    keys: ['steadiness:low', 'playfulness:high'],
    lines: [
      'You felt it hard and laughed anyway. The laugh was real, and so was the other thing.',
      'A lighter take got you through a heavy day. You let one person see the heavy part too.',
    ],
  },
  {
    keys: ['steadiness:low', 'conscientiousness:high'],
    lines: [
      'You kept going on a bad day. Getting it done and feeling fine were two separate checks.',
      'The work got finished. The mood did not lift. You gave the mood ten minutes of its own.',
    ],
  },
  {
    keys: ['steadiness:low', 'attachment_anxiety:high'],
    lines: [
      'A small thing with someone you like took the whole day. You asked them, and the day came back.',
      'You felt it for a long time and read into the quiet. You checked one story against the texts.',
    ],
  },
  {
    keys: ['steadiness:high', 'agreeableness:high'],
    lines: [
      'You let it go and moved on. Easy to be around, so you made sure you were heard once today.',
      'Calm and easy made you the steady one in the room. You still took a bad hour for yourself.',
    ],
  },
  {
    keys: ['extraversion:high', 'conflict_assertiveness:high'],
    lines: [
      'You filled the room and said what you thought. You left a quieter person an opening.',
      'You went loud and clear. Once, you tried the same point quieter.',
    ],
  },
  {
    keys: ['extraversion:low', 'conflict_assertiveness:low'],
    lines: [
      'You stayed quiet and you let it go. The thing you did not say was still in the room.',
      'Quiet at the table and quiet in a disagreement. You picked one place to be heard.',
    ],
  },
  {
    keys: ['extraversion:low', 'conflict_assertiveness:high'],
    lines: [
      'You said little, then you said exactly what you thought. It landed harder for being rare.',
      'Quiet until it mattered. You gave a gentler line before the direct one.',
    ],
  },
  {
    keys: ['openness:high', 'autonomy:high'],
    lines: [
      'You wanted it new and you wanted it your way. A good idea from someone else still counted.',
      'You wanted the new plan, and you wanted to do it alone. You let someone come for one stop.',
    ],
  },
  {
    keys: ['openness:low', 'autonomy:low'],
    lines: [
      'You liked a known route that someone else had chosen. Today you chose one thing and changed one thing.',
      'Set and familiar suited you. A small surprise you picked yourself did not break that.',
    ],
  },
  {
    keys: ['conflict_cooperativeness:high', 'conflict_assertiveness:high'],
    lines: [
      'You said your piece and still looked for a deal you could both stand. The talk used both.',
      'Direct, then fair. Today the fair part went first.',
    ],
  },
  {
    keys: ['conflict_cooperativeness:high', 'conflict_assertiveness:low'],
    lines: [
      'You gave first and said little. You checked whether the deal still felt even to you.',
      'You made room for them and stepped back yourself. You took a little of that room back today.',
    ],
  },
  {
    keys: ['conflict_cooperativeness:low', 'conflict_assertiveness:high'],
    lines: [
      'You pushed your point and guarded what you wanted. You paused to ask if winning was the point.',
      'You leaned sharp and you did not bend. You saved that for the thing that actually mattered.',
    ],
  },
  {
    keys: ['self_efficacy:high', 'conscientiousness:low'],
    lines: [
      'You believed you could do it, then you left it for later. Later was getting crowded.',
      'Sure you could pull it off. Less sure when. You put a time on one thing.',
    ],
  },
  {
    keys: ['self_efficacy:low', 'conscientiousness:high'],
    lines: [
      'You doubted the big thing and did it anyway, step by step. The steps were the proof on the page.',
      'You finished what you were not sure you could start. You remembered that at the next start.',
    ],
  },
  {
    keys: ['relatedness:high', 'attachment_avoidance:high'],
    lines: [
      'You needed a real connection and you kept it a step away. Some of the tiredness sat in that gap.',
      'The day needed real contact to land, and that was the part you walked around. You walked toward it once.',
    ],
  },
  {
    keys: ['playfulness:high', 'conflict_assertiveness:low'],
    lines: [
      'You joked instead of disagreeing. The joke got a laugh. The issue stayed on the table.',
      'Light is how you step around a fight. You said the plain version once, with no punchline.',
    ],
  },
  {
    keys: ['playfulness:low', 'extraversion:high'],
    lines: [
      'You brought the crowd and not the play. You let the room be pointless for a minute.',
      'Around people a lot, and usually on a task. You tried around people and off the task.',
    ],
  },
  {
    keys: ['locus_of_control:high', 'steadiness:low'],
    lines: [
      'You blamed yourself and then carried it all day. You put it down at the door tonight.',
      'You decided it was your part, and it sat with you. You checked how big that part really was.',
    ],
  },
  {
    keys: ['agreeableness:high', 'relatedness:high'],
    lines: [
      'You kept people happy because you wanted them near. They would have stayed for the honest version.',
      'You went along to stay close. Close survived a no, and you tried one.',
    ],
  },
];

const STARTERS: readonly string[] = [
  'The first thing you put off this morning said more than the thing you did first.',
  'You kept one small promise to yourself before lunch. The bigger ones got a little closer.',
  'The person you reply to fastest is a clue. So is the name still sitting there.',
  'One honest sentence in the thread did more than ten polite ones.',
  'What you did in the first quiet minute was the real default.',
  'Somebody near you was waiting for one question. It was a single line.',
  'You keep almost opening the same doc. That one is probably the task.',
  'What you defended today gave away what you care about.',
  'Tired and bored feel the same at four. You checked which one it was before you quit.',
  'You did one thing slower than usual. Something showed up in the extra minute.',
  'The opinion you held back yesterday was still an opinion this morning.',
  'A small annoyance showed up. It was pointing at something larger, and you could see the shape.',
];

/** FNV-1a, 32-bit. Small, dependency-free, and stable across JS engines. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A line's identity everywhere: bundle, pool, and `daily_line_days.line_key`. */
export function lineId(text: string): string {
  return fnv1a(text).toString(36);
}

function draftLines(): DailyLine[] {
  const out: DailyLine[] = [];
  for (const axis of TRAIT_AXES) {
    for (const lean of ['high', 'low'] as const) {
      for (const text of SOLO[axis][lean]) {
        out.push({ id: lineId(text), keys: [lineKey(axis, lean)], text, source: 'authored' });
      }
    }
  }
  for (const pair of PAIRS) {
    for (const text of pair.lines) out.push({ id: lineId(text), keys: pair.keys, text, source: 'authored' });
  }
  for (const text of STARTERS) out.push({ id: lineId(text), keys: [], text, source: 'authored' });
  return out;
}

function loadedLines(): DailyLine[] {
  const out: DailyLine[] = [];
  for (const row of LOADED_LINES) {
    const keys = parseLeanTag(row.tag);
    if (!keys) continue;
    out.push({ id: lineId(row.text), keys, text: row.text, source: 'authored' });
  }
  return out;
}

/** True once emci's ticked lines have been loaded; the first-draft set is then unused. */
export const BANK_IS_LOADED = LOADED_LINES.length > 0;

/** The written bank that ships in the app. */
export const DAILY_LINES: readonly DailyLine[] = BANK_IS_LOADED ? loadedLines() : draftLines();

/**
 * Bank + pool. The picker reads this, not DAILY_LINES: lines that arrive from
 * `daily_line_pool` (newly authored rows, and this account's own AI lines) are
 * registered here by sync.ts. A shipped line always wins over a pool row with
 * the same text, so an authored line can never be relabelled as AI.
 */
const registry = new Map<string, DailyLine>(DAILY_LINES.map((line) => [line.id, line]));

export function allLines(): DailyLine[] {
  return [...registry.values()];
}

export function dailyLineById(id: string): DailyLine | null {
  return registry.get(id) ?? null;
}

/** Adds pool lines to the registry. Lines that break the rules are skipped. */
export function registerPoolLines(rows: readonly { tag: string; text: string; source: LineSource }[]): number {
  let added = 0;
  for (const row of rows) {
    const keys = parseLeanTag(row.tag);
    if (!keys || lineRuleViolation(row.text, { allowAdvice: row.source === 'authored' })) continue;
    const id = lineId(row.text);
    if (registry.has(id)) continue;
    registry.set(id, { id, keys, text: row.text, source: row.source });
    added += 1;
  }
  return added;
}

/** Back to the shipped bank only. Sign-out and the check script use this. */
export function resetPoolLines(): void {
  registry.clear();
  for (const line of DAILY_LINES) registry.set(line.id, line);
}
