/** `?section=` targets that scroll You to a block. */
export const SECTION_KEYS = ['shape', 'traits', 'categories', 'profile', 'tokens', 'quests'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

/**
 * The block a deep link asks for, or null. Anything that is not exactly one
 * known key (unknown, empty, wrong case, a repeated param, a section whose flag
 * is off) is ignored: You just stays at the top, no error.
 */
export function parseSection(raw: unknown): SectionKey | null {
  return typeof raw === 'string' && (SECTION_KEYS as readonly string[]).includes(raw) ? (raw as SectionKey) : null;
}
