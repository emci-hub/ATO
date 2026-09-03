/**
 * Plain-language concept explainers. UNREVIEWED.
 * These explain the *idea* — not the person's data.
 * Pole / band copy stays separate.
 */
import type { CategoryId } from '@/lib/categories';
import type { TraitAxis } from '@/lib/traits';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

export const CONCEPT_COPY_REVIEWED = false;

export const AXIS_CONCEPTS: Record<TraitAxis, string> = {
  openness:
    'How curious you are about a new path versus sticking with what already works.',
  conscientiousness:
    'How much you see a plan through when it gets boring, versus deciding in the moment.',
  extraversion:
    'Whether people around you tend to get you going, or quiet time is how you reset.',
  agreeableness:
    'How often you go along to keep things easy, versus holding your ground.',
  steadiness:
    'How long a small knock sits with you — shaken off by lunch, or coloring the rest of the day.',
  attachment_anxiety:
    'What a pause from someone you like does — just a slow reply, or the start of a worry they are pulling away. This can shift. It is not a type.',
  attachment_avoidance:
    'How close you stay once you are in — talking it out in person, or keeping some distance. This can shift. It is not a type.',
  conflict_assertiveness:
    'In a disagreement, whether you put your own point on the table or step back.',
  conflict_cooperativeness:
    'In a disagreement, whether you look for something the other person can live with, or protect your outcome first.',
  autonomy:
    'Whether you would rather do it your way, or a path already set is fine.',
  competence:
    'What a hard task feels like — something you can handle, or something that makes you doubt.',
  relatedness:
    'How much a real connection is needed for a day to land, versus a day being fine on its own.',
  growth_mindset:
    'After a miss, whether you look at what you would change, or treat it as the end of that path.',
  locus_of_control:
    'When a plan falls apart, whether you look first at what you might have done differently, or figure it was bound to happen.',
  self_efficacy:
    'Facing a bigger-than-usual ask, whether it lands as something you can figure out.',
  playfulness:
    'How much a bit of lightness is part of a day — making it a little ridiculous on purpose, or treating the day as a job to get through.',
};

export const CATEGORY_CONCEPTS: Record<CategoryId, string> = {
  cat_steadiness:
    'How you hold a plan and a knock — follow-through, going along, and how fast a bad start fades.',
  cat_openness:
    'How open a day is to a different path and to people around you.',
  cat_drive:
    'How you pick a path, handle a hard task, and whether a real connection is part of that.',
  cat_agency:
    'What you tell yourself after a miss, and whether a bigger ask feels like yours to figure out.',
  cat_social:
    'Everyday people-energy: rooms, going along, and whether the day wants a little play.',
  cat_communication:
    'How you move in a disagreement — putting a point on the table, and leaving the other person a way through.',
  cat_love:
    'A map of closeness: worry about people pulling away on one side, keeping some distance on the other. Conflict style sits under the map as texture, not as a score. Soft poles — this can shift.',
  cat_independence:
    'A map of doing it your way versus needing a real connection for a day to land. Two separate questions, plotted together.',
  cat_levity:
    'How much a hard talk can still have a little air in it — play in the day, plus how a disagreement gets named and left with a way through. A bar, not a map. This can shift.',
  cat_structure:
    'A map of whether a plan holds when the day gets boring, against how open you are to trading it for something you did not see coming. Two separate questions, plotted together.',
  cat_resilience:
    'What a hard task feels like, whether a miss reads as something to learn from or the end of the road, and how fast a knock fades.',
};

export function axisConcept(axis: TraitAxis): string {
  return AXIS_CONCEPTS[axis];
}

export function categoryConcept(id: CategoryId): string {
  return CATEGORY_CONCEPTS[id];
}

export function conceptCopyClean(): boolean {
  const lines = [...Object.values(AXIS_CONCEPTS), ...Object.values(CATEGORY_CONCEPTS)];
  return lines.every((line) => !containsFrameworkTerm(line));
}
