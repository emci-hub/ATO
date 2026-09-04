/**
 * Explore "Full profile" checklist copy. Filled (>=1 report answer) is a
 * different, weaker predicate than settled (`full-profile.ts`), and the two
 * are allowed to disagree — see `trait-stability.ts`.
 */
import { NOT_ANSWERED_YET } from '@/lib/full-profile';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

export const PROFILE_FILL_COPY_REVIEWED = true;

export const PROFILE_FILL_LABEL = 'Full profile';
export const PROFILE_FILL_LEDE =
  'One answer is enough to fill a trait in. Filling one is not the same as settling it — settling takes a few answers that agree.';
export const PROFILE_FILL_COMPLETE_LABEL = 'Complete';
export const PROFILE_FILL_COMPLETE_LEDE =
  'Every trait has at least one answer. Questions can go anywhere from here.';
export const PROFILE_FILL_ROW_FILLED = 'Filled';

/** Same fence every other reviewable copy module runs before its flag can flip. */
export function profileFillCopyClean(): boolean {
  const lines = [
    PROFILE_FILL_LABEL,
    PROFILE_FILL_LEDE,
    PROFILE_FILL_COMPLETE_LABEL,
    PROFILE_FILL_COMPLETE_LEDE,
    PROFILE_FILL_ROW_FILLED,
    NOT_ANSWERED_YET,
  ];
  return lines.every((line) => !containsFrameworkTerm(line));
}
