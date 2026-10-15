/**
 * Daily visitors — the hand-written lines (roadmap step 4). Moment voice
 * (`src/lib/voice/moment-voice.ts`): one concrete modern moment, teased kindly, no advice, no slang,
 * never "you are" / "always". No model call anywhere. Ids `dv_<hero>_<nn>` are forever.
 * emci reads the bank (`docs/divecore/daily-visitors/review.md`) and flips the flag.
 */

export const VISITORS_COPY_REVIEWED = false;

export type VisitorLine = { id: string; text: string };

export type VisitorLines = {
  /** The day's notice body ("<Name> dropped by"). */
  arrive: VisitorLine;
  /** Greeting 1: the sticker. */
  sticker: VisitorLine;
  /** Greeting 2: just a line. */
  line: VisitorLine;
  /** Greeting 3: the rare look. */
  look: VisitorLine;
  /** Greeting 4+: alternates. */
  visits: readonly [VisitorLine, VisitorLine];
};

const l = (hero: string, n: number, text: string): VisitorLine => ({ id: `dv_${hero.replace(/-/g, '_')}_${String(n).padStart(2, '0')}`, text });

function lines(hero: string, t: [string, string, string, string, string, string]): VisitorLines {
  return {
    arrive: l(hero, 1, t[0]),
    sticker: l(hero, 2, t[1]),
    line: l(hero, 3, t[2]),
    look: l(hero, 4, t[3]),
    visits: [l(hero, 5, t[4]), l(hero, 6, t[5])],
  };
}

export const VISITOR_LINES: Readonly<Record<string, VisitorLines>> = {
  kael: lines('kael', [
    'Said “five minutes away” from the couch. Here now, though.',
    'Brought a sticker. Found it in a jacket I hadn’t worn since spring.',
    'Left my phone on silent so nobody knows I’m here. Very covert.',
    'This colour matched my visor. Now it matches your pet.',
    'Just passing. By passing I mean I opened maps to get here.',
    'Sat in the car for a minute first. Normal visiting stuff.',
  ]),
  kitsune: lines('kitsune', [
    'Typed “here” in the group chat, then actually came in.',
    'A sticker for the laptop lid, next to the other twelve.',
    'Saw your light on and pretended it was a coincidence.',
    'Kept this colour for a friend. Turns out that was you.',
    'Left three voice notes on the way. All of them said “almost there.”',
    'Came for one minute. It has been eleven.',
  ]),
  corvus: lines('corvus', [
    'Read the message, didn’t reply, showed up instead.',
    'Sticker. Slightly bent. It lived in my pocket all week.',
    'Muted four group chats to make time for this one visit.',
    'Moss suits a quiet room. Your pet agrees.',
    'Stood at the door scrolling until it felt less like knocking.',
    'Here for the calm. The notifications can wait outside.',
  ]),
  'neon-viper': lines('neon-viper', [
    'Posted “out tonight” and came here. Nobody needs the details.',
    'A sticker, peeled with zero rips. A personal best.',
    'Charged to 100% before leaving. Big night, clearly.',
    'This pink glows in the dark. Mostly in photos.',
    'Took the long way so the playlist could finish.',
    'Battery at 9%. Staying until it says 1%.',
  ]),
  archangel: lines('archangel', [
    'Replied “on my way” and, for once, meant it.',
    'A sticker. Wings included, no extra charge.',
    'Left the read receipts on today. Living dangerously.',
    'A little halo gold. Every room deserves one.',
    'Brought nothing but good news and a cold drink.',
    'Checked the weather twice for a four-minute walk.',
  ]),
  oni: lines('oni', [
    'Knocked once, then texted “outside” just to be sure.',
    'Sticker. The corner is chewed. Long story, short bus ride.',
    'Said “no plans tonight” out loud and felt very rich.',
    'Red for loud days. It goes with everything, apparently.',
    'Heard your pet from the street. Had to say hi.',
    'Set three alarms to leave on time. Ignored all three.',
  ]),
  elowen: lines('elowen', [
    'Watered every plant before leaving. Even the plastic one.',
    'A sticker, pressed flat inside a library book.',
    'Opened a tab called “read later” in March. Still later.',
    'Leaf green. Looks good on anyone who naps in the sun.',
    'Took a photo of the sky on the way. It looked fine in person too.',
    'Came in quietly, in case anyone was mid-nap.',
  ]),
  maldrath: lines('maldrath', [
    'Said “I’ll be quick.” Brought a snack for the long version.',
    'A sticker. Warm from the pocket, nothing dramatic.',
    'Changed my status to “busy” and came here to do nothing.',
    'Ember orange. For the cosy kind of loud.',
    'Left the group call “for a second.” That was an hour ago.',
    'Here to sit by the fire. The lamp counts.',
  ]),
  'cyber-shinobi': lines('cyber-shinobi', [
    'Arrived without a sound. The doorbell camera saw everything.',
    'Sticker delivered. Stealth rating: one crinkly wrapper.',
    'Turned location sharing off, then told everyone where I was.',
    'Cyan, like a screen at 2 a.m. Calmer, though.',
    'Hit snooze on the outside world for a bit.',
    'Came in through the door. Thought about the vent. Chose the door.',
  ]),
  raven: lines('raven', [
    'Had a whole speech ready. Just going to say hi.',
    'A sticker. I checked it was straight four times.',
    'Drafted a text, deleted it, came over instead.',
    'Slate blue. A quiet colour for a quiet corner.',
    'Here early. Walked around the block twice to be on time.',
    'Left someone on “seen.” Hiding here a while.',
  ]),
  'frost-lich': lines('frost-lich', [
    'Wore three layers for a two-minute walk.',
    'A sticker. Slightly frosty. Keep it out of the sun.',
    'Set the heating to 21 and called it a personality.',
    'Ice blue. Cool in the good way.',
    'Thawing out by the lamp. Five more minutes.',
    'Brought the cold in with me. Sorry about the draught.',
  ]),
  sak: lines('sak', [
    'Found the place with no maps. Asked one person. Twice.',
    'A sticker, a bit scuffed. Like my boots.',
    'Sent a thumbs-up instead of a reply. It did the job.',
    'Saddle brown. Goes with dust and long roads.',
    'Packed a bag for a quick visit. Old habits.',
    'Sat on the step a minute before knocking. Nice step.',
  ]),
  velkhar: lines('velkhar', [
    'Filling in today. The usual visitor sends their regards.',
    'A sticker. Took longer to choose than the trip took.',
    'Kept a reply in drafts for a week. Sent it from your doorstep.',
    'Violet. Looks like a secret, keeps none.',
    'Covering for a friend again. Happy to.',
    'Brought a book. Did not open it. Good visit.',
  ]),
  'void-raven': lines('void-raven', [
    'Standing in for someone today. Same snacks, new face.',
    'A sticker. It glows a little when nobody is looking.',
    'Went offline for an hour. The world kept going without me.',
    'Deep indigo. The colour of the last tab still open.',
    'Stepping in again. The rota likes me.',
    'Came for the quiet. Found it.',
  ]),
};

/** Card + notice copy (fixed, short; the card's boxes are sized for these). */
export const VISITOR_UI = {
  /** Notice lane: title ≤ 3 words, body one line even on an SE (the "!" over the visitor says "tap me"). */
  noticeTitle: 'Visitor',
  noticeBody: (name: string) => `${name} dropped by.`,
  cardTitle: (name: string) => `${name} dropped by`,
  sticker: (name: string) => `New sticker · ${name}`,
  look: (name: string) => `Rare look · ${name} tint`,
  lookHint: 'Wear it from Info → Style.',
  stickerHint: 'It’s in your sticker book: Info → Style.',
  keep: 'Keep it',
  bye: 'See you',
  bookTitle: 'Stickers',
  bookNote: (have: number, all: number) => `${have}/${all}. A visitor drops by each day. Say hi to collect.`,
  lookSource: 'From a visitor',
} as const;
