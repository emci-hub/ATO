/**
 * Explore "Full profile" checklist copy. Filled (>=1 report answer) is a
 * different, weaker predicate than settled (`full-profile.ts`), and the two
 * are allowed to disagree — see `trait-stability.ts`.
 */
import { NOT_ANSWERED_YET } from '@/lib/full-profile';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

/**
 * Back to draft 2026-10-01: the label and the complete label changed. "Full
 * profile · Complete" at one answer per trait sat next to "Locked — finish all
 * 50" and "N of 16 settled", and read as a contradiction.
 */
// emci approved 2026-10-02.
export const PROFILE_FILL_COPY_REVIEWED = true;

export const PROFILE_FILL_LABEL = 'Traits answered';
export const PROFILE_FILL_LEDE =
  'One answer is enough to fill a trait in. Filling one is not the same as settling it — settling takes a few answers that agree.';
export const PROFILE_FILL_COMPLETE_LABEL = 'all answered once';
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
