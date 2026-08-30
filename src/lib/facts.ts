/**
 * Stored Teach-Sage facts (`me.facts`). Read and delete live here.
 * The only create path is still `addFact` from Chat ("Teach Sage this").
 *
 * Display is user-authored free text — do not fence or guard on read.
 * The write-time fence in `addFact` already ran.
 */

export const FACTS_SCREEN_TITLE = 'What Sage remembers';
export const FACTS_EMPTY_COPY =
  'Nothing here yet. Teach Sage something from a message in Talk.';
export const FACTS_FORGET_CONFIRM = 'Forget this?';
export const FACTS_SUMMARY_EMPTY = 'Nothing yet';

export function asFactsArray(facts: unknown): string[] {
  if (!Array.isArray(facts)) return [];
  return facts.filter((item): item is string => typeof item === 'string');
}

export function factsSummaryLabel(count: number): string {
  if (count <= 0) return FACTS_SUMMARY_EMPTY;
  if (count === 1) return 'Sage remembers 1 thing';
  return `Sage remembers ${count} things`;
}

/** Drops one stored entry. Empty array is a valid result (back to zero). */
export function withoutFactAt(facts: unknown, index: number): string[] {
  const list = asFactsArray(facts);
  if (index < 0 || index >= list.length) return list;
  return [...list.slice(0, index), ...list.slice(index + 1)];
}
