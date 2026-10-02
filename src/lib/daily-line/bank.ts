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

export const DAILY_LINE_COPY_REVIEWED = false;

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
      'New tends to pull harder than proven for you. Lately that pull might be the plan itself.',
      'You lean toward the door nobody has opened yet. Notice what gets left half-open behind you.',
      'Something untried will probably look better than it is today. Go anyway, with one eye open.',
      'You tend to get bored before you get finished. The boring part might be where it pays off.',
      'A different route usually feels like the point to you. Today the usual one might surprise you.',
      'Curiosity tends to do your deciding. Let it, and ask what it is steering you away from.',
    ],
    low: [
      'You tend to trust what has already worked. That is not stubborn, it is a filing system.',
      'The known path keeps earning your vote. One small detour today would not cancel it.',
      'New ideas usually get a look from you and then a seat in the waiting room. One might be ready.',
      'You lean toward what is proven. Lately the proven thing may have quietly stopped working.',
      'Familiar tends to feel like safe to you. They overlap most days, not every day.',
      'You rarely chase a thing just because it is new. Someone near you probably relies on that.',
    ],
  },
  conscientiousness: {
    high: [
      'You tend to finish what you start, even after the fun runs out. Check that today’s thing still deserves it.',
      'Follow-through comes easy to you lately. Rest might be the item that keeps slipping off the list.',
      'A plan in your hands usually gets done. The question today is whether it is still your plan.',
      'You lean on structure the way some people lean on luck. Leave one hour unassigned.',
      'Lately you keep your word to the calendar. Keeping one to yourself counts too.',
      'Done tends to matter more to you than well-timed. Someone may need you to go slower today.',
    ],
    low: [
      'You tend to decide in the moment. One small decision made early could buy you the afternoon.',
      'Loose plans suit you. The dull stretch right before you bail might be the last one.',
      'You lean toward keeping options open. One of them has probably been waiting a while.',
      'Lately the plan bends to your mood. Try letting it hold for twenty minutes first.',
      'You tend to start strong and drift. Drifting is information, so notice where toward.',
      'Structure tends to feel like a cage to you. A small one, built by you, might feel like a floor.',
    ],
  },
  extraversion: {
    high: [
      'People tend to wake you up. Notice who you reach for today when the room goes quiet.',
      'You lean toward making something happen. Today the room might not need a spark, just a witness.',
      'A full room usually charges you. The quiet one afterwards might be telling you something too.',
      'You tend to think out loud. Someone close may be waiting for the sentence you have not said yet.',
      'Lately your energy goes outward first. Save a little of it for the walk home.',
      'You usually would rather be in it than watch it. Five minutes of watching could show you the whole board.',
    ],
    low: [
      'Quiet tends to be how you reset. It is not hiding if you come back.',
      'A full room costs you more than it costs most. Budget for it and go, or skip it on purpose.',
      'You lean toward the edge of the group. The view is better there, and people notice you noticing.',
      'You tend to say less and mean more. Today one extra sentence might land well.',
      'Lately your best company has been your own. One person might be worth the interruption.',
      'You usually leave before people tire you out. That might be why they light up when you arrive.',
    ],
  },
  agreeableness: {
    high: [
      'You tend to go along to keep it easy. Easy for whom is worth a second look today.',
      'A fuss rarely feels worth it to you. One small no today would cost less than you think.',
      'You lean toward yes. Lately some of those yeses might have been maybes in a hurry.',
      'You usually smooth the room before anyone asks. Notice whether anyone smooths it for you.',
      'Keeping the peace tends to fall to you. It is fine to hand it to someone else for a day.',
      'You tend to give the benefit of the doubt. Give yourself the same rate.',
    ],
    low: [
      'You tend to hold your ground. Today it might be worth checking the ground is still worth holding.',
      'Pretending to like the plan is rarely your move. Saying why, kindly, might get you further.',
      'You lean toward honest over easy. Someone today may only be able to hear the easy version.',
      'Lately you have not bent much. One bend, chosen by you, is not the same as giving in.',
      'You usually say the thing others are thinking. Leave a beat for them to say it first.',
      'You tend to trust slowly. The people who waited it out have probably earned a look.',
    ],
  },
  steadiness: {
    high: [
      'A bad start tends to slide off you by lunch. Someone near you may still be carrying theirs.',
      'You usually recover fast. Fast enough, sometimes, to skip what the bad moment was pointing at.',
      'Not much sticks to you lately. Worth asking if anything should.',
      'You tend to steady the room without trying. Notice who is leaning on that today.',
      'You lean toward calling it fine, and it often is. Today, check before you say it.',
      'Rough patches tend to pass through you quickly. Let one finish its sentence.',
    ],
    low: [
      'A small knock can color your whole day. Try naming it once and seeing how big it stays.',
      'You tend to feel things for longer than the moment lasts. That is also why you remember what matters.',
      'Lately a bad morning has a long tail. It is allowed to end at lunch.',
      'You lean toward carrying it. Put one thing down today, even if only until tomorrow.',
      'Things tend to land harder on you. They also tend to teach you more.',
      'The mood might arrive before the reason today. You do not have to find the reason to let it pass.',
    ],
  },
  attachment_anxiety: {
    high: [
      'A slow reply can start to feel like a verdict. Today it is most likely just a slow reply.',
      'You tend to read silence closely. Sometimes it is only someone being busy.',
      'You lean toward checking where you stand. You probably stand where you stood yesterday.',
      'Lately a pause from someone you like gets loud. Ask the question instead of answering it for them.',
      'You tend to notice distance before anyone else does. Noticing it is not the same as it being there.',
      'While waiting, the story in your head tends to get ahead of the facts. Wait for the actual ending.',
    ],
    low: [
      'A slow reply is just a slow reply to you. Someone close may need more reassurance than you would.',
      'You tend not to dwell on people leaving. That calm can read as distance, so say the warm thing out loud.',
      'You lean toward trusting that people will stay. Thank one of them for staying.',
      'Lately you have not needed much proof from people. Offer some anyway.',
      'You rarely keep score of who texted last. Someone you like might be keeping it for both of you.',
      'Space does not tend to scare you. Check that the other person signed up for the same amount.',
    ],
  },
  attachment_avoidance: {
    high: [
      'You tend to keep a little distance, even from people you like. Close one inch of it today.',
      'Lighter and over text is usually easier for you. One thing today may deserve your actual voice.',
      'You lean toward handling it alone. Letting someone help is not the same as owing them.',
      'Lately you leave the room a moment before it gets real. Try staying for that moment.',
      'You tend to need an exit in sight. Someone might be standing in the doorway hoping you stay.',
      'Closeness tends to feel like a cost to you first. Sometimes it is the refund.',
    ],
    low: [
      'Once in, you tend to stay close. Make sure today that close still leaves room for you.',
      'You lean toward talking it out in person. Not everyone can meet you there on the first try.',
      'You tend to show up fully for your people. Notice which of them shows up the same way.',
      'Lately you have been easy to reach. An unreachable hour is allowed.',
      'Staying close comes naturally to you. Someone who needs space is not saying no.',
      'You usually move toward people when it gets hard. That is rarer than you think.',
    ],
  },
  conflict_assertiveness: {
    high: [
      'You tend to put your point on the table. Today, leave room on the table for a second one.',
      'A disagreement rarely scares you. The other person might need a softer start than you would.',
      'You lean toward saying it straight. Straight and warm can fit in one sentence.',
      'Lately you win the argument. Check whether you also kept the person.',
      'You usually speak first in a standoff. Speaking second today might tell you more.',
      'Your point tends to arrive a little sharp. It would land the same with the edge off.',
    ],
    low: [
      'You tend to step back in a disagreement. One thing you let go lately might be worth picking back up.',
      'Letting it go is usually your move. Today, check whether it actually went.',
      'You lean toward peace over being right. Your side still deserves to be heard once.',
      'Lately you have swallowed a few small things. They add up to one medium thing.',
      'You tend to wait for a better moment to say it. This one may be good enough.',
      'Backing off tends to feel safer to you. Say half of it today and see what happens.',
    ],
  },
  conflict_cooperativeness: {
    high: [
      'You tend to look for what the other person can live with. Ask what you can live with too.',
      'You usually give first. Today, wait and see if they will.',
      'You lean toward the middle ground. Sometimes the middle is just both people unhappy.',
      'Lately you have been the one who bends. It is fair to ask for the next bend back.',
      'A fair deal tends to matter more to you than a win. Make sure fair includes you.',
      'You tend to hear the other side out fully. Check that someone has heard yours.',
    ],
    low: [
      'You tend to protect your outcome first. One small give today might buy a lot of goodwill.',
      'You rarely give ground early. The other person may be closer to yes than they look.',
      'You lean toward knowing what you want and holding it. Ask what they want before you defend it.',
      'Lately you have not had to bend much. Bending once on something small costs you nothing.',
      'You usually leave a negotiation with what you came for. Check what the other person left with.',
      'Holding your line comes easy to you. Knowing which lines matter is the harder part.',
    ],
  },
  autonomy: {
    high: [
      'You tend to want to do it your way. Today someone else’s way might save you an hour.',
      'A plan handed to you rarely fits. Say which part you would change instead of dropping the whole thing.',
      'You lean toward your own path, even when one is already paved. The paved one is not an insult.',
      'Lately being told what to do sits badly. Notice whether the advice was actually wrong.',
      'You usually need to choose it for it to count. Choose one thing today you were going to be told anyway.',
      'Your way tends to work for you. It might not be the only way that does.',
    ],
    low: [
      'A path already set tends to suit you fine. Pick one small thing today that nobody picked for you.',
      'You lean toward letting someone else steer. It is fine to want a turn.',
      'You usually feel relief when the plan is made. Notice what you would have chosen.',
      'Lately you go with what is already decided. Your preference still exists, so say it once.',
      'Not having to figure it out tends to feel like rest to you. Figure out one thing anyway.',
      'You tend to trust the map you get handed. Today, check who drew it.',
    ],
  },
  competence: {
    high: [
      'A hard task tends to feel like yours to handle. Today, check it is yours at all.',
      'You usually trust yourself to pull it off. Someone next to you may need to borrow a little of that.',
      'You lean toward the difficult version. The easy version is allowed sometimes.',
      'Lately hard things have gone your way. Notice what you have been avoiding because it is only dull.',
      'You tend to feel capable going in. Ask for help anyway and see how it changes the work.',
      'You rarely doubt you can do it. The better question today might be whether you want to.',
    ],
    low: [
      'A hard task can make you doubt yourself before you start. Start badly on purpose and see what happens.',
      'You tend to count what could go wrong first. Count one thing that went right last time.',
      'Lately the hard thing looks bigger from outside than it is. Do the first five minutes only.',
      'You lean toward assuming others would do it better. They are mostly guessing too.',
      'The doubt tends to show up before the evidence does. Wait for the evidence.',
      'You usually underrate what you have already pulled off. Write one of them down today.',
    ],
  },
  relatedness: {
    high: [
      'A day tends not to land for you without a real connection in it. Plan for one, do not hope for one.',
      'You usually need one real conversation to feel like yourself. Start it.',
      'You lean toward people being the point. Today the point might text first, or might need you to.',
      'Lately small talk leaves you hungry. Ask the second question.',
      'You tend to measure a day by who was in it. Someone is measuring theirs by you.',
      'Being around people and being with them feel different to you. Close that gap once today.',
    ],
    low: [
      'A day can land for you without much connection. One person may still be hoping to hear from you.',
      'You tend to be fine on your own. Fine and full can be two different days.',
      'You lean toward not needing much from people. Let someone give you something small anyway.',
      'Lately you have gone a while without a real conversation and barely noticed. Notice.',
      'You usually do not count the days between calls. Someone you like does.',
      'Your own company tends to be enough. Share a little of it today.',
    ],
  },
  growth_mindset: {
    high: [
      'After a miss you tend to look for what to change. Today, also look at what to keep.',
      'You usually treat a mistake as a draft. Let one thing be finished.',
      'You lean toward "not yet" over "no". Someone near you needs to hear that version.',
      'Lately everything looks like something to improve. Some of it is already good.',
      'You tend to believe you can get better at most things. Pick the one that matters this week.',
      'A setback tends to turn into a project for you. Rest first, then the project.',
    ],
    low: [
      'A miss can feel like the end of that road to you. It is more often a bend.',
      'You tend to decide early what is not your thing. One of those verdicts is probably out of date.',
      'Lately one bad try has been closing the door. Try it a second time before you lock it.',
      'You lean toward sticking with what you already do well. One clumsy attempt today will not undo that.',
      'You usually judge the first attempt as the final grade. It is the rough copy.',
      'Some things tend to feel fixed to you. Test one of them gently.',
    ],
  },
  locus_of_control: {
    high: [
      'When things go sideways you tend to look at your own part first. Not all of it was yours.',
      'You usually ask what you could have done differently. Sometimes the answer is nothing.',
      'You lean toward owning the outcome. Leave a share for luck and for other people.',
      'Lately you take the blame quickly. Take the credit at the same speed.',
      'You tend to believe your choices decide the day. Mostly true, and today there is weather too.',
      'Your first move is usually to fix it yourself. Ask whether it is yours to fix.',
    ],
    low: [
      'You tend to figure it was bound to happen. One small part of today is still yours to move.',
      'You usually let things play out. Nudge one of them.',
      'Lately it feels like the day happens to you. Pick the next ten minutes on purpose.',
      'You lean toward "that is just how it goes". Sometimes it goes how someone pushed it.',
      'You rarely blame yourself for what you could not control. Check for the piece you could.',
      'Timing and luck tend to get the credit from you. Give yourself a line in the credits too.',
    ],
  },
  self_efficacy: {
    high: [
      'A big task tends to look doable to you. Break it up anyway, your future self will thank you.',
      'You usually back yourself. Today, back someone else out loud.',
      'You lean toward yes when it is large. Check your week before you check your nerve.',
      'Lately you have said "I can do that" a lot. You can, though maybe not all at once.',
      'Confidence tends to get you through the door. Preparation keeps you in the room.',
      'You tend to assume you will figure it out, and you usually do. Start earlier and enjoy it more.',
    ],
    low: [
      'A big task can look too big from the start. It tends to shrink once you touch it.',
      'You tend to wait until you feel ready. Ready usually shows up after you begin.',
      'Lately the size of the thing has been deciding for you. Pick the smallest piece and take that.',
      'You lean toward "not sure I can". Being sure is optional, starting is the part that counts.',
      'You usually see the whole mountain at once. Look at the next step only.',
      'The big thing tends to stay big while you circle it. One clumsy pass will change its size.',
    ],
  },
  playfulness: {
    high: [
      'You tend to look for the lighter take. Make sure the joke is not doing a job a sentence should.',
      'Fun usually finds you. One person in the room may need you to be serious for a minute.',
      'You lean toward play, even in a dull task. That is a skill, not a distraction.',
      'Lately you laugh it off fast. Check whether it is actually off.',
      'You tend to turn a chore into a game. Invite someone into it today.',
      'Light tends to be your default. It can carry something heavy if you let it.',
    ],
    low: [
      'You tend to treat the day as a job to get through. One part of it could be a game.',
      'You usually get to the fun after the work, and the work rarely ends. Move the fun up.',
      'Lately the day has been all list. Leave one line blank.',
      'You lean toward serious. Something silly today will not cost you your edge.',
      'You tend to earn your rest before you take it. Take five minutes unearned.',
      'Getting through it is usually the goal for you. Today, try enjoying one piece of it.',
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
      'You tend to be easy to be around and slower to let people close. Someone may be hoping for the second part.',
      'Lots of people, few who really know you. Lately that might be by design.',
    ],
  },
  {
    keys: ['extraversion:low', 'relatedness:high'],
    lines: [
      'You tend to need real connection and also quiet. One person, one hour, is the size that fits.',
      'Crowds drain you, and being unknown drains you more. Pick the one person today.',
    ],
  },
  {
    keys: ['extraversion:high', 'relatedness:low'],
    lines: [
      'You tend to like the room without needing anyone in it. Someone there might want more than the room.',
      'People energize you, though few of them get far in. Let one get a step further.',
    ],
  },
  {
    keys: ['conscientiousness:high', 'playfulness:low'],
    lines: [
      'You tend to finish the list and skip the fun. The list will regrow by morning either way.',
      'Work first is your rule, and work rarely ends. Put one light thing on the list itself.',
    ],
  },
  {
    keys: ['conscientiousness:high', 'openness:high'],
    lines: [
      'You tend to chase the new thing and still finish it. That is rarer than it feels.',
      'Lately you want it both new and done. Pick which matters more for today’s thing.',
    ],
  },
  {
    keys: ['conscientiousness:low', 'openness:high'],
    lines: [
      'New ideas come easy to you and finishing comes hard. Pick one idea today and give it an ending.',
      'You tend to open more doors than you walk through. Walk through one.',
    ],
  },
  {
    keys: ['conscientiousness:high', 'openness:low'],
    lines: [
      'You tend to do it the proven way and do it fully. Today a shortcut might actually be fine.',
      'A plan and a known path is your home ground. Step off it once, on purpose, for ten minutes.',
    ],
  },
  {
    keys: ['conscientiousness:low', 'playfulness:high'],
    lines: [
      'You tend to follow the fun and let the plan catch up. Give the plan a small head start today.',
      'Loose and light is how you move lately. One fixed point would not spoil it.',
    ],
  },
  {
    keys: ['agreeableness:high', 'conflict_assertiveness:low'],
    lines: [
      'You tend to go along and then step back. Your opinion has been waiting a while for its turn.',
      'Easy for everyone else has been costing you lately. Say one true preference before noon.',
    ],
  },
  {
    keys: ['agreeableness:high', 'conflict_assertiveness:high'],
    lines: [
      'You tend to keep things easy until it matters, then say it straight. People may not see that turn coming.',
      'Kind and direct both live in you. Today, lead with whichever one you used less this week.',
    ],
  },
  {
    keys: ['agreeableness:low', 'conflict_assertiveness:high'],
    lines: [
      'You tend to hold your ground and say so. Being right will land better today with a softer first line.',
      'You rarely fold and rarely stay quiet. Ask one question before you make your point.',
    ],
  },
  {
    keys: ['agreeableness:low', 'conflict_assertiveness:low'],
    lines: [
      'You tend to disagree quietly. The other person may think you agreed.',
      'You hold your ground on the inside and step back on the outside. Let one of those show today.',
    ],
  },
  {
    keys: ['attachment_anxiety:high', 'attachment_avoidance:high'],
    lines: [
      'You tend to want people close and keep them at arm’s length. Both are you looking out for yourself.',
      'Lately you may want more than you show. Show one inch more today.',
    ],
  },
  {
    keys: ['attachment_anxiety:high', 'attachment_avoidance:low'],
    lines: [
      'You tend to stay close and still worry they will go. Staying is already your answer, so ask for theirs.',
      'You show up fully and then check if it was too much. It probably was not.',
    ],
  },
  {
    keys: ['attachment_anxiety:low', 'attachment_avoidance:high'],
    lines: [
      'You tend to be calm about people because you keep them at a distance. Try calm and close.',
      'Not much rattles you with people lately, maybe because few get near. Let one near.',
    ],
  },
  {
    keys: ['attachment_anxiety:low', 'attachment_avoidance:low'],
    lines: [
      'You tend to stay close without gripping. People around you probably rest easier for it.',
      'Close comes easy and worry stays low lately. Lend that calm to someone who has less of it.',
    ],
  },
  {
    keys: ['autonomy:high', 'relatedness:high'],
    lines: [
      'You tend to want it your way and want company for it. Say both out loud, people cannot guess the mix.',
      'Independent and hungry for connection is not a contradiction. It just needs explaining to people.',
    ],
  },
  {
    keys: ['autonomy:high', 'relatedness:low'],
    lines: [
      'You tend to do it your way and do it alone. Efficient, and a little unwitnessed.',
      'Nobody steering and nobody needed is how you run lately. Let someone in on one decision.',
    ],
  },
  {
    keys: ['autonomy:low', 'relatedness:high'],
    lines: [
      'You tend to follow the plan if it keeps you near your people. Check the plan is going where you want.',
      'Going along feels fine when the company is good. Your own pick still counts today.',
    ],
  },
  {
    keys: ['autonomy:high', 'agreeableness:high'],
    lines: [
      'You tend to want your own way and still say yes to theirs. Today, notice which one wins.',
      'You go along on the outside and plan your own route on the inside. Say the route.',
    ],
  },
  {
    keys: ['competence:low', 'growth_mindset:high'],
    lines: [
      'You tend to doubt yourself going in and learn fast coming out. Trust the second half more.',
      'The doubt arrives first and the progress arrives anyway. Notice the order.',
    ],
  },
  {
    keys: ['competence:high', 'growth_mindset:low'],
    lines: [
      'You tend to feel capable at what you know and finished with what you do not. One of those is closer than it looks.',
      'You trust yourself on home ground. A miss away from it does not have to close the road.',
    ],
  },
  {
    keys: ['growth_mindset:high', 'locus_of_control:high'],
    lines: [
      'You tend to own the miss and then fix it. Leave room today for "that one was not on me".',
      'Everything is a lesson and all of it is yours to learn. Some days it is just a day.',
    ],
  },
  {
    keys: ['growth_mindset:low', 'locus_of_control:low'],
    lines: [
      'When it goes wrong you tend to figure it was going to. Try one small change before you call it.',
      'Lately it can feel bound to happen and not worth trying. Test that against one small thing.',
    ],
  },
  {
    keys: ['steadiness:high', 'playfulness:high'],
    lines: [
      'You tend to bounce back and find the joke. Check today that the joke is not skipping a step.',
      'Light and hard to rattle. Someone on a heavier day may need you to slow down to their speed.',
    ],
  },
  {
    keys: ['steadiness:low', 'playfulness:high'],
    lines: [
      'You tend to feel it hard and laugh anyway. The laugh is real, and so is the other thing.',
      'A lighter take is your way through a heavy day. Let one person see the heavy part too.',
    ],
  },
  {
    keys: ['steadiness:low', 'conscientiousness:high'],
    lines: [
      'You tend to keep going on a bad day. Getting it done and being fine are two separate checks.',
      'The work gets finished even when the mood does not lift. Give the mood ten minutes of its own.',
    ],
  },
  {
    keys: ['steadiness:low', 'attachment_anxiety:high'],
    lines: [
      'A small thing with someone you like can take the whole day. Ask them, and get the day back.',
      'You tend to feel it long and read into the quiet. Check one story against the facts today.',
    ],
  },
  {
    keys: ['steadiness:high', 'agreeableness:high'],
    lines: [
      'You tend to let it go and move on. That is easy to be around, so make sure you get heard once today.',
      'Calm and easygoing makes you the steady one. Steady people get to have a bad day too.',
    ],
  },
  {
    keys: ['extraversion:high', 'conflict_assertiveness:high'],
    lines: [
      'You tend to fill the room and say what you think. Quieter people today may need an opening.',
      'You tend toward loud and clear. Try clear and quiet once.',
    ],
  },
  {
    keys: ['extraversion:low', 'conflict_assertiveness:low'],
    lines: [
      'You tend to stay quiet and let it go. The thing you did not say is still there.',
      'Quiet in the room and quiet in a disagreement. Pick one place today to be heard.',
    ],
  },
  {
    keys: ['extraversion:low', 'conflict_assertiveness:high'],
    lines: [
      'You tend to say little, and then say exactly what you think. It lands harder for being rare.',
      'Quiet until it matters. Give people a gentler line before the direct one.',
    ],
  },
  {
    keys: ['openness:high', 'autonomy:high'],
    lines: [
      'You tend to want it new and want it your way. A good idea from someone else still counts.',
      'Untried and unassisted is your favorite route. Take a passenger.',
    ],
  },
  {
    keys: ['openness:low', 'autonomy:low'],
    lines: [
      'You tend to like a known path that someone else chose. Today, choose one thing and change one thing.',
      'Set and familiar suits you. A small surprise you pick yourself will not break that.',
    ],
  },
  {
    keys: ['conflict_cooperativeness:high', 'conflict_assertiveness:high'],
    lines: [
      'You tend to say your piece and still look for the fair deal. That is a hard pair, and you carry it.',
      'Direct and fair. Today the fair part may need to go first.',
    ],
  },
  {
    keys: ['conflict_cooperativeness:high', 'conflict_assertiveness:low'],
    lines: [
      'You tend to give first and say little. Check whether the deal still feels even to you.',
      'You make room for them and step back yourself. Take up one square foot today.',
    ],
  },
  {
    keys: ['conflict_cooperativeness:low', 'conflict_assertiveness:high'],
    lines: [
      'You tend to push your point and guard your outcome. You will likely win, so decide if winning is the goal.',
      'Lately you lean sharp and unbending. Save that hand for something that matters.',
    ],
  },
  {
    keys: ['self_efficacy:high', 'conscientiousness:low'],
    lines: [
      'You tend to believe you can do it and then leave it for later. Later is getting crowded.',
      'Sure you can pull it off, less sure when. Put a time on one thing.',
    ],
  },
  {
    keys: ['self_efficacy:low', 'conscientiousness:high'],
    lines: [
      'You tend to doubt the big thing and do it anyway, step by step. The steps are the proof.',
      'You finish what you were not sure you could start. Remember that at the next start.',
    ],
  },
  {
    keys: ['relatedness:high', 'attachment_avoidance:high'],
    lines: [
      'You tend to need connection and keep it at a distance. That gap might be where some of the tiredness comes from.',
      'A day needs real contact to land for you, and lately that is the part you step around. Step toward it once.',
    ],
  },
  {
    keys: ['playfulness:high', 'conflict_assertiveness:low'],
    lines: [
      'You tend to joke instead of disagree. The joke gets a laugh and the issue stays.',
      'Light is how you sidestep a fight. Say the plain version once today.',
    ],
  },
  {
    keys: ['playfulness:low', 'extraversion:high'],
    lines: [
      'You tend to bring the energy but not the play. Let the room be pointless for a minute.',
      'Around people a lot, and usually on task. Try around people and off task.',
    ],
  },
  {
    keys: ['locus_of_control:high', 'steadiness:low'],
    lines: [
      'You tend to blame yourself and then carry it all day. Put it down at the door tonight.',
      'It was your part, you think, and it sits with you. Check how big your part really was.',
    ],
  },
  {
    keys: ['agreeableness:high', 'relatedness:high'],
    lines: [
      'You tend to keep people happy because you need them near. They would stay for the honest version too.',
      'You go along to stay close. Close survives a no.',
    ],
  },
];

const STARTERS: readonly string[] = [
  'Notice the first thing you put off today. It usually says more than the thing you do first.',
  'Pick one small promise to yourself today and keep it. That is how the bigger ones get believable.',
  'The person you reply to fastest today is telling you something. So is the one you leave on read.',
  'One honest sentence today is worth ten polite ones.',
  'Notice what you do in the first quiet minute. That tends to be the real default.',
  'Somebody near you is waiting to be asked. Ask.',
  'The thing you keep almost starting is probably the thing.',
  'Watch what you defend today. It tends to be what you care about.',
  'Tired and bored feel alike. Check which one it is before you quit.',
  'Do one thing slower than usual today and see what shows up.',
  'The opinion you held back yesterday is still an opinion. It might be worth saying.',
  'Something small will annoy you today. It is usually pointing at something larger.',
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
