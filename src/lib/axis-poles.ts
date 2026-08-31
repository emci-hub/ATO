/**
 * Full Profile pole descriptions. UNREVIEWED — same lane as crisis copy.
 * Flip POLE_COPY_REVIEWED after emci signs off. Full Profile only.
 */
import type { TraitAxis } from '@/lib/traits';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

export const POLE_COPY_REVIEWED = false;

export interface AxisPoles {
  low: string;
  high: string;
}

export const AXIS_POLES: Record<TraitAxis, AxisPoles> = {
  openness: {
    low: 'Prefers a known path. New ideas get a look, then usually wait.',
    high: 'Curious about the untried option. A different path is often the point.',
  },
  conscientiousness: {
    low: 'Keeps plans loose and decides in the moment. Dull stretches are easy to leave.',
    high: 'Sees a plan through even when it gets boring. Follow-through is the default.',
  },
  extraversion: {
    low: 'Quiet time is how they reset. A full room is a lot.',
    high: 'People around tend to get them going. They would rather make something happen.',
  },
  agreeableness: {
    low: 'Holds their ground when they do not like the plan. Not worth pretending.',
    high: 'Goes along to keep it easy. A fuss is rarely worth it.',
  },
  steadiness: {
    low: 'A small knock can color the rest of the day. It sits longer.',
    high: 'Shakes a bad start off. By lunch it is mostly gone.',
  },
  attachment_anxiety: {
    low: 'A slow reply is just a slow reply. They do not dwell on people leaving.',
    high: 'A pause from someone they like can start to feel like pulling away.',
  },
  attachment_avoidance: {
    low: 'Once they are in, they stay close. Talking it out in person is fine when it matters.',
    high: 'Keeps some distance, even with people they care about. Lighter, over text, is easier.',
  },
  conflict_assertiveness: {
    low: 'Steps back in a disagreement. Would rather let it go than push.',
    high: 'Puts their own point on the table, even if it gets a little sharp.',
  },
  conflict_cooperativeness: {
    low: 'Protects their outcome first. Rarely the one who gives.',
    high: 'Looks for something the other person can live with. Often gives first.',
  },
  autonomy: {
    low: 'A path already set is fine. Glad not to have to figure it out.',
    high: 'Would rather do it their way, even when someone else already has a plan.',
  },
  competence: {
    low: 'A hard task can make them doubt they will pull it off.',
    high: 'A hard task lands and they feel they can handle it.',
  },
  relatedness: {
    low: 'A day can land without much connection. Quiet on their own is enough.',
    high: 'Needs a real connection for a day to land. Would rather check in than let it go.',
  },
  growth_mindset: {
    low: 'A miss can feel like the end of that path. Maybe it just is not their thing.',
    high: 'After a miss they look at what they would change next time.',
  },
  locus_of_control: {
    low: 'When a plan falls apart, it was bound to happen. That is just how it goes.',
    high: 'When a plan falls apart, they look first at what they might have done differently.',
  },
  self_efficacy: {
    low: 'A bigger-than-usual ask can land as "not sure I am the one for this."',
    high: 'A bigger-than-usual ask lands as something they can figure out.',
  },
  playfulness: {
    low: 'Treats the day as a job to get through. Jokes can wait.',
    high: 'Looks for the lighter take. A bit of play is how a day lands.',
  },
};

export function poleCopyClean(): boolean {
  for (const poles of Object.values(AXIS_POLES)) {
    if (containsFrameworkTerm(poles.low) || containsFrameworkTerm(poles.high)) return false;
  }
  return true;
}
