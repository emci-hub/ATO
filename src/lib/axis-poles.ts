/**
 * What each end of a trait looks like, one short moment per end. Shown on the
 * Full Profile and inside every "What shapes this" reveal (lib/shaped-by.ts).
 */
import type { TraitAxis } from '@/lib/traits';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

// emci picked this style on 2026-10-02 ("that looks better") from samples; the
// full set of 32 quotes and 16 names is draft until emci reads it
// (docs/copy-review.md, section 3).
export const POLE_COPY_REVIEWED = false;

export interface AxisPoles {
  low: string;
  high: string;
}

/**
 * What each side of a trait SOUNDS like: one thing a person on that side would
 * actually say. Shown in quotes — “You sound more like: …” for the reader's own
 * side, “The other side: …” for the one they are not on. First person on
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
 * The short everyday name for each trait, for screens. The longer
 * AXIS_EDITOR_COPY labels stay as they are: the AI prompts and the trait editor
 * read those.
 */
export const AXIS_SHORT_NAME: Record<TraitAxis, string> = {
  openness: 'Trying new things',
  conscientiousness: 'Plans',
  extraversion: 'People time',
  agreeableness: 'Going along with it',
  steadiness: 'A bad day',
  attachment_anxiety: 'When someone goes quiet',
  attachment_avoidance: 'Getting close',
  conflict_assertiveness: 'In a disagreement',
  conflict_cooperativeness: 'Give and take',
  autonomy: 'Doing it your way',
  competence: 'A hard task',
  relatedness: 'Needing connection',
  growth_mindset: 'After a miss',
  locus_of_control: 'When plans fall apart',
  self_efficacy: 'A big ask',
  playfulness: 'Keeping it light',
};

export function poleCopyClean(): boolean {
  for (const poles of Object.values(AXIS_POLES)) {
    if (containsFrameworkTerm(poles.low) || containsFrameworkTerm(poles.high)) return false;
  }
  for (const name of Object.values(AXIS_SHORT_NAME)) {
    if (containsFrameworkTerm(name)) return false;
  }
  return true;
}
