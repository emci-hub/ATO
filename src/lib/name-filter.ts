/**
 * Name and handle filter (Circle safety, wave104, Apple 1.2).
 *
 * Narrow on purpose (core content policy, docs/copy-review-rules.md): swearing is allowed. This only
 * refuses slurs aimed at a group and names that pretend to be ATO staff. The server runs the same
 * lists (`_name_not_allowed` in wave104_circle_safety.sql); `check:circle-safety` pins that the two
 * copies match and holds the pass/fail pairs.
 */

/** Matched anywhere in the folded text: long and distinctive enough not to hit ordinary words. */
export const SLURS_ANYWHERE = [
  'nigger',
  'nigga',
  'faggot',
  'fagot',
  'tranny',
  'trannie',
  'wetback',
  'raghead',
  'towelhead',
  'beaner',
  'chink',
  'retard',
  'hitler',
  'kkk',
] as const;

/**
 * Matched only as a whole word in a name, or as the whole handle: short enough to sit inside
 * ordinary words ("spicy", "Pakistan", "raccoon").
 */
export const SLURS_WHOLE = ['fag', 'kike', 'spic', 'gook', 'paki', 'nazi'] as const;

/** Ordinary words that contain a slur; removed before the anywhere-match (wave104b). */
export const SAFE_WORDS = ['snigger'] as const;

/** A handle that starts with one of these pretends to speak for ATO. */
export const STAFF_PREFIXES = [
  'admin',
  'support',
  'official',
  'moderator',
  'atoteam',
  'atostaff',
  'atosupport',
  'atoofficial',
  'atoadmin',
  'teamato',
] as const;

/** A handle that ends with one of these pretends to speak for ATO. */
export const STAFF_SUFFIXES = ['official', 'admin', 'moderator'] as const;

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

/** Lower-case, undo common digit swaps, keep letters only. */
export function foldForFilter(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[013457@$]/g, (ch) => LEET[ch] ?? ch)
    .replace(/[^a-z]/g, '');
}

function words(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[013457@$]/g, (ch) => LEET[ch] ?? ch)
    .split(/[^a-z]+/)
    .filter(Boolean);
}

/** True when this display name or handle is refused. */
export function nameNotAllowed(raw: string, kind: 'name' | 'handle'): boolean {
  const folded = foldForFilter(raw);
  if (!folded) return false;
  const scrubbed = SAFE_WORDS.reduce((s, w) => s.split(w).join(''), folded);
  if (SLURS_ANYWHERE.some((s) => scrubbed.includes(s))) return true;
  if (kind === 'name') {
    if (words(raw).some((w) => (SLURS_WHOLE as readonly string[]).includes(w))) return true;
    // "Ato" alone is a real given name; only "ATO Team"-style names are staff.
    return STAFF_PREFIXES.some((p) => p.startsWith('ato') && folded.startsWith(p));
  }
  if ((SLURS_WHOLE as readonly string[]).includes(folded)) return true;
  if (STAFF_PREFIXES.some((p) => folded.startsWith(p))) return true;
  return STAFF_SUFFIXES.some((s) => folded.endsWith(s));
}

export const NAME_NOT_ALLOWED_MESSAGE = "That one isn't available. Pick another.";
