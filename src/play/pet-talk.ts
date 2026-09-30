/**
 * Pet talk (room overhaul, 2026-09-29) — short speech-bubble lines, written
 * here (no AI calls), picked by what is happening and in each form's voice:
 * Bright cheerful, Scruffy grumpy, Battle hyped, Deep dreamy, Standard
 * neutral. Idle chatter, happy and hungry have at least 6 lines per form;
 * every other situation at least 3 — `check:pet-talk` holds that, the length
 * cap, the no-repeat picker and GAME_SPEC §7's banned words.
 *
 * Text only for now — sound and vibration need a native build.
 */
import type { PetBranch } from './pet';
import type { PetStatus } from './pet-status';

export const PET_TALK_SITUATIONS = [
  'chatter',
  'happy',
  'hungry',
  'sad',
  'sleepy',
  'surfaced',
  'busted',
  'rare_find',
  'expedition_back',
  'evolving_soon',
  'evolved',
  'waves_cleared',
  'morning',
  'afternoon',
  'evening',
] as const;
export type PetTalkSituation = (typeof PET_TALK_SITUATIONS)[number];

/** Situations that need the bigger pool (6+ lines per form). */
export const PET_TALK_BIG: readonly PetTalkSituation[] = ['chatter', 'happy', 'hungry'];
export const PET_TALK_MIN_BIG = 6;
export const PET_TALK_MIN = 3;
/** A bubble line never runs longer than this. */
export const PET_TALK_MAX_CHARS = 48;

type Lines = Record<PetTalkSituation, readonly string[]>;

const STANDARD: Lines = {
  chatter: [
    'Hi there.',
    'Just looking around.',
    'Nice room.',
    'What shall we do next?',
    'I like it here.',
    'Hm. Quiet day.',
    'Thinking about the sea.',
  ],
  happy: [
    'Feeling good!',
    'This is nice.',
    'All is well.',
    'Glad you’re here.',
    'Good day today.',
    'I’m doing great.',
  ],
  hungry: [
    'I’m getting hungry.',
    'Snack time?',
    'My tummy’s rumbling.',
    'Some food would be nice.',
    'Is there anything to eat?',
    'Could use a bite.',
  ],
  sad: ['I’m a bit down.', 'Could we play?', 'Feeling low today.'],
  sleepy: ['Getting sleepy…', 'Time for bed.', 'Zzz…'],
  surfaced: ['Back up. Good haul.', 'That went well.', 'Fresh air again.'],
  busted: ['That one got away.', 'Oof. Next time.', 'Lost it. Still here!'],
  rare_find: ['Ooh, a rare one!', 'Look what we found!', 'That’s a good find.'],
  expedition_back: ['I’m back!', 'Found something out there.', 'Good trip. Missed you.'],
  evolving_soon: ['I feel different…', 'Something’s changing.', 'Almost time to grow.'],
  evolved: ['I grew!', 'New me. What do you think?', 'Look how big I am!'],
  waves_cleared: ['Nice defending.', 'Waves cleared. Well done.', 'We held the line.'],
  morning: ['Good morning.', 'Morning. Sleep well?', 'A new day.'],
  afternoon: ['Good afternoon.', 'Afternoon already.', 'Halfway through the day.'],
  evening: ['Good evening.', 'Getting dark out.', 'Evening. Nearly bedtime.'],
};

const BRIGHT: Lines = {
  chatter: [
    'La la la!',
    'Today is the best day!',
    'I love this room!',
    'Wanna see me spin?',
    'Everything sparkles!',
    'You’re my favourite!',
    'Hehe, hi again!',
  ],
  happy: [
    'Yay, I’m so happy!',
    'Best. Day. Ever!',
    'I could dance all day!',
    'Sunshine inside me!',
    'Hooray for us!',
    'Happy happy happy!',
  ],
  hungry: [
    'Ooh, is it snack time?',
    'My tummy’s singing!',
    'Food please, pretty please?',
    'Yummy things, where are you?',
    'Tiny tummy, big hunger!',
    'Feed me and I’ll twirl!',
  ],
  sad: ['Aw… a hug would help.', 'I’m a little blue.', 'Play with me? Please?'],
  sleepy: ['Sleepy sparkles…', 'Night night!', 'Dreaming of sunshine…'],
  surfaced: ['We did it, we did it!', 'Treasure time!', 'Splash! We’re back!'],
  busted: ['Oopsie! It’s okay!', 'Next dive will be great!', 'Bubbles got us! Hehe.'],
  rare_find: ['So shiny! I love it!', 'Wow wow wow!', 'A sparkly one!'],
  expedition_back: ['I’m home! Missed you!', 'I brought a present!', 'What an adventure!'],
  evolving_soon: ['I feel all tingly!', 'Something exciting is coming!', 'Ooh, I’m glowing!'],
  evolved: ['Ta-da! New me!', 'I’m even brighter now!', 'Look, look! I grew!'],
  waves_cleared: ['You’re amazing!', 'Wave party!', 'We rock!'],
  morning: ['Good morning, sunshine!', 'Rise and shine!', 'Morning hugs!'],
  afternoon: ['Afternoon fun time!', 'Still a lovely day!', 'Hi hi, afternoon!'],
  evening: ['Pretty evening sky!', 'Evening cuddles?', 'Stars soon!'],
};

const SCRUFFY: Lines = {
  chatter: [
    'Hmph.',
    'What are you looking at?',
    'This room’s too bright.',
    'Leave me be. Or don’t.',
    'Meh.',
    'I was napping, you know.',
    'Fine. Hi.',
  ],
  happy: [
    'Okay, this isn’t bad.',
    'Don’t tell anyone I’m happy.',
    'Fine. I’m content.',
    'Could be worse. Much worse.',
    'Hmph. Nice, I suppose.',
    'I’ll allow it.',
  ],
  hungry: [
    'Where’s my food?',
    'Feed me. Now.',
    'Starving over here.',
    'Food. Food. Food.',
    'You forgot me again.',
    'My bowl’s empty. Again.',
  ],
  sad: ['Nobody plays with me.', 'Whatever.', 'Leave me alone… or play.'],
  sleepy: ['Go away, I’m sleeping.', 'Zzz. Don’t poke me.', 'Lights off.'],
  surfaced: ['Wet. But worth it.', 'Fine haul, I guess.', 'Dry me off.'],
  busted: ['Told you so.', 'Ugh. Soggy for nothing.', 'Typical.'],
  rare_find: ['Huh. Not bad.', 'Okay, that’s shiny.', 'Mine now.'],
  expedition_back: ['I’m back. You’re welcome.', 'Long trip. Feed me.', 'Brought you a thing.'],
  evolving_soon: ['Something’s itchy.', 'I feel weird. Don’t stare.', 'Growing again? Ugh.'],
  evolved: ['Bigger. Still grumpy.', 'New look. Same me.', 'Don’t make a fuss.'],
  waves_cleared: ['About time.', 'Took you long enough.', 'Fine. Good job.'],
  morning: ['Too early.', 'Morning. Ugh.', 'Coffee? No? Hmph.'],
  afternoon: ['Nap time, surely.', 'Afternoon. So what.', 'Still here. Still grumpy.'],
  evening: ['Finally, quiet.', 'Evening. Good.', 'Wake me tomorrow.'],
};

const BATTLE: Lines = {
  chatter: [
    'Ready for action!',
    'Hi-yah!',
    'Let’s go, let’s go!',
    'Any waves to smash?',
    'Training never stops!',
    'I’m on guard!',
    'Watch this move!',
  ],
  happy: [
    'Pumped up!',
    'Full power!',
    'Nothing can stop us!',
    'I feel unstoppable!',
    'Maximum energy!',
    'Let’s win today!',
  ],
  hungry: [
    'Need fuel!',
    'Can’t fight on empty!',
    'Feed the warrior!',
    'Power low — food, please!',
    'Hungry for action… and snacks!',
    'Refuel me!',
  ],
  sad: ['Morale’s low…', 'Need a sparring partner.', 'Train with me?'],
  sleepy: ['Resting for battle…', 'Recharging…', 'Guard duty tomorrow…'],
  surfaced: ['Mission complete!', 'Loot secured!', 'Back from the deep!'],
  busted: ['Retreat! Regroup!', 'We’ll get it next time!', 'Just a scratch!'],
  rare_find: ['Legendary loot!', 'Whoa, epic find!', 'Victory spoils!'],
  expedition_back: ['Scout report: success!', 'Back from the field!', 'Mission done!'],
  evolving_soon: ['Power surging!', 'Level up incoming!', 'I can feel it!'],
  evolved: ['Power up complete!', 'Stronger than ever!', 'New form, new moves!'],
  waves_cleared: ['Waves crushed!', 'That’s how it’s done!', 'Victory!'],
  morning: ['Morning drills!', 'Up and ready!', 'Dawn patrol!'],
  afternoon: ['Afternoon sparring?', 'Still fired up!', 'Midday power!'],
  evening: ['Evening watch!', 'Good fight today!', 'Rest, then battle!'],
};

const DEEP: Lines = {
  chatter: [
    'The sea is humming…',
    'I dreamed of coral.',
    'Do you hear the tide?',
    'Floating is nice…',
    'So many bubbles…',
    'The deep is calling.',
    'Hmm… drifting.',
  ],
  happy: [
    'Calm as still water.',
    'I feel like a gentle wave.',
    'Warm currents today.',
    'Peaceful…',
    'Glowing softly.',
    'All is calm below.',
  ],
  hungry: [
    'A little kelp, maybe?',
    'Hungry as the tide…',
    'Dreaming of glow shrimp.',
    'My belly is an empty shell.',
    'Food… drifting away…',
    'Something to nibble?',
  ],
  sad: ['The water feels cold.', 'Lost in the dark…', 'Stay with me a while?'],
  sleepy: ['Sinking into dreams…', 'Sleep, like the deep…', 'Zzz… bubbles…'],
  surfaced: ['Back to the light.', 'The deep was kind.', 'Treasures from below.'],
  busted: ['The current took it.', 'The sea keeps its secrets.', 'Drifted away…'],
  rare_find: ['A glow in the dark!', 'The deep gave a gift.', 'So rare… so pretty.'],
  expedition_back: ['I swam so far…', 'The shallows sang to me.', 'Home with a gift.'],
  evolving_soon: ['I feel a tide rising…', 'Something deep is stirring.', 'Changing, like the moon.'],
  evolved: ['Reborn from the deep.', 'New scales, new dreams.', 'I feel the ocean in me.'],
  waves_cleared: ['The waves grew calm.', 'Peace after the storm.', 'Well held, friend.'],
  morning: ['Morning light on water.', 'The sea woke up.', 'Soft morning…'],
  afternoon: ['Warm afternoon tides.', 'Sun on the waves.', 'Drifting through the day.'],
  evening: ['The moon pulls the tide.', 'Evening currents…', 'The sea turns violet.'],
};

export const PET_TALK_LINES: Record<PetBranch, Lines> = {
  standard: STANDARD,
  bright: BRIGHT,
  scruffy: SCRUFFY,
  battle: BATTLE,
  deep: DEEP,
};

/** The egg can't talk yet — it wobbles and says one of these. */
export const PET_EGG_LINES: readonly string[] = ['*wobble*', '*tap tap*', '*wiggle*', '…'];

/** Words GAME_SPEC §7 bans from Play copy. */
export const PET_BANNED_WORDS: readonly string[] = ['gamble', 'casino', 'jackpot', 'bet'];

/**
 * A line for `situation` in the form's voice that is never `last` (so the
 * same line never plays twice in a row). `rng` returns 0..1.
 */
export function pickPetLine(
  branch: PetBranch,
  situation: PetTalkSituation,
  last: string | null,
  rng: () => number = Math.random,
): string {
  const pool = PET_TALK_LINES[branch][situation];
  const options = pool.filter((line) => line !== last);
  const from = options.length > 0 ? options : pool;
  return from[Math.min(from.length - 1, Math.floor(rng() * from.length))];
}

/** An egg line that is never `last`. */
export function pickEggLine(last: string | null, rng: () => number = Math.random): string {
  const options = PET_EGG_LINES.filter((line) => line !== last);
  return options[Math.min(options.length - 1, Math.floor(rng() * options.length))];
}

/** What a status makes the pet talk about (Okay → idle chatter). */
export function talkSituationForStatus(status: PetStatus): PetTalkSituation {
  switch (status) {
    case 'starving':
    case 'hungry':
      return 'hungry';
    case 'very_sad':
    case 'sad':
      return 'sad';
    case 'sleepy':
      return 'sleepy';
    case 'evolving':
      return 'evolving_soon';
    case 'happy':
      return 'happy';
    default:
      return 'chatter';
  }
}

/** Time-of-day greeting for the phone's clock hour (null at night). */
export function timeOfDaySituation(hour: number): PetTalkSituation | null {
  if (hour >= 7 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return null;
}

/** Idle chatter every so often, ms (random inside this range). */
export const PET_IDLE_TALK_MIN_MS = 16_000;
export const PET_IDLE_TALK_MAX_MS = 32_000;
/** A bubble types out at this pace, then stays, then fades. */
export const PET_TALK_TYPE_MS = 28;
export const PET_TALK_HOLD_MS = 2600;

/* ------------------------------------------------ egg stages (v23) --- */

/** Egg-stage moments — one shared voice (the form is only picked at Teen). */
export const PET_EGG_TALK = [
  'keep_warm',
  'hatching_soon',
  'hatched',
  'reveal_common',
  'reveal_rare',
  'reveal_epic',
  'reveal_legendary',
  'shiny',
  'trade_ready',
] as const;
export type PetEggTalk = (typeof PET_EGG_TALK)[number];

export const PET_EGG_TALK_LINES: Record<PetEggTalk, readonly string[]> = {
  keep_warm: ['*shiver* Keep me warm…', 'Brr! A little warmth?', '*wobble* It’s chilly in here.'],
  hatching_soon: ['*crack* Almost out!', '*tap tap* Nearly there…', 'I can hear you out there!'],
  hatched: ['Peep! Hello, world!', 'I’m out! Feed me? Play?', 'Hi! I’m new here.'],
  reveal_common: ['Look, it’s me!', 'Nice to meet you properly!', 'This is who I am!'],
  reveal_rare: ['Ooh, I’ve got a glow!', 'Rare and ready!', 'See my shine?'],
  reveal_epic: ['Whoa — purple sparks!', 'Epic, right?!', 'I feel powerful!'],
  reveal_legendary: ['A LEGEND is born!', 'Gold! I’m Legendary!', 'They’ll tell stories about me!'],
  shiny: ['I’m… sparkly?!', 'A shiny! One in fifty!', 'Look at my colours!'],
  trade_ready: ['Your shards can trade up!', 'Five shards — trade them up!', 'A better egg is waiting!'],
};

/** An egg-stage line that is never `last`. */
export function pickEggTalk(moment: PetEggTalk, last: string | null, rng: () => number = Math.random): string {
  const pool = PET_EGG_TALK_LINES[moment];
  const options = pool.filter((line) => line !== last);
  const from = options.length > 0 ? options : pool;
  return from[Math.min(from.length - 1, Math.floor(rng() * from.length))];
}

/* ------------------------------------------------ mini-game rounds (v25) --- */

/** After a round — one shared voice. */
export const PET_ROUND_TALK = {
  pass: ['We did it!', 'Nice moves!', 'That was fun — again?'],
  skilled: ['Wow, you’re good at this!', 'Perfect rhythm!', 'Top marks!'],
  fail: ['So close — one more go?', 'Tricky one! Try again?', 'Almost! I believe in you.'],
  bombs: ['Ouch — those bombs!', 'Watch out for the 💣!', 'Too many bombs… again?'],
} as const;
export type PetRoundTalk = keyof typeof PET_ROUND_TALK;

export function pickRoundTalk(kind: PetRoundTalk, last: string | null, rng: () => number = Math.random): string {
  const pool = PET_ROUND_TALK[kind];
  const options = pool.filter((line) => line !== last);
  const from = options.length > 0 ? options : pool;
  return from[Math.min(from.length - 1, Math.floor(rng() * from.length))];
}
