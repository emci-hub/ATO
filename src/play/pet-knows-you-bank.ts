/**
 * The pet that knows you — the hand-written line bank (hideout roadmap step 3, 2026-10-15).
 *
 * Stored lines, picked on the phone, NEVER a model call (copy of the insight-bank pattern). Three
 * kinds: a trait line (all 16 axes, both ends, 3 each), a hedge for thin data ("still figuring you
 * out" — the pet never goes silent), and a streak line (gentle: a broken streak has no line).
 *
 * Voice: the reframe word list in docs/hideout-roadmap.md — cognitive reappraisal. Everyday words for
 * the moment or the feeling, as a state, never a clinical label, never a flaw. Lows get the same warmth
 * as highs. Moment voice (src/lib/voice/moment-voice.ts): one recognizable moment, teased kindly, no
 * advice, no slang, never "you are" / "you're" / "always". At most 10 words and 48 characters a line.
 *
 * IDS ARE FOREVER. `pky_<axis>_<h|l>_<nn>`, `pky_thin_<nn>`, `pky_streak_<tier>_<nn>`. The no-repeat
 * memory is kept by id, so an id is never renumbered or reused. Retire a line by deleting it and write
 * a new one with the next free number.
 *
 * Ships with PET_KNOWS_YOU_COPY_REVIEWED = false until emci has read the bank (no badge in the app).
 * Never shown in Circle, never shared, never stored in the cloud save (check:pet-knows-you).
 */
import type { TraitAxis } from '@/lib/traits';

export const PET_KNOWS_YOU_COPY_REVIEWED = true; // emci read the bank 2026-10-15

/** A line is at most this many words / characters (the bubble is the pet-talk bubble). */
export const PKY_MAX_WORDS = 10;
export const PKY_MAX_CHARS = 48;

export interface PkyLine {
  id: string;
  text: string;
}

export type PkyEnd = 'high' | 'low';

const L = (id: string, text: string): PkyLine => ({ id, text });

export const PKY_TRAIT_LINES: Record<TraitAxis, Record<PkyEnd, readonly PkyLine[]>> = {
  extraversion: {
    high: [
      L('pky_extraversion_h_01', 'The group chat pinged. Good mood arrived.'),
      L('pky_extraversion_h_02', 'Plans with people? I felt your steps speed up.'),
      L('pky_extraversion_h_03', 'Quick call, you said. Then an hour.'),
    ],
    low: [
      L('pky_extraversion_l_01', 'Door closed, phone on silent. I like this.'),
      L('pky_extraversion_l_02', 'Leaving the party early felt like a win.'),
      L('pky_extraversion_l_03', 'A quiet night in beat the plans.'),
    ],
  },
  openness: {
    high: [
      L('pky_openness_h_01', 'A new place, a new tab, a new obsession.'),
      L('pky_openness_h_02', 'You opened the menu and skipped your usual.'),
      L('pky_openness_h_03', 'One more side quest. I saw the look.'),
    ],
    low: [
      L('pky_openness_l_01', 'Same order, same seat. It’s a good order.'),
      L('pky_openness_l_02', 'The favorite song, again. Still works.'),
      L('pky_openness_l_03', 'You know what you like. Saves time.'),
    ],
  },
  conscientiousness: {
    high: [
      L('pky_conscientiousness_h_01', 'The list got checked off. All of it.'),
      L('pky_conscientiousness_h_02', 'Calendar says Tuesday. You were ready Monday.'),
      L('pky_conscientiousness_h_03', 'Packed the bag the night before. Again.'),
    ],
    low: [
      L('pky_conscientiousness_l_01', 'Plans in pencil. We’ll see what happens.'),
      L('pky_conscientiousness_l_02', 'Left the house with a vague idea. It worked.'),
      L('pky_conscientiousness_l_03', 'Winging it, and somehow it lands.'),
    ],
  },
  agreeableness: {
    high: [
      L('pky_agreeableness_h_01', 'You said “whatever works” and meant it.'),
      L('pky_agreeableness_h_02', 'Someone was tense. You softened the room.'),
      L('pky_agreeableness_h_03', 'You let everyone else pick the restaurant.'),
    ],
    low: [
      L('pky_agreeableness_l_01', 'You said the honest thing. The room survived.'),
      L('pky_agreeableness_l_02', 'A polite no, sent without three emojis.'),
      L('pky_agreeableness_l_03', 'Not everyone liked it. You said it anyway.'),
    ],
  },
  steadiness: {
    high: [
      L('pky_steadiness_h_01', 'Inbox on fire. You made tea anyway.'),
      L('pky_steadiness_h_02', 'The bad news landed. You finished lunch.'),
      L('pky_steadiness_h_03', 'Plans changed twice and you shrugged.'),
    ],
    low: [
      L('pky_steadiness_l_01', 'Busy-brain day? I’ll sit right here.'),
      L('pky_steadiness_l_02', 'A big feeling in a tiny text. I get it.'),
      L('pky_steadiness_l_03', 'Twelve tabs open in your head. I’m here.'),
    ],
  },
  attachment_anxiety: {
    high: [
      L('pky_attachment_anxiety_h_01', 'Still here. Didn’t go anywhere.'),
      L('pky_attachment_anxiety_h_02', 'Left on read feels loud. I’m not leaving.'),
      L('pky_attachment_anxiety_h_03', 'Phone quiet for a while. I’m right here.'),
    ],
    low: [
      L('pky_attachment_anxiety_l_01', 'No reply for hours. Not a worry.'),
      L('pky_attachment_anxiety_l_02', 'You let the quiet be quiet. I like that.'),
      L('pky_attachment_anxiety_l_03', 'Seen, not answered, and you stayed calm.'),
    ],
  },
  attachment_avoidance: {
    high: [
      L('pky_attachment_avoidance_h_01', 'A little space, and the day got better.'),
      L('pky_attachment_avoidance_h_02', 'Plans can wait. Some elbow room first.'),
      L('pky_attachment_avoidance_h_03', 'Trust takes its time. I’ve got time.'),
    ],
    low: [
      L('pky_attachment_avoidance_l_01', 'All in with your people. I see it.'),
      L('pky_attachment_avoidance_l_02', 'You call back the same day.'),
      L('pky_attachment_avoidance_l_03', 'Close friends get the real voice note.'),
    ],
  },
  conflict_assertiveness: {
    high: [
      L('pky_conflict_assertiveness_h_01', 'You put your point on the table.'),
      L('pky_conflict_assertiveness_h_02', 'Someone talked over everyone. You spoke up.'),
      L('pky_conflict_assertiveness_h_03', 'Said it out loud instead of drafting it.'),
    ],
    low: [
      L('pky_conflict_assertiveness_l_01', 'Small stuff slid past. Picked your battles.'),
      L('pky_conflict_assertiveness_l_02', 'A sigh, a shrug, on to the next.'),
      L('pky_conflict_assertiveness_l_03', 'You let that one go. Lighter now.'),
    ],
  },
  conflict_cooperativeness: {
    high: [
      L('pky_conflict_cooperativeness_h_01', 'You found the middle. Both sides nodded.'),
      L('pky_conflict_cooperativeness_h_02', 'A deal both could live with. Nicely done.'),
      L('pky_conflict_cooperativeness_h_03', 'Split the difference before anyone asked.'),
    ],
    low: [
      L('pky_conflict_cooperativeness_l_01', 'Own corner sorted, then the rest.'),
      L('pky_conflict_cooperativeness_l_02', 'Your side got a seat at the table first.'),
      L('pky_conflict_cooperativeness_l_03', 'Not every deal is worth making.'),
    ],
  },
  autonomy: {
    high: [
      L('pky_autonomy_h_01', 'Took the back road. Your route, your map.'),
      L('pky_autonomy_h_02', 'You skipped the tutorial and figured it out.'),
      L('pky_autonomy_h_03', 'Directions given. You did it your way.'),
    ],
    low: [
      L('pky_autonomy_l_01', 'A good plan appeared. You happily followed.'),
      L('pky_autonomy_l_02', 'Someone else drove and you enjoyed the view.'),
      L('pky_autonomy_l_03', 'Handed a plan, no notes. Relief.'),
    ],
  },
  competence: {
    high: [
      L('pky_competence_h_01', 'Big task landed. “I’ve got this,” you thought.'),
      L('pky_competence_h_02', 'You nodded before the instructions ended.'),
      L('pky_competence_h_03', 'That looked hard. You made it look easy.'),
    ],
    low: [
      L('pky_competence_l_01', 'A careful read, then a second one.'),
      L('pky_competence_l_02', 'A practice run before the real one.'),
      L('pky_competence_l_03', 'You reread the email before hitting send.'),
    ],
  },
  relatedness: {
    high: [
      L('pky_relatedness_h_01', 'A real chat beat ten texts today.'),
      L('pky_relatedness_h_02', 'The day only counted after you saw someone.'),
      L('pky_relatedness_h_03', 'Coffee with a friend. Whole week fixed.'),
    ],
    low: [
      L('pky_relatedness_l_01', 'A solo day still counted. It did.'),
      L('pky_relatedness_l_02', 'No plans, no problem. You were fine.'),
      L('pky_relatedness_l_03', 'Eating alone, headphones on, perfectly happy.'),
    ],
  },
  growth_mindset: {
    high: [
      L('pky_growth_mindset_h_01', 'A miss, then round two within the hour.'),
      L('pky_growth_mindset_h_02', 'You called it practice and tried again.'),
      L('pky_growth_mindset_h_03', 'Not good at it yet. You said “yet.”'),
    ],
    low: [
      L('pky_growth_mindset_l_01', 'That miss stuck around for a minute.'),
      L('pky_growth_mindset_l_02', 'Round two can wait a little. I’ll wait too.'),
      L('pky_growth_mindset_l_03', 'Took the miss to heart. I get that.'),
    ],
  },
  locus_of_control: {
    high: [
      L('pky_locus_of_control_h_01', 'Something slipped. You asked what to tweak.'),
      L('pky_locus_of_control_h_02', 'You opened the settings, not the complaints.'),
      L('pky_locus_of_control_h_03', 'A rough week, then a revised plan.'),
    ],
    low: [
      L('pky_locus_of_control_l_01', 'Some days just go sideways. This was one.'),
      L('pky_locus_of_control_l_02', 'Rain, delays, a dead battery. Not your doing.'),
      L('pky_locus_of_control_l_03', 'The bus left early. Nothing you could do.'),
    ],
  },
  self_efficacy: {
    high: [
      L('pky_self_efficacy_h_01', 'Big task? You stepped right up.'),
      L('pky_self_efficacy_h_02', 'Hand went up before the question finished.'),
      L('pky_self_efficacy_h_03', 'New thing at work, and you said yes.'),
    ],
    low: [
      L('pky_self_efficacy_l_01', 'Jitters at the start line. I’m right here.'),
      L('pky_self_efficacy_l_02', 'Big task, deep breath, then the first step.'),
      L('pky_self_efficacy_l_03', 'Your stomach flipped, then you started anyway.'),
    ],
  },
  playfulness: {
    high: [
      L('pky_playfulness_h_01', 'You found the joke in the meeting.'),
      L('pky_playfulness_h_02', 'Boring task, so you made it a game.'),
      L('pky_playfulness_h_03', 'Play first, errands second. Fair.'),
    ],
    low: [
      L('pky_playfulness_l_01', 'Got it done. Jokes can come later.'),
      L('pky_playfulness_l_02', 'Straight to the point, no detours.'),
      L('pky_playfulness_l_03', 'The task came first. Fun came after.'),
    ],
  },
};

/** Thin data: the pet hedges, it never goes silent. */
export const PKY_THIN_LINES: readonly PkyLine[] = [
  L('pky_thin_01', 'Still figuring you out. Take your time.'),
  L('pky_thin_02', 'I’m still learning your corners.'),
  L('pky_thin_03', 'Not sure what you like yet. I’m curious.'),
  L('pky_thin_04', 'I’m only getting to know you.'),
  L('pky_thin_05', 'Guessing so far. Bear with me.'),
  L('pky_thin_06', 'I know a little. I’d like to know more.'),
  L('pky_thin_07', 'New friend, still reading the room.'),
  L('pky_thin_08', 'Not much written about you yet.'),
];

/** Check-in streak. `min` is the first day of the tier. A broken streak (0) gets no line, ever. */
export interface PkyStreakTier {
  tier: string;
  min: number;
  lines: readonly PkyLine[];
}

export const PKY_STREAK_TIERS: readonly PkyStreakTier[] = [
  {
    tier: 'start',
    min: 1,
    lines: [
      L('pky_streak_start_01', 'Today’s check-in counted. A start.'),
      L('pky_streak_start_02', 'One check-in in. I noticed.'),
      L('pky_streak_start_03', 'You showed up today. Small and real.'),
    ],
  },
  {
    tier: 'early',
    min: 2,
    lines: [
      L('pky_streak_early_01', 'You came back again. I noticed.'),
      L('pky_streak_early_02', 'Back again, like yesterday. I noticed.'),
      L('pky_streak_early_03', 'A little streak is starting.'),
    ],
  },
  {
    tier: 'building',
    min: 4,
    lines: [
      L('pky_streak_building_01', 'Almost a week of you. Nice.'),
      L('pky_streak_building_02', 'Day after day lately. I’m not complaining.'),
      L('pky_streak_building_03', 'The streak’s growing. I’m keeping count.'),
    ],
  },
  {
    tier: 'week',
    min: 7,
    lines: [
      L('pky_streak_week_01', 'A week and counting. I kept count.'),
      L('pky_streak_week_02', 'Seven days or more. Not bad at all.'),
      L('pky_streak_week_03', 'A whole week of check-ins. Quiet pride.'),
    ],
  },
  {
    tier: 'habit',
    min: 14,
    lines: [
      L('pky_streak_habit_01', 'Two weeks, give or take. Still here.'),
      L('pky_streak_habit_02', 'Officially a habit. I’m a fan.'),
      L('pky_streak_habit_03', 'Weeks of you showing up. I notice.'),
    ],
  },
];

export function allPkyLines(): PkyLine[] {
  const out: PkyLine[] = [];
  for (const ends of Object.values(PKY_TRAIT_LINES)) out.push(...ends.high, ...ends.low);
  out.push(...PKY_THIN_LINES);
  for (const tier of PKY_STREAK_TIERS) out.push(...tier.lines);
  return out;
}

/** The axis a trait line id belongs to (null for a hedge or a streak line). */
export function axisOfPkyId(id: string): TraitAxis | null {
  for (const axis of Object.keys(PKY_TRAIT_LINES) as TraitAxis[]) {
    const ends = PKY_TRAIT_LINES[axis];
    if (ends.high.some((l) => l.id === id) || ends.low.some((l) => l.id === id)) return axis;
  }
  return null;
}
