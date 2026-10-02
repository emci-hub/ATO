/**
 * What each end of a trait looks like, one short moment per end. Shown on the
 * Full Profile and inside every "What shapes this" reveal (lib/shaped-by.ts).
 */
import type { TraitAxis } from '@/lib/traits';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

// emci approved the 16 trait names, the 32 end words and the 32 quotes on
// 2026-10-02 (docs/copy-review.md, section 3).
export const POLE_COPY_REVIEWED = true;

export interface AxisPoles {
  low: string;
  high: string;
}

/**
 * What each side of a trait SOUNDS like: one thing a person on that side would
 * actually say. Shown in quotes after that side's own word (AXIS_POLE_NAME
 * below), e.g. Adventurous: “What’s that? I’ll try it.” First person on
 * purpose (emci, 2026-10-02): a description of a person read like a spec sheet;
 * a line they would say themselves does not.
 */
export const AXIS_POLES: Record<TraitAxis, AxisPoles> = {
  openness: {
    low: 'I’ll have my usual.',
    high: 'What’s that? I’ll try it.',
  },
  conscientiousness: {
    low: 'I’ll figure it out when I get there.',
    high: 'I said I’d finish it, so I did.',
  },
  extraversion: {
    low: 'I need a night in.',
    high: 'Who’s around tonight?',
  },
  agreeableness: {
    low: 'I don’t love that plan.',
    high: 'I’m fine with anything.',
  },
  steadiness: {
    low: 'I’m still thinking about this morning.',
    high: 'Oh, that? I forgot about it.',
  },
  attachment_anxiety: {
    low: 'They’re probably just busy.',
    high: 'Did I say something wrong?',
  },
  attachment_avoidance: {
    low: 'Come over, let’s talk.',
    high: 'I’m good, I just need some space.',
  },
  conflict_assertiveness: {
    low: 'It’s fine, never mind.',
    high: 'Actually, I disagree.',
  },
  conflict_cooperativeness: {
    low: 'This is what I need.',
    high: 'What would work for you?',
  },
  autonomy: {
    low: 'Just tell me the plan.',
    high: 'I’ll do it my way.',
  },
  competence: {
    low: 'I’m not sure I can do this.',
    high: 'Send it to me.',
  },
  relatedness: {
    low: 'I’m good on my own today.',
    high: 'I need a real conversation.',
  },
  growth_mindset: {
    low: 'Maybe this just isn’t my thing.',
    high: 'Okay, what do I change?',
  },
  locus_of_control: {
    low: 'It was bound to happen.',
    high: 'What could I have done differently?',
  },
  self_efficacy: {
    low: 'That’s a lot. I don’t know.',
    high: 'I can do that.',
  },
  playfulness: {
    low: 'Let’s just get it done.',
    high: 'Okay, but make it fun.',
  },
};

/**
 * One-word names, the way personality apps people already know label things
 * (16Personalities: a named scale with a named word at each end). emci asked
 * for uniform, less casual wording on 2026-10-02: every trait is a single noun,
 * and each end has its own word, so the screen never has to say "one side" or
 * "the other side".
 *
 * These are everyday words, not the internal trait ids and not framework terms
 * (the fence runs over all of them). The longer AXIS_EDITOR_COPY labels stay
 * as they are: the AI prompts and the trait editor read those.
 */
export const AXIS_SHORT_NAME: Record<TraitAxis, string> = {
  openness: 'Curiosity',
  conscientiousness: 'Follow-through',
  extraversion: 'Sociability',
  agreeableness: 'Harmony',
  steadiness: 'Composure',
  attachment_anxiety: 'Reassurance',
  attachment_avoidance: 'Personal space',
  conflict_assertiveness: 'Directness',
  conflict_cooperativeness: 'Compromise',
  autonomy: 'Independence',
  competence: 'Confidence',
  relatedness: 'Connection',
  growth_mindset: 'Growth',
  locus_of_control: 'Ownership',
  self_efficacy: 'Self-belief',
  playfulness: 'Playfulness',
};

/** The word for each end of a trait. Shown as “You lean Adventurous”. */
export const AXIS_POLE_NAME: Record<TraitAxis, AxisPoles> = {
  openness: { low: 'Familiar', high: 'Adventurous' },
  conscientiousness: { low: 'Flexible', high: 'Structured' },
  extraversion: { low: 'Reserved', high: 'Outgoing' },
  agreeableness: { low: 'Frank', high: 'Easygoing' },
  steadiness: { low: 'Sensitive', high: 'Steady' },
  attachment_anxiety: { low: 'Trusting', high: 'Watchful' },
  attachment_avoidance: { low: 'Close', high: 'Private' },
  conflict_assertiveness: { low: 'Quiet', high: 'Direct' },
  conflict_cooperativeness: { low: 'Steadfast', high: 'Giving' },
  autonomy: { low: 'Guided', high: 'Self-directed' },
  competence: { low: 'Cautious', high: 'Assured' },
  relatedness: { low: 'Self-contained', high: 'Connected' },
  growth_mindset: { low: 'Settled', high: 'Learning' },
  locus_of_control: { low: 'Accepting', high: 'Accountable' },
  self_efficacy: { low: 'Hesitant', high: 'Bold' },
  playfulness: { low: 'Serious', high: 'Playful' },
};

export function poleCopyClean(): boolean {
  for (const poles of Object.values(AXIS_POLES)) {
    if (containsFrameworkTerm(poles.low) || containsFrameworkTerm(poles.high)) return false;
  }
  for (const name of Object.values(AXIS_SHORT_NAME)) {
    if (containsFrameworkTerm(name)) return false;
  }
  for (const names of Object.values(AXIS_POLE_NAME)) {
    if (containsFrameworkTerm(names.low) || containsFrameworkTerm(names.high)) return false;
  }
  return true;
}
