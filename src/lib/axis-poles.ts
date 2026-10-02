/**
 * What each end of a trait looks like, one short moment per end. Shown on the
 * Full Profile and inside every "What shapes this" reveal (lib/shaped-by.ts).
 */
import type { TraitAxis } from '@/lib/traits';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

// Rewritten 2026-10-02 at emci's request in the moment voice, and written
// WITHOUT a subject on purpose: each line has to read correctly both as "You
// lean: …" (the reader's own side) and as "The other end: …" (the side they are
// not on), so neither "you" nor "they" can be in it.
// Draft again until emci reads this version (docs/copy-review.md, section 3).
export const POLE_COPY_REVIEWED = false;

export interface AxisPoles {
  low: string;
  high: string;
}

export const AXIS_POLES: Record<TraitAxis, AxisPoles> = {
  openness: {
    low: 'Same order as last time, because it was good last time.',
    high: 'The untried option wins. A different route home, just to see.',
  },
  conscientiousness: {
    low: 'Plans stay loose and get decided in the moment. The dull stretch is where the drifting starts.',
    high: 'The plan gets finished, even after it stops being fun.',
  },
  extraversion: {
    low: 'Quiet is the reset. A full room costs something.',
    high: 'People are the charge. One quick hello turns into three new contacts.',
  },
  agreeableness: {
    low: 'Holds the line on a plan that feels wrong, and says so.',
    high: 'Goes along to keep it easy, even with a preference in mind.',
  },
  steadiness: {
    low: 'One small knock can color the rest of the day.',
    high: 'A bad morning is gone by lunch.',
  },
  attachment_anxiety: {
    low: 'A slow reply is just a slow reply.',
    high: 'A pause from someone close can start to feel like pulling away.',
  },
  attachment_avoidance: {
    low: 'Once in, stays close. Would rather talk it out in person.',
    high: 'Keeps a little distance, even with people who matter. A text is easier than a call.',
  },
  conflict_assertiveness: {
    low: 'Steps back in a disagreement. The comeback arrives three days later.',
    high: 'Puts the point on the table, even if it lands a little sharp.',
  },
  conflict_cooperativeness: {
    low: 'Protects the outcome first. Rarely the one who gives.',
    high: 'Looks for the version both people can live with, and often gives first.',
  },
  autonomy: {
    low: 'A plan someone else made is a relief.',
    high: 'Own way, even with a plan already on the table.',
  },
  competence: {
    low: 'A hard task brings the doubt before the first step.',
    high: 'A hard task lands as "send it to me."',
  },
  relatedness: {
    low: 'A day can go fine without much contact.',
    high: 'A day needs one real conversation to count.',
  },
  growth_mindset: {
    low: 'A miss can feel like the end of that road.',
    high: 'After a miss, straight to what to change next time.',
  },
  locus_of_control: {
    low: 'When a plan falls apart, it was bound to.',
    high: 'When a plan falls apart, the first look is at what could have gone differently.',
  },
  self_efficacy: {
    low: 'A bigger-than-usual ask lands as "not sure I can pull this off."',
    high: 'A bigger-than-usual ask lands as something to figure out.',
  },
  playfulness: {
    low: 'The day is a list to get through. Jokes can wait.',
    high: 'Finds the lighter take. A meme where words were expected.',
  },
};

export function poleCopyClean(): boolean {
  for (const poles of Object.values(AXIS_POLES)) {
    if (containsFrameworkTerm(poles.low) || containsFrameworkTerm(poles.high)) return false;
  }
  return true;
}
